// server.js — Dripl (ESM)

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

// ---- ffmpeg/ffprobe on PATH for yt-dlp ----
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

// ---- yt-dlp path resolution ----
function resolveYtDlp() {
  if (process.platform === "win32") {
    const exe = path.join(__dirname, "yt-dlp.exe");
    if (fs.existsSync(exe)) return exe;
  }
  return "yt-dlp"; // rely on system/package
}
const YTDLP_BIN = resolveYtDlp();

// ---------------- cookie pool ----------------
function loadCookiePoolFromEnv() {
  const raw = (process.env.COOKIE_POOL_B64 || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(b64 => Buffer.from(b64.replace(/\s+/g, ""), "base64").toString("utf8"));
}

let COOKIE_POOL = loadCookiePoolFromEnv();
let COOKIE_IDX = 0;

async function writeTempCookies(text) {
  const p = path.join("/tmp", `cookies-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  await fsp.writeFile(p, text, "utf8");
  return p;
}
async function nextCookiePathOrNull() {
  if (!COOKIE_POOL.length) return null;
  const txt = COOKIE_POOL[COOKIE_IDX % COOKIE_POOL.length];
  COOKIE_IDX = (COOKIE_IDX + 1) % COOKIE_POOL.length;
  return writeTempCookies(txt);
}
async function reloadCookiePool(newPoolB64) {
  COOKIE_POOL = (newPoolB64 || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(b64 => Buffer.from(b64.replace(/\s+/g, ""), "base64").toString("utf8"));
  COOKIE_IDX = 0;
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

async function runYtDlp({ url, kind, cookiesPath }) {
  fs.mkdirSync(OUT, { recursive: true });

  const outTpl = path.join(OUT, "dripl-%(id)s.%(ext)s");

  const baseArgs = [
    "--no-color", "--no-playlist", "--ignore-errors", "--abort-on-error",
    "--geo-bypass", "--no-progress",
    "--ffmpeg-location", FFMPEG_BIN || "",
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    // this player client often reduces web challenges:
    "--extractor-args", "youtube:player_client=android",
    "-o", outTpl
  ];
  if (cookiesPath) baseArgs.push("--cookies", cookiesPath);

  const fmtArgs = kind === "mp3"
    ? ["-f", "bestaudio/best", "--extract-audio", "--audio-format", "mp3"]
    : ["-f", "bv*+ba/b", "-S", "codec:avc:m4a,res,ext", "--merge-output-format", "mp4"];

  const args = [...baseArgs, ...fmtArgs, url];

  const res = await spawnYtDlp(args, { cwd: __dirname });
  if (res.stderr) console.log("[yt-dlp:warn]", res.stderr.slice(0, 1500));

  // pick latest file written in last 2 minutes
  const now = Date.now();
  const candidates = (await fsp.readdir(OUT))
    .map(n => {
      const p = path.join(OUT, n);
      return { p, t: fs.statSync(p).mtimeMs };
    })
    .filter(f => now - f.t < 120000)
    .sort((a, b) => b.t - a.t);

  if (!candidates.length) throw new Error("Download finished but no file found.");
  return candidates[0].p;
}

// ---------------- app ----------------
const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// health & version
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    ffmpeg: !!FFMPEG_BIN,
    ffprobe: !!FFPROBE_BIN,
    ytdlp: YTDLP_BIN
  });
});
app.get("/api/version", (_req, res) => {
  res.json({
    commit: process.env.RENDER_GIT_COMMIT || "local",
    time: new Date().toISOString(),
    cookiePool: COOKIE_POOL.length
  });
});

// main convert (retry across cookie pool → then no cookies)
app.post("/api/convert", async (req, res) => {
  const { url, kind } = req.body || {};
  if (!url) return res.status(400).json({ ok: false, error: "Paste a link to start." });
  const fmt = (kind || "mp4").toLowerCase();
  if (!["mp3", "mp4"].includes(fmt)) return res.status(400).json({ ok: false, error: "Invalid format." });

  const attempts = Math.max(1, COOKIE_POOL.length) + 1; // pool + final nocookie
  let lastErr = null;

  for (let i = 0; i < attempts; i++) {
    let cookiePath = null;
    try {
      cookiePath = (i < COOKIE_POOL.length) ? await nextCookiePathOrNull() : null;
      const abs = await runYtDlp({ url, kind: fmt, cookiesPath: cookiePath || undefined });
      const file = path.basename(abs);
      const publicPath = `/out/${file}`;
      return res.json({ ok: true, url: publicPath, file });
    } catch (err) {
      lastErr = err;
      const stderr = String(err?.stderr || "").toLowerCase();
      const challenged =
        stderr.includes("confirm you're not a bot") ||
        stderr.includes("sign in to confirm") ||
        stderr.includes("account cookies are no longer valid") ||
        stderr.includes("age restricted") ||
        stderr.includes("forbidden") ||
        err?.code === 502;
      if (challenged && i + 1 < attempts) {
        continue; // try next cookie or final no-cookie attempt
      }
      break;
    } finally {
      // clean up temp cookie file if any
      try { if (cookiePath) await fsp.unlink(cookiePath); } catch {}
    }
  }

  console.error("[convert fail]", lastErr?.message || lastErr);
  return res.status(502).json({
    ok: false,
    error: "We’re refreshing access—try again in a moment."
  });
});

app.post("/api/admin/cookies/reload", async (req, res) => {
  const headerToken = String(
    req.headers["x-admin-token"] ??
    req.headers["X-Admin-Token"] ??
    req.get?.("x-admin-token") ??
    ""
  ).trim();

  const envToken = String(process.env.ADMIN_TOKEN || "").trim();

  if (!envToken || headerToken !== envToken) {
    console.log("[admin] bad token",
      { hasEnv: !!envToken, headerLen: headerToken.length }); // debug only; no secrets
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const { cookiePoolB64 } = req.body || {};
  const count = await reloadCookiePool(cookiePoolB64 || "");
  res.json({ ok: true, count });
});


// static files
app.use(express.static(PUBLIC, { extensions: ["html"] }));

// start
const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log("FFMPEG:", FFMPEG_BIN || "(not found)");
  console.log("FFPROBE:", FFPROBE_BIN || "(not found)");
  console.log("YTDLP_BIN:", YTDLP_BIN);
  console.log("CookiePool size:", COOKIE_POOL.length);
  console.log(`Listening on http://${HOST}:${PORT}`);
});









