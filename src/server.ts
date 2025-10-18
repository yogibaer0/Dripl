/**
 * ──────────────────────────────────────────────────────────────────────────────
 *  DRIPL SERVER (Ameba)
 *  Purpose: Serve static assets, inject env into HTML, provide health check,
 *           and apply basic security headers.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import express, { Request, Response, NextFunction } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import helmet from "helmet";
import morgan from "morgan";

// ── LABEL: Paths ───────────────────────────────────────────────────────────────
const rootDir   = process.cwd();                       // repo root
const publicDir = path.join(rootDir, "public");        // where styles.css, script.js, favicon.ico live
const tplPath   = path.join(publicDir, "index.template.html");

// ── LABEL: App init ───────────────────────────────────────────────────────────
const app  = express();
const PORT = Number(process.env.PORT) || 8080;

// ── LABEL: Security middleware ────────────────────────────────────────────────
// Basic, modern Helmet (no CSP by default; we set a nonce manually below)
app.use(helmet({
  referrerPolicy: { policy: "no-referrer" },
  frameguard:     { action: "deny" },
  xssFilter:      false
}));

// Request logging
app.use(morgan("tiny"));

// ── LABEL: Nonce for inline-safe scripts ──────────────────────────────────────
// We generate a request-scoped nonce that the HTML uses in <script nonce="...">
app.use((_req: Request, res: Response, next: NextFunction) => {
  (res.locals as any).nonce = Buffer.from(cryptoRandom(16)).toString("base64url");
  next();
});

function cryptoRandom(n: number): Uint8Array {
  // Node 20: globalThis.crypto exists
  const a = new Uint8Array(n);
  globalThis.crypto.getRandomValues(a);
  return a;
}

// ── LABEL: Static assets FIRST (prevents MIME/type issues) ────────────────────
// Important: serve public assets before the HTML catch-all.
app.use(express.static(publicDir, {
  index: false,          // we control index via the template route below
  extensions: false,
  fallthrough: true
}));

// ── LABEL: Health check (Render) ──────────────────────────────────────────────
app.get("/healthz", (_req, res) => res.status(200).type("text").send("ok"));

// ── LABEL: Minimal API examples (optional placeholders) ───────────────────────
// Keep /api namespace out of the HTML catch-all below.
app.get("/api/ping", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ── LABEL: HTML catch-all (non-file URLs only) ────────────────────────────────
// This route injects env into the template. The regex excludes URLs with a dot
// like /script.js, /styles.css, /favicon.ico so static can handle those.
app.get(/^\/(?!api\/)(?!.*\.[a-zA-Z0-9]+$).*/, async (_req, res, next) => {
  try {
    // 1) Read template
    let html = await fs.readFile(tplPath, "utf8");

    // 2) Inject env + nonce
    //    If your tsconfig target < ES2021, swap to regex: html = html.replace(/{{NONCE}}/g, ...)
    html = html
      .replaceAll("{{NONCE}}",              (res.locals as any).nonce ?? "")
      .replaceAll("{{SUPABASE_URL}}",       process.env.SUPABASE_URL       ?? "")
      .replaceAll("{{SUPABASE_ANON_KEY}}",  process.env.SUPABASE_ANON_KEY  ?? "")
      .replaceAll("{{API_BASE}}",           process.env.API_BASE           ?? "");

    // 3) Return with an explicit content-type (fixes module/CSS MIME warnings)
    res.setHeader("X-Dripl-Injected", "1");
    res.type("html").send(html);
  } catch (err) {
    next(err);
  }
});

// ── LABEL: Error handling ─────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[server] error:", err);
  if (!res.headersSent) res.status(500).json({ error: "server_error" });
});

// ── LABEL: Listen ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[dripl] listening on :${PORT}`);
});


