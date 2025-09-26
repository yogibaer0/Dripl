// server.js — Dripl (ESM, multi-site, cookies+proxy aware)

import express from "express";
import helmet from "helmet";
import cors from "cors";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

import ffmpegStatic from "ffmpeg-static";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

// ---------------- paths & setup ----------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC = path.join(__dirname, "public");
const OUT = path.join(PUBLIC, "out");
for (const d of [PUBLIC, OUT]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

const FFMPEG_BIN = (ffmpegStatic || "").toString().replace(/\\/g, "/") || "";
const FFPROBE_BIN = (ffprobeInstaller?.path || "").toString().replace(/\\/g, "/") || "";
const sep = process.platform === "win32" ? ";" : ":";
process.env.PATH = [
  path.dirname(FFMPEG_BIN || ""),
  path.dirname(FFPROBE_BIN || ""),
  process.env.PATH || ""
].filter(Boolean).join(sep);
process.env.FFMPEG_PATH = FFMPEG_BIN;
process.env.FFPROBE_PATH = FFPROBE_BIN;

function resolveYtDlp() {
  if (process.platform === "win32") {
    const exe = path.join(__dirname, "yt-dlp.exe");
    if (fs.existsSync(exe)) return exe;
  }
  return "yt-dlp";
}
const YTDLP_BIN = resolveYtDlp();

// ---------------- config: hosts / extras / limits ----------------
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS ||
  "youtube.com,youtu.be,tiktok.com,vm.tiktok.com,twitter.com,x.com,instagram.com,instagr.am,soundcloud.com,vimeo.com")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

function isAllowedUrl(input) {
  try {
    const u = new URL(input);
    return ALLOWED_HOSTS.some(h => u.hostname.toLowerCase().endsWith(h));
  } catch { return false; }
}

// Per-host defaults (overridden by env if you set YTDLP_EXTRACTOR_ARGS / YTDLP_UA)
const HOST_EXTRAS = {
  "youtube.com": { extractorArgs: "youtube:player_client=web", ua: null },
  "youtu.be":    { extractorArgs: "youtube:player_client=web", ua: null },
  // Add tweaks per host below as you learn them:
  // "tiktok.com": { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) Mobile/15E148 Safari/604.1" },
};

const COOKIE_CYCLE_MAX = Number(process.env.COOKIE_CYCLE_MAX || 0); // 0 = unlimited

// circuit breaker for upstream 429s (per host)
const CB_FAILS = Number(process.env.CB_FAILS || 3);
const CB_WINDOW_MS = Number(process.env.CB_WINDOW_MS || 2 * 60 * 1000);
const hostBreaker = new Map(); // host -> { fails, ts }
function is429(s = "") { return /http error 429|too many requests/i.test(s); }
function shouldBlockHost(host) {
  const e = hostBreaker.get(host);
  return !!e && e.fails >= CB_FAILS && (Date.now() - e.ts) < CB_WINDOW_MS;
}
function noteFail(host) {
  const e = hostBreaker.get(host) || { fails: 0, ts: 0 };
  e.fails++; e.ts = Date.now(); hostBreaker.set(host, e);
  setTimeout(() => {
    const cur = hostBreaker.get(host);
    if (cur && (Date.now() - cur.ts) >= CB_WINDOW_MS) hostBreaker.delete(host);
  }, CB_WINDOW_MS + 1000);
}
function noteOk(host) { hostBreaker.delete(host); }

// ---------------- cookie pool ----------------
function b64ToText(b64) { return Buffer.from(b64.replace(/\s+/g, ""), "base64").toString("utf8"); }
function hashId(text) { return crypto.createHash("sha256").update(text).digest("hex").slice(0, 8); }

function loadCookiePoolFromEnv() {
  const raw = (process.env.COOKIE_POOL_B64 || "").trim();
  if (!raw) return [];
  return raw.split(",").map(s => s.trim()).filter(Boolean).map(b64ToText);
}
let COOKIE_POOL = loadCookiePoolFromEnv();
let COOKIE_META = [];
let COOKIE_IDX = 0;
function rebuildCookieMeta() {
  COOKIE_META = COOKIE_POOL.map((txt, i) => ({
    id: hashId(txt), idx: i, ok: 0, fail: 0, lastOk: null, lastFail: null
  }));
}
rebuildCookieMeta();

