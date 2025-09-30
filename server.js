// server.js (ESM)
// Node 20+, "type": "module"

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { spawn } from "node:child_process";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Config / ENV =====
const PORT = Number(process.env.PORT || 10000);
const STATIC_DIR = path.join(__dirname, "public");
const COOKIES_DIR = process.env.COOKIES_DIR || "/app/cookies";
const TT_COOKIE_PATH = path.join(COOKIES_DIR, "tiktok.txt");
const YT_COOKIE_PATH = path.join(COOKIES_DIR, "youtube.txt");

const COOKIE_TIKTOK_URL = process.env.COOKIE_TIKTOK_URL || "";
const COOKIE_YOUTUBE_URL = process.env.COOKIE_YOUTUBE_URL || "";
const COOKIE_TIKTOK_HEADERS = safeParseJSON(process.env.COOKIE_TIKTOK_HEADERS);
const COOKIE_YOUTUBE_HEADERS = safeParseJSON(process.env.COOKIE_YOUTUBE_HEADERS);
const GITHUB_TOKEN = (process.env.GITHUB_TOKEN || "").trim();

const PROXY_URL = (process.env.PROXY_URL || "").trim();

const YTDLP_UA = process.env.YTDLP_UA || ""; // set your stable UA here if desired
const YTDLP_EXTRACTOR_ARGS = process.env.YTDLP_EXTRACTOR_ARGS || "youtube:player_client=android";

const ADMIN_TOKEN = (process.env.ADMIN_TOKEN || "").trim();

const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || "";
const ALERT_MIN_ERRORS = Number(process.env.ALERT_MIN_ERRORS || 5);
const ALERT_WINDOW_SEC = Number(process.env.ALERT_WINDOW_SEC || 300);
const ALERT_COOLDOWN_SEC = Number(process.env.ALERT_COOLDOWN_SEC || 900);
const COOKIE_REFRESH_HOURS = Number(process.env.COOKIE_REFRESH_HOURS || 6);

// ===== Helpers =====
function safeParseJSON(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}
function ensureDirSync(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
ensureDirSync(COOKIES_DIR);

function nowSec() { return Math.floor(Date.now() / 1000); }
function isYouTubeUrl(u) { return /youtube\.com|youtu\.be/i.test(u); }
function isTikTokUrl(u) { return /tiktok\.com/i.test(u); }

// ===== Monitoring & Alerts =====
const errBuckets = { youtube: [], tiktok: [] };
let lastAlertAt = { youtube: 0, tiktok: 0 };

function pushError(provider, detail) {
  const ts = nowSec();
  const bucket = errBuckets[provider];
  bucket.push({ ts, detail: String(detail || "").slice(0, 500) });
  while (bucket.length && bucket[0].ts < ts - ALERT_WINDOW_SEC) bucket.shift();
}
function windowErrorCount(provider) {
  const ts = nowSec();
  return errBuckets[provider].filter(e => e.ts >= ts - ALERT_WINDOW_SEC).length;
}
async function maybeAlert(provider, sampleError) {
  try {
    const count = windowErrorCount(provider);
    if (count < ALERT_MIN_ERRORS) return;
    const ts = nowSec();
    if (ts - lastAlertAt[provider] < ALERT_COOLDOWN_SEC) return;
    lastAlertAt[provider] = ts;

    const msg = `[dripl] High ${provider.toUpperCase()} failure rate: ${count} errors in last ${ALERT_WINDOW_SEC}s. Example: ${String(sampleError || "").slice(0, 300)}`;
    if (!ALERT_WEBHOOK_URL) {
      console.warn(msg);
      return;
    }
    await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Discord-compatible payload (also works for Slack via "text")
      body: JSON.stringify({ content: msg, username: "dripl" })
    });
  } catch (e) {
    console.warn("[dripl] alert send failed:", e.message || e);
  }
}

const YT_COOKIE_PATTERNS = [
  "Sign in to confirm you’re not a bot",
  "Sign in to confirm you're not a bot",
  "HTTP Error 410",
  "Login required",
  "YouTube said: This video is only available to Music Premium",
  "Unable to extract",
];
const TT_COOKIE_PATTERNS = [
  "Login required",
  "403 Forbidden",
  "Please sign in",
];

