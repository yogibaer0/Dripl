// server/server.js
import express from "express";
import path from "path";
import crypto from "node:crypto";
import helmet from "helmet";
import cors from "cors";
import multer from "multer";
import morgan from "morgan";
import fs from "node:fs/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* -------------------------- secure headers (inline) ------------------------- */
function secureHeaders() {
  return (req, res, next) => {
    const nonce = crypto.randomBytes(16).toString("base64");
    res.locals.nonce = nonce;

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",

      // Scripts (nonce + our trusted CDNs/APIs)
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://cdn.jsdelivr.net https://*.supabase.co https://www.youtube.com https://*.googleapis.com https://apis.google.com https://*.gstatic.com https://*.googleusercontent.com https://*.dropboxapi.com https://*.dropbox.com`,
      `script-src-elem 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net https://*.supabase.co https://www.youtube.com https://*.googleapis.com https://apis.google.com https://*.gstatic.com https://*.googleusercontent.com https://*.dropboxapi.com https://*.dropbox.com`,

      // Network calls
      "connect-src 'self' https://*.supabase.co https://cdn.jsdelivr.net https://www.googleapis.com https://content.googleapis.com https://*.googleapis.com https://*.dropboxapi.com https://*.dropbox.com https://studio.dripl.io http://localhost:8080",

      // Embeds
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://*.google.com https://drive.google.com https://*.dropbox.com",

      // Assets
      "img-src 'self' data: blob: https://i.ytimg.com https://*.googleusercontent.com https://*.dropboxusercontent.com https://cdn.jsdelivr.net",
      "media-src 'self' https: blob:",
      `style-src 'self' 'nonce-${nonce}'`,
      "font-src 'self' data:",
      "worker-src 'self' blob:",

      // Misc
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
      "report-sample",
    ].join("; ");

    res.setHeader("Content-Security-Policy", csp);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(), camera=(), microphone=(), interest-cohort=()"
    );
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");

    next();
  };
}
/* --------------------------------------------------------------------------- */

// core middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("tiny"));
app.disable("x-powered-by");

// helmet (we provide CSP ourselves)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-site" },
    frameguard: { action: "sameorigin" },
    referrerPolicy: { policy: "no-referrer" },
  })
);

// our secure headers + nonce
app.use(secureHeaders());

// static files
const publicDir = path.join(__dirname, "..", "public");
app.use(
  express.static(publicDir, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      }
      if (filePath.endsWith(".wasm")) {
        res.setHeader("Content-Type", "application/wasm");
      }
    },
  })
);

// index.html → inject {{NONCE}}
app.get("/", async (req, res, next) => {
  try {
    const html = await fs.readFile(path.join(publicDir, "index.html"), "utf8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html.replaceAll("{{NONCE}}", res.locals.nonce));
  } catch (err) {
    next(err);
  }
});

// destination API
const upload = multer({ dest: path.join(publicDir, "uploads") });

app.post("/api/destination/upload", upload.single("file"), (req, res) => {
  res.json({
    ok: true,
    url: `/uploads/${req.file.filename}`,
    id: req.file.filename,
    name: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype?.startsWith("audio") ? "audio" : "video",
    source: "local",
  });
});

app.post("/api/destination/convert-link", async (req, res) => {
  const { url, out } = req.body || {};
  if (!url) return res.status(400).json({ error: "url required" });
  const id = crypto.randomUUID();
  res.json({
    id,
    name: (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return "link";
      }
    })(),
    size: 0,
    type: out === "mp3" ? "audio" : "video",
    source: "link",
    url: null, // stub until pipeline returns a CDN URL
  });
});

app.get("/api/destination/recent", async (_req, res) => {
  res.json([]); // fill when DB is wired
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Ameba server listening on http://localhost:${PORT}`);
});