async function writeTempCookies(text) {
  const p = path.join("/tmp", `cookies-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  await fsp.writeFile(p, text, "utf8");
  return p;
}
async function nextCookiePathOrNull() {
  if (!COOKIE_POOL.length) return null;
  const i = COOKIE_IDX % COOKIE_POOL.length;
  COOKIE_IDX = (COOKIE_IDX + 1) % COOKIE_POOL.length;
  const txt = COOKIE_POOL[i];
  const id = COOKIE_META[i]?.id || "????????";
  const p = await writeTempCookies(txt);
  return { path: p, idx: i, id };
}
async function reloadCookiePool(newPoolB64) {
  COOKIE_POOL = (newPoolB64 || "")
    .split(",").map(s => s.trim()).filter(Boolean).map(b64ToText);
  COOKIE_IDX = 0;
  rebuildCookieMeta();
  return COOKIE_POOL.length;
}

// ---------------- helpers ----------------
function spawnYtDlp(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_BIN, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "", stderr = "";
    child.stdout.on("data", d => (stdout += d.toString()));
    child.stderr.on("data", d => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) return resolve({ code, stdout, stderr });
      const e = new Error(`yt-dlp exit ${code}`);
      e.code = code; e.stdout = stdout; e.stderr = stderr;
      reject(e);
    });
  });
}

async function withTimeout(promise, ms, label="task") {
  let t;
  const timeout = new Promise((_, rej) => t = setTimeout(() => rej(new Error(`timeout:${label}:${ms}ms`)), ms));
  try { return await Promise.race([promise, timeout]); }
  finally { clearTimeout(t); }
}

function pickProxyArg() {
  const pool = (process.env.PROXY_POOL || "").split(",").map(s => s.trim()).filter(Boolean);
  if (pool.length) return ["--proxy", pool[Math.floor(Math.random() * pool.length)]];
  const url = (process.env.YTDLP_PROXY || process.env.PROXY_URL || "").trim();
  return url ? ["--proxy", url] : [];
}

function hostConfigFor(url) {
  const u = new URL(url);
  const host = u.hostname.toLowerCase();
  const base = { extractorArgs: null, ua: null };
  for (const key of Object.keys(HOST_EXTRAS)) {
    if (host.endsWith(key)) return { host, ...base, ...HOST_EXTRAS[key] };
  }
  return { host, ...base };
}

async function runYtDlp({ url, kind, cookiesPath }) {
  fs.mkdirSync(OUT, { recursive: true });
  const outTpl = path.join(OUT, "dripl-%(id)s.%(ext)s");

  const { host, extractorArgs: hostEA, ua: hostUA } = hostConfigFor(url);

  const ua = (process.env.YTDLP_UA || hostUA ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

  // Prefer env YTDLP_EXTRACTOR_ARGS, else host default, else none.
  const extractorArgs = (process.env.YTDLP_EXTRACTOR_ARGS || hostEA || "").trim();

  // Pseudo-diff of the important bits
const baseArgs = [
  "--no-color", "--no-playlist", "--ignore-errors", "--abort-on-error",
  "--geo-bypass", "--no-progress",
  "--ffmpeg-location", FFMPEG_BIN,
  "--concurrent-fragments", "1", "--retry-sleep", "1",
  "--retries", "3", "--fragment-retries", "3"
];

const desktopHeaders = [
  "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "--add-header", "Referer:https://www.youtube.com/",
  "--add-header", "Accept-Language:en-US,en;q=0.9"
];

const androidClient = [
  // only for **no-cookies** path
  "--extractor-args", "youtube:player_client=android"
];

// …
const useCookies = !!cookiesPath;
const args = [
  ...baseArgs,
  ...(useCookies ? desktopHeaders : androidClient),
  ...(useCookies ? ["--cookies", cookiesPath] : []),
  // proxy gets applied in both branches
  ...(proxyUrl ? ["--proxy", proxyUrl] : []),
  // format selection as you had it
  ...(kind === "mp3" ? ["-f","bestaudio", "--extract-audio","--audio-format","mp3"]
                     : ["-f","bv*+ba/b", "-S","codec:avc:m4a,res,ext", "--merge-output-format","mp4"]),
  "-o", outTpl,
  url
];


  // find newest file within last 2 mins
  const now = Date.now();
  const candidates = (await fsp.readdir(OUT))
    .map(n => {
      const p = path.join(OUT, n);
      return { p, t: fs.statSync(p).mtimeMs };
    })
    .filter(f => now - f.t < 120000)
    .sort((a, b) => b.t - a.t);

  if (!candidates.length) throw new Error("Download finished but no file found.");
  return { path: candidates[0].p, host };
}

// ---------------- app ----------------
const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ---- lightweight metrics (in-memory) ----
const METRICS = {
  startedAt: new Date().toISOString(),
  totals: { requests: 0, success: 0, clientErr: 0, serverErr: 0 },
  uniques24h: new Map(), // ip -> lastSeen
  byDay: new Map(),      // day -> { requests, success }
  maxUniqueWindowMs: 24 * 60 * 60 * 1000,
};
function dayKey(d=new Date()){ return d.toISOString().slice(0,10); }
function bumpDay(key, field){ const row = METRICS.byDay.get(key)||{requests:0,success:0}; row[field]++; METRICS.byDay.set(key,row); }
function recordHit(req){
  METRICS.totals.requests++; bumpDay(dayKey(),"requests");
  const ip = req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress || "unknown";
  METRICS.uniques24h.set(String(ip), Date.now());
  const cutoff = Date.now()-METRICS.maxUniqueWindowMs;
  for (const [k,t] of METRICS.uniques24h) if (t<cutoff) METRICS.uniques24h.delete(k);
}
function recordSuccess(){ METRICS.totals.success++; bumpDay(dayKey(),"success"); }
function recordError(status){ if(status>=500) METRICS.totals.serverErr++; else if(status>=400) METRICS.totals.clientErr++; }
app.use((req,_res,next)=>{ recordHit(req); next(); });

// health & version
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ffmpeg: !!FFMPEG_BIN, ffprobe: !!FFPROBE_BIN, ytdlp: YTDLP_BIN });
});
app.get("/api/version", (_req, res) => {
  res.json({ commit: process.env.RENDER_GIT_COMMIT || "local", time: new Date().toISOString(), cookiePool: COOKIE_POOL.length });
});

// ----- admin auth helper -----
function adminOk(req) {
  const headerToken = String(req.headers["x-admin-token"] || "").trim();
  const envToken = String(process.env.ADMIN_TOKEN || "").trim();
  return !!envToken && headerToken === envToken;
}

// ----- admin: ping / reload / status / reset / stats / metrics -----
app.get("/api/admin/ping", (req, res) => {
  if (!adminOk(req)) return res.status(401).end();
  res.json({ ok: true });
});
app.post("/api/admin/cookies/reload", async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  const { cookiePoolB64 } = req.body || {};
  const count = await reloadCookiePool(cookiePoolB64 || "");
  res.json({ ok: true, count });
});
app.get("/api/admin/cookies/status", (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false });
  res.json({ ok: true, size: COOKIE_POOL.length, stats: COOKIE_META });
});
app.post("/api/admin/cookies/reset", (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false });
  COOKIE_META.forEach(m => { m.ok = 0; m.fail = 0; m.lastOk = null; m.lastFail = null; });
  res.json({ ok: true, size: COOKIE_POOL.length });
});
function cookieRollups() {
  return COOKIE_META.map(m => ({
    id: m.id, idx: m.idx, ok: m.ok, fail: m.fail,
    okRate: (m.ok+m.fail)? +(m.ok/(m.ok+m.fail)).toFixed(3) : null,
    lastOk: m.lastOk, lastFail: m.lastFail
  }));
}
app.get("/api/admin/cookies/stats", (req,res)=>{
  if (!adminOk(req)) return res.status(401).json({ ok: false });
  const rows = cookieRollups().sort((a,b)=>(b.ok-a.ok)||(a.fail-b.fail));
  res.json({ ok:true, size: COOKIE_POOL.length, rows });
});
app.get("/api/admin/metrics", (req,res)=>{
  if (!adminOk(req)) return res.status(401).json({ ok: false });
  const daily = [...METRICS.byDay.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-7)
                  .map(([day,row])=>({day,...row}));
  res.json({ ok:true, startedAt: METRICS.startedAt, totals: METRICS.totals,
             uniqueIPs24h: METRICS.uniques24h.size, last7Days: daily });
});

// ----- convert -----
app.post("/api/convert", async (req, res) => {
  const { url, kind } = req.body || {};
  if (!url) { recordError(400); return res.status(400).json({ ok: false, error: "Paste a link to start." }); }
  if (!isAllowedUrl(url)) { recordError(400); return res.status(400).json({ ok:false, error:"unsupported_site", allowed: ALLOWED_HOSTS }); }
  const fmt = (kind || "mp4").toLowerCase();
  if (!["mp3","mp4"].includes(fmt)) { recordError(400); return res.status(400).json({ ok:false, error:"Invalid format." }); }

  const host = new URL(url).hostname.toLowerCase();
  if (shouldBlockHost(host)) { recordError(429); return res.status(429).json({ ok:false, error:"cooldown", retryAfterMs: CB_WINDOW_MS }); }

  const maxCycles = COOKIE_CYCLE_MAX;
  const totalTries = (maxCycles && maxCycles>0) ? Math.min(maxCycles, Math.max(1, COOKIE_POOL.length)) + 1
                                                : Math.max(1, COOKIE_POOL.length) + 1;

  for (let i = 0; i < totalTries; i++) {
    let cookieInfo = null;
    try {
      cookieInfo = (i < Math.max(1, COOKIE_POOL.length)) ? await nextCookiePathOrNull() : null;
      const label = cookieInfo ? `cookie#${cookieInfo.idx + 1}/${COOKIE_POOL.length}(${COOKIE_META[cookieInfo.idx]?.id})` : "no-cookies";
      console.log(`[convert] attempt ${i+1}/${totalTries} using ${label}`);

      const { path: abs } = await withTimeout(
        runYtDlp({ url, kind: fmt, cookiesPath: cookieInfo?.path }),
        4 * 60 * 1000,
        "yt-dlp"
      );
      const file = path.basename(abs);
      const publicPath = `/out/${file}`;
      console.log(`[convert] SUCCESS via ${label} -> ${publicPath}`);

      if (cookieInfo) {
        const m = COOKIE_META[cookieInfo.idx];
        if (m) { m.ok++; m.lastOk = new Date().toISOString(); }
      }
      noteOk(host);
      recordSuccess();
      return res.json({ ok: true, url: publicPath, file });

    } catch (err) {
      const stderr = String(err?.stderr || "");
      const s = stderr.toLowerCase();
      let reason = "unknown";
      if (s.includes("confirm you're not a bot") || s.includes("sign in to confirm")) reason = "verification";
      else if (s.includes("age restricted")) reason = "age-restricted";
      else if (s.includes("forbidden") || s.includes("http error 403")) reason = "403-forbidden";
      else if (s.includes("http error 429")) reason = "429-rate";
      else if (s.includes("account cookies are no longer valid")) reason = "cookies-invalid";
      if (is429(s)) noteFail(host);

      const label = cookieInfo ? `cookie#${cookieInfo.idx + 1}/${COOKIE_POOL.length}(${COOKIE_META[cookieInfo.idx]?.id})` : "no-cookies";
      console.error(`[convert] FAIL via ${label}; reason=${reason}; code=${err?.code ?? "?"}`);
      if (stderr) console.error("[yt-dlp:stderr]", stderr.slice(0, 600));

      if (cookieInfo) {
        const m = COOKIE_META[cookieInfo.idx];
        if (m) { m.fail++; m.lastFail = new Date().toISOString(); }
      }
      if (reason !== "unknown" && i + 1 < totalTries) continue;
      break;
    } finally {
      try { if (cookieInfo?.path) await fsp.unlink(cookieInfo.path); } catch {}
    }
  }
  console.error("[convert] all attempts exhausted");
  recordError(502);
  return res.status(502).json({ ok: false, error: "We’re refreshing access—try again in a moment." });
});

// static
app.use(express.static(PUBLIC, { extensions: ["html"] }));

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log("FFMPEG:", FFMPEG_BIN || "(not found)");
  console.log("FFPROBE:", FFPROBE_BIN || "(not found)");
  console.log("YTDLP_BIN:", YTDLP_BIN);
  console.log("CookiePool size:", COOKIE_POOL.length);
  console.log(`Listening on http://${HOST}:${PORT}`);
});










