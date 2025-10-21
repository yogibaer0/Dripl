// src/server.ts
import express from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { createClient as createRedisClient } from "redis";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";


const app = express();

const port = Number(process.env.PORT || 10000);
const publicDir = path.join(process.cwd(), "public");
const indexPath = path.join(publicDir, "index.template.html");
const sriPath = path.join(publicDir, "vendor", "supabase.min.js.sri"); // created at build
const indexTemplate = fs.readFileSync(indexPath, "utf8");
const SUPABASE_SRI = fs.existsSync(sriPath) ? fs.readFileSync(sriPath, "utf8").trim() : "";

// ---- Redis + Supabase helpers (non-breaking) ----
let _redis: any = null;

async function getRedis() {
  if (!_redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("Missing REDIS_URL");
    _redis = createRedisClient({ url });
    _redis.on("error", (e: any) => console.error("[redis] error:", e));
    await _redis.connect();
  }
  return _redis;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}


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

// Health: Redis ping (your existing /health stays as is)
app.get("/health/redis", async (_req, res) => {
  try {
    const redis = await getRedis();
    const pong = await redis.ping();
    res.json({ ok: true, redis: pong, now: Date.now() });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Example cache endpoints (TTL set; safe under volatile-ttl)
app.post("/cache/thumb", express.json(), async (req, res) => {
  try {
    const { mediaId, meta, ttlSec = 3600 } = req.body || {};
    if (!mediaId || !meta) return res.status(400).json({ ok: false, error: "mediaId and meta required" });
    const redis = await getRedis();
    await redis.set(`thumb:${mediaId}`, JSON.stringify(meta), { EX: ttlSec });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get("/cache/thumb/:mediaId", async (req, res) => {
  try {
    const redis = await getRedis();
    const raw = await redis.get(`thumb:${req.params.mediaId}`);
    res.json({ ok: true, meta: raw ? JSON.parse(raw) : null });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Supabase keepalive (for Render Cron)
app.get("/keepalive", async (_req, res) => {
  try {
    const sb = getSupabase();
    await sb.auth.getSession();              // cheap "poke" to keep project warm
    const redis = await getRedis().catch(() => null);
    if (redis) await redis.set("supabase:last_keepalive", String(Date.now()), { EX: 60 * 60 * 24 });
    res.json({ ok: true, t: Date.now() });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e) });
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