function looksLikeCookieError(provider, stderr) {
  const hay = (stderr || "").toString();
  const patt = provider === "youtube" ? YT_COOKIE_PATTERNS : TT_COOKIE_PATTERNS;
  return patt.some(p => hay.includes(p));
}

// ===== Cookie fetch from Remote (GitHub or any HTTPS) =====
function headersForUrl(url, explicitHeaders) {
  // Priority: explicit JSON headers -> GITHUB_TOKEN -> none
  if (explicitHeaders && typeof explicitHeaders === "object") return explicitHeaders;
  const h = { };
  if (GITHUB_TOKEN && /api\.github\.com\/repos/i.test(url)) {
    h.Authorization = `Bearer ${GITHUB_TOKEN}`;
    h.Accept = "application/vnd.github.v3.raw";
  }
  return h;
}

async function fetchToFile(url, headers, destPath) {
  if (!url) return false;
  const res = await fetch(url, { headers: headers || {} });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fsp.writeFile(destPath, buf);
  return buf.length;
}

async function refreshCookiesFromRemote() {
  const results = { tiktok: { ok:false, len:0, path:TT_COOKIE_PATH }, youtube: { ok:false, len:0, path:YT_COOKIE_PATH } };
  try {
    if (COOKIE_TIKTOK_URL) {
      const len = await fetchToFile(
        COOKIE_TIKTOK_URL,
        headersForUrl(COOKIE_TIKTOK_URL, COOKIE_TIKTOK_HEADERS),
        TT_COOKIE_PATH
      );
      results.tiktok.ok = true; results.tiktok.len = len;
      console.log(`[dripl] tiktok cookies fetched from URL -> ${TT_COOKIE_PATH} (${len} bytes)`);
    }
  } catch (e) {
    console.warn("[dripl] tiktok cookie fetch failed:", e.message || e);
  }
  try {
    if (COOKIE_YOUTUBE_URL) {
      const len = await fetchToFile(
        COOKIE_YOUTUBE_URL,
        headersForUrl(COOKIE_YOUTUBE_URL, COOKIE_YOUTUBE_HEADERS),
        YT_COOKIE_PATH
      );
      results.youtube.ok = true; results.youtube.len = len;
      console.log(`[dripl] youtube cookies fetched from URL -> ${YT_COOKIE_PATH} (${len} bytes)`);
    }
  } catch (e) {
    console.warn("[dripl] youtube cookie fetch failed:", e.message || e);
  }
  return results;
}

function cookieSummary() {
  const stat = p => fs.existsSync(p) ? fs.statSync(p).size : 0;
  const tt = stat(TT_COOKIE_PATH);
  const yt = stat(YT_COOKIE_PATH);
  console.log(`[dripl] cookies summary -> TT: ${tt ? "ok" : "missing (0)"} (${tt}), YT: ${yt ? "ok" : "missing (0)"} (${yt})`);
  return { tiktok: { path: TT_COOKIE_PATH, bytes: tt }, youtube: { path: YT_COOKIE_PATH, bytes: yt } };
}

// ===== App =====
const app = express();
app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));
app.use(rateLimit({ windowMs: 60_000, max: 100, legacyHeaders: false }));

// Serve static UI if present
if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));
}

// ===== Health / Stats / Debug =====
app.get("/health", (_req, res) => {
  const ytErrs = windowErrorCount("youtube");
  const ttErrs = windowErrorCount("tiktok");
  const ok = ytErrs < ALERT_MIN_ERRORS && ttErrs < ALERT_MIN_ERRORS;
  res.status(ok ? 200 : 503).json({
    ok,
    youtube_errors_last_window: ytErrs,
    tiktok_errors_last_window: ttErrs,
    window_seconds: ALERT_WINDOW_SEC
  });
});

app.get("/stats", (_req, res) => {
  res.json({
    window_seconds: ALERT_WINDOW_SEC,
    thresholds: { ALERT_MIN_ERRORS, ALERT_COOLDOWN_SEC },
    youtube: {
      errors_in_window: windowErrorCount("youtube"),
      last_alert_at: lastAlertAt.youtube
    },
    tiktok: {
      errors_in_window: windowErrorCount("tiktok"),
      last_alert_at: lastAlertAt.tiktok
    }
  });
});

