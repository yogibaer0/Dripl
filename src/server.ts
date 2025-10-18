// src/server.ts
import express from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const app = express();

const port = Number(process.env.PORT || 10000);
const publicDir = path.join(process.cwd(), "public");
const indexPath = path.join(publicDir, "index.template.html");
const sriPath = path.join(publicDir, "vendor", "supabase.min.js.sri"); // created at build
const indexTemplate = fs.readFileSync(indexPath, "utf8");
const SUPABASE_SRI = fs.existsSync(sriPath) ? fs.readFileSync(sriPath, "utf8").trim() : "";

// tiny nonce helper
function makeNonce() {
  return crypto.randomBytes(16).toString("base64");
}

// basic health
app.get(["/healthz", "/health"], (_req, res) => res.type("text/plain").send("ok"));

// per-request nonce + security headers (CSP allowlist is narrow but practical)
app.use((req, res, next) => {
  const nonce = makeNonce();
  (res.locals as any).nonce = nonce;

  // trusted 3P endpoints you actually use
  const supabase = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const connect = ["'self'"];
  if (supabase) connect.push(supabase);
  if (process.env.API_BASE) connect.push(process.env.API_BASE);

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'`,              // local UMD + your app (no wildcards)
    `style-src 'self' 'unsafe-inline'`,               // keep simple; move inline CSS to files when convenient
    `img-src 'self' data: ${supabase}`,               // allow supabase storage thumbs if needed
    `connect-src ${connect.join(" ")}`,               // XHR/WS to self + supabase + your api
    `font-src 'self' data:`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer-when-downgrade");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  next();
});

// serve static first (so /vendor/supabase.min.js is same-origin)
app.use(express.static(publicDir, {
  fallthrough: true,
  setHeaders(res, filePath) {
    // small cache for static assets; html stays dynamic via route below
    if (!filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "public, max-age=3600");
    }
  }
}));

// template inject (root + SPA catch-all; adjust if you add API routes)
app.get(["/", "/:anything(*)"], (req, res, next) => {
  try {
    const nonce = (res.locals as any).nonce;
    let html = indexTemplate
      .replaceAll("{{NONCE}}", nonce)
      .replaceAll("{{SUPABASE_URL}}", process.env.SUPABASE_URL ?? "")
      .replaceAll("{{SUPABASE_ANON_KEY}}", process.env.SUPABASE_ANON_KEY ?? "")
      .replaceAll("{{API_BASE}}", process.env.API_BASE ?? "")
      .replaceAll("{{SUPABASE_SRI}}", SUPABASE_SRI);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// basic error output (won’t leak stack in prod if NODE_ENV=production)
app.use((err: any, _req, res, _next) => {
  console.error(err);
  res.status(500).type("text/plain").send(process.env.NODE_ENV === "production" ? "Internal error" : String(err));
});

app.listen(port, () => {
  console.log(`[dripl] listening on :${port}`);
});



