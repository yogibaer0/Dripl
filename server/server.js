// server/server.js
import express from "express";
import path from "path";
import crypto from "node:crypto";
import helmet from "helmet";
import cors from "cors";
import multer from "multer";
import morgan from "morgan";
import { fileURLToPath } from "url";
import fs from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ----- basics
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("tiny"));
app.disable("x-powered-by");

// ----- per-request nonce
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString("base64");
  next();
});

// ----- Helmet (keep our own CSP)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    frameguard: { action: "sameorigin" },
    referrerPolicy: { policy: "no-referrer" },
  })
);

// ----- CSP using the nonce
app.use((req, res, next) => {
  const nonce = res.locals.nonce;

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net`,
    `script-src-elem 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net https://dripl.onrender.com https://studio.dripl.io`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `img-src 'self' data: blob: https://*.supabase.co`,
    `media-src 'self' data: blob:`,
    `worker-src 'self' blob:`,
    `frame-src 'self' https://accounts.google.com https://*.google.com https://*.googleusercontent.com https://*.dropbox.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'self'`,
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);
  next();
});

// ----- static
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

// ----- inject nonce into HTML
app.get("/", async (req, res, next) => {
  try {
    const htmlPath = path.join(publicDir, "index.html");
    const html = await fs.readFile(htmlPath, "utf8");
    const out = html.replaceAll("{{NONCE}}", res.locals.nonce);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(out);
  } catch (err) {
    next(err);
  }
});

// ----- API used by the frontend (Destination Hub stubs)
const upload = multer({ dest: path.join(publicDir, "uploads") });

app.post("/api/destination/upload", upload.single("file"), (req, res) => {
  res.json({
    ok: true,
    url: `/uploads/${req.file.filename}`,
    id: req.file.filename,
    name: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype.startsWith("audio") ? "audio" : "video",
    source: "local",
  });
});

app.post("/api/destination/convert-link", async (req, res) => {
  // placeholder—wire to ytdlp/worker later
  const { url, out } = req.body || {};
  if (!url) return res.status(400).json({ error: "url required" });
  const id = crypto.randomUUID();
  res.json({
    id,
    name: new URL(url).hostname,
    size: 0,
    type: out === "mp3" ? "audio" : "video",
    source: "link",
    url: null, // when ready, return CDN link
  });
});

app.get("/api/destination/recent", async (_req, res) => {
  // return recent items (placeholder)
  res.json([]);
});

// ----- start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Ameba server listening on http://localhost:${PORT}`);
});