app.get("/debug/cookies", (_req, res) => {
  const tt = fs.existsSync(TT_COOKIE_PATH) ? fs.statSync(TT_COOKIE_PATH).size : 0;
  const yt = fs.existsSync(YT_COOKIE_PATH) ? fs.statSync(YT_COOKIE_PATH).size : 0;
  res.json({
    dir: COOKIES_DIR,
    tiktok: { path: TT_COOKIE_PATH, bytes: tt },
    youtube: { path: YT_COOKIE_PATH, bytes: yt }
  });
});

// Manual refresh (secure with ADMIN_TOKEN if provided)
app.post("/admin/refresh", async (req, res) => {
  if (ADMIN_TOKEN) {
    if ((req.headers["x-admin-token"] || "") !== ADMIN_TOKEN) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }
  try {
    const r = await refreshCookiesFromRemote();
    const summary = cookieSummary();
    res.json({ ok: true, fetch: r, summary });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ===== Download API =====
// Body: { url: "https://...", format?: string }
app.post("/api/download", async (req, res) => {
  const url = (req.body?.url || "").trim();
  if (!url) return res.status(400).json({ error: "missing url" });

  const isYT = isYouTubeUrl(url);
  const isTT = isTikTokUrl(url);
  if (!isYT && !isTT) return res.status(400).json({ error: "unsupported url" });

  const cookieFile = isYT ? YT_COOKIE_PATH : TT_COOKIE_PATH;
  if (!fs.existsSync(cookieFile) || fs.statSync(cookieFile).size < 50_000) {
    return res.status(503).json({ error: `${isYT ? "YouTube" : "TikTok"} cookies missing or too small` });
  }

  // output temp path
  const outName = `dripl-${Date.now()}-${crypto.randomUUID().slice(0,8)}.mp4`;
  const outPath = path.join(os.tmpdir(), outName);

  const args = [
    url,
    "--no-call-home",            // stays safe
    "--no-warnings",
    "--restrict-filenames",
    "--downloader", "ffmpeg",
    "--ffmpeg-location", "/usr/bin/ffmpeg",
    "--cookies", cookieFile,
    "-o", outPath,
  ];

  if (YTDLP_UA) args.push("--user-agent", YTDLP_UA);
  if (YTDLP_EXTRACTOR_ARGS) args.push("--extractor-args", YTDLP_EXTRACTOR_ARGS);
  if (PROXY_URL) args.push("--proxy", PROXY_URL);

  const child = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });

  let stderr = "", stdout = "";
  child.stdout.on("data", d => { stdout += d.toString(); });
  child.stderr.on("data", d => { stderr += d.toString(); });

  child.on("close", async (code) => {
    const provider = isYT ? "youtube" : "tiktok";
    if (code !== 0) {
      if (looksLikeCookieError(provider, stderr)) {
        pushError(provider, stderr);
        maybeAlert(provider, stderr);
      }
      console.warn("yt-dlp error:", stderr.slice(0, 1000));
      return res.status(500).json({ error: "yt-dlp failed", details: stderr.slice(0, 500) });
    }

    try {
      // stream the file then unlink
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename="${outName}"`);
      const stream = fs.createReadStream(outPath);
      stream.pipe(res);
      stream.on("close", () => {
        fs.existsSync(outPath) && fs.unlinkSync(outPath);
      });
    } catch (e) {
      fs.existsSync(outPath) && fs.unlinkSync(outPath);
      res.status(500).json({ error: String(e.message || e) });
    }
  });
});

// ===== Boot =====
(async () => {
  console.log("==> Deploying...");
  // Initial fetch (won't crash if missing vars)
  await refreshCookiesFromRemote();
  cookieSummary();

  // periodic re-pull of cookie files from your GitHub URLs
  if (COOKIE_REFRESH_HOURS > 0) {
    setInterval(async () => {
      try {
        console.log(`[dripl] periodic refresh firing (every ${COOKIE_REFRESH_HOURS}h)…`);
        await refreshCookiesFromRemote();
        cookieSummary();
      } catch (e) {
        console.warn("[dripl] periodic refresh failed:", e.message || e);
      }
    }, COOKIE_REFRESH_HOURS * 3600 * 1000).unref();
  }

  // Static + server start
  if (fs.existsSync(STATIC_DIR)) {
    console.log(`[dripl] serving static from ${STATIC_DIR}`);
  }
  console.log(`[dripl] server listening on :${PORT}`);
  console.log(`[dripl] cookies dir ${COOKIES_DIR}`);
  app.listen(PORT);
})();































