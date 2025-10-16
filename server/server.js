// server/server.js
import express from "express";
import path from "path";
import crypto from "crypto";
import helmet from "helmet";
import cors from "cors";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ----- basics
app.use(cors());
app.disable("x-powered-by");

// ----- generate a per-request nonce
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString("base64");
  next();
});

// --- Content Security Policy (balanced; nonce-based, CDN-friendly)
app.use((req, res, next) => {
  // Per-request nonce for inline scripts
  const nonce = Buffer.from(crypto.randomBytes(16)).toString('base64');
  res.locals.nonce = nonce;

  // Optional: your public API base (Render) for XHR/fetch
  const API_BASE = process.env.PUBLIC_API_BASE || 'https://studio.dripl.io';

  // Optional: allow localhost API in dev
  const allowLocalAPI = process.env.NODE_ENV !== 'production';

  // Build CSP using a directives object (keeps it tidy)
  // NOTE: If you add more CDNs later, just append to the arrays below.
  const directives = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "frame-ancestors": ["'self'"],            // prevent clickjacking
    "object-src": ["'none'"],                 // disable <object>, <embed>, <applet>

    // External JS + inline via nonce (no 'unsafe-inline')
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "https://cdn.jsdelivr.net",             // FFmpeg & UMD loaders
    ],

    // Some browsers use script-src-elem for element-based <script>
    "script-src-elem": [
      "'self'",
      `'nonce-${nonce}'`,
      "https://cdn.jsdelivr.net",
    ],

    // Styles (we allow inline for convenience), Google Fonts optional
    "style-src": [
      "'self'",
      "'unsafe-inline'",
      "https://fonts.googleapis.com",
    ],

    // Fonts (Google Fonts)
    "font-src": [
      "'self'",
      "data:",
      "https://fonts.gstatic.com",
    ],

    // Images & media (blob/data for previews & drag/drop)
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https:",
    ],
    "media-src": [
      "'self'",
      "data:",
      "blob:",
      "https:",
    ],

    // WASM + Workers
    // FFmpeg wasm runs in a Worker fetched from a CDN
    "worker-src": [
      "'self'",
      "blob:",
    ],

    // XHR/fetch connections (Supabase, your Render API, Google/Dropbox, jsDelivr)
    "connect-src": [
      "'self'",
      API_BASE,
      "https://cdn.jsdelivr.net",
      "https://*.supabase.co",
      "https://*.supabase.in",
      // Google APIs
      "https://www.googleapis.com",
      "https://content.googleapis.com",
      "https://*.googleapis.com",
      "https://*.gstatic.com",
      "https://oauth2.googleapis.com",
      // Dropbox APIs
      "https://api.dropboxapi.com",
      "https://content.dropboxapi.com",
    ].concat(allowLocalAPI ? ["http://localhost:8080"] : []),

    // Embedding YouTube/Drive/Dropbox UI when needed
    "frame-src": [
      "'self'",
      "https://www.youtube.com",
      "https://player.vimeo.com",
      "https://accounts.google.com",
      "https://drive.google.com",
      "https://www.dropbox.com",
    ],

    // Form submissions (OAuth flows)
    "form-action": [
      "'self'",
      "https://accounts.google.com",
    ],

    // Make mixed-content fetches upgrade to HTTPS automatically
    "upgrade-insecure-requests": [],
  };

  // Flatten into a single header string
  const cspHeader = Object.entries(directives)
    .map(([key, val]) => `${key} ${Array.isArray(val) ? val.join(' ') : val}`)
    .join('; ');

  res.setHeader('Content-Security-Policy', cspHeader);

  // Recommended security headers (keep these)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy',
    // tighten as needed later; these are commonly safe defaults
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  next();
});


// ----- serve static
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir, { setHeaders }));

function setHeaders(res, filePath) {
  // Strict MIME (helps noSniff)
  if (filePath.endsWith(".js")) res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  if (filePath.endsWith(".mjs")) res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  if (filePath.endsWith(".wasm")) res.setHeader("Content-Type", "application/wasm");
}

// inject nonce into the HTML template
app.get("/", (req, res, next) => {
  const fs = await import("fs");
  const htmlPath = path.join(publicDir, "index.html");
  fs.readFile(htmlPath, "utf8", (err, html) => {
    if (err) return next(err);
    const nonce = res.locals.nonce;
    const out = html.replaceAll("__NONCE__", nonce);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(out);
  });
});

// --------- uploads stub (you already had this; keep or swap to your real handler)
const upload = multer({ dest: path.join(publicDir, "uploads") });
app.post("/api/upload", upload.single("file"), (req, res) => {
  res.json({ ok: true, path: `/uploads/${req.file.filename}` });
});

// --------- start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Ameba server listening on http://localhost:${PORT}`);
});







