// server.ts
import express from "express";
import path from "path";
import fs from "fs/promises";
import * as fssync from "fs";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use process.cwd() so paths work the same on Render and locally
const publicDir = path.resolve(process.cwd(), "public");
const tplPath = path.join(publicDir, "index.template.html");

const app = express();
app.set("trust proxy", 1);

// Basic middleware
app.use(cors());
app.use(morgan("tiny"));

// Per-request nonce
app.use((req, res, next) => {
  const nonce = Math.random().toString(36).slice(2);
  (res.locals as any).nonce = nonce;
  next();
});

// Helmet with a pragmatic CSP (allows our CDNs + Supabase)
app.use((req, res, next) => {
  const nonce = (res.locals as any).nonce;
  const supabaseUrl = process.env.SUPABASE_URL || "";
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", `'nonce-${nonce}'`, "https://cdn.jsdelivr.net", "https://unpkg.com"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'", supabaseUrl || "*"],
        "font-src": ["'self'", "data:"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "frame-ancestors": ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })(req, res, next);
});

// Health check for Render
app.get("/healthz", (_req, res) => res.status(200).type("text/plain").send("ok"));

// Serve injected HTML for any non-API route
app.get(/^\/(?!api\/).*/, async (_req, res) => {
  try {
    let html = await fs.readFile(tplPath, "utf8");
    html = html
      .replaceAll("{{NONCE}}", (res.locals as any).nonce ?? "")
      .replaceAll("{{SUPABASE_URL}}", process.env.SUPABASE_URL ?? "")
      .replaceAll("{{SUPABASE_ANON_KEY}}", process.env.SUPABASE_ANON_KEY ?? "")
      .replaceAll("{{API_BASE}}", process.env.API_BASE ?? "");
    res.setHeader("X-Dripl-Injected", "1");
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(html);
  } catch (err) {
    console.error("[index] template read failed:", err);
    // Serve a safe fallback so health check doesn’t fail
    res
      .status(200)
      .type("html")
      .send("<!doctype html><meta charset=utf-8><title>Dripl</title><h1>Dripl</h1><p>Template missing.</p>");
  }
});

// Static AFTER injection; never auto-serve index.html
app.use(
  express.static(publicDir, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".js") || filePath.endsWith(".mjs"))
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      if (filePath.endsWith(".wasm")) res.setHeader("Content-Type", "application/wasm");
    },
  })
);

// Ensure uploads exists
const uploadsDir = path.join(publicDir, "uploads");
if (!fssync.existsSync(uploadsDir)) fssync.mkdirSync(uploadsDir, { recursive: true });

// Start
const PORT = Number(process.env.PORT) || 8080;
app.listen(PORT, () => console.log(`[dripl] listening on :${PORT}`));

