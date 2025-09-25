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

// ---------------- cookie pool + metadata ----------------
function b64ToText(b64) { return Buffer.from(b64.replace(/\s+/g, ""), "base64").toString("utf8"); }
function hashId(text) { return crypto.createHash("sha256").update(text).digest("hex").slice(0, 8); }

function loadCookiePoolFromEnv() {
  const raw = (process.env.COOKIE_POOL_B64 || "").trim();
  if (!raw) return [];
  return raw.split(",").map(s => s.trim()).filter(Boolean).map(b64ToText);
}

let COOKIE_POOL = loadCookiePoolFromEnv(); // array of plaintext cookie files
let COOKIE_META = [];                      // [{ id, idx, ok, fail, lastOk, lastFail }]
let COOKIE_IDX = 0;

function rebuildCookieMeta() {
  COOKIE_META = COOKIE_POOL.map((txt, i) => ({
    id: hashId(txt),
    idx: i,
    ok: 0,
    fail: 0,
    lastOk: null,
    lastFail: null
  }));
}
rebuildCookieMeta();

async function writeTempCookies(text) {
  const p = path.join("/tmp", `cookies-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  await fsp.writeFile(p, text, "utf8");
  return p;
}

// returns { path, idx, id } or null
async function nextCookiePathOrNull() {
  if (!COOKIE_POOL.length) return null;
  const i = COOKIE_IDX % COOKIE_POOL.length;
  COOKIE_IDX = (COOKIE_IDX + 1) % COOKIE_POOL.length;
  const txt = COOKIE_POOL[i];
  const id = COOKIE_META[i]?.id || "????????";
  const p = await writeTempCookies(txt);
  return { path: p, idx: i, id };
}

// called by admin reload
async function reloadCookiePool(newPoolB64) {
  COOKIE_POOL = (newPoolB64 || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(b64ToText);
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

async function runYtDlp({ url, kind, cookiesPath }) {
  fs.mkdirSync(OUT, { recursive: true });

  const outTpl = path.join(OUT, "dripl-%(id)s.%(ext)s");

  const baseArgs = [
    "--no-color", "--no-playlist", "--ignore-errors", "--abort-on-error",
    "--geo-bypass", "--no-progress",
    "--ffmpeg-location", FFMPEG_BIN || "",
    "--user-agent",
    "Mozilla/5.0 (Linux; Android 13; SM-G991U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    "--add-header", "Accept-Language: en-US,en;q=0.9",
    // multiple client types often reduce challenges
    "--extractor-args", "youtube:player_client=android,web_creator",
    "-o", outTpl
  ];

  if (process.env.YTDLP_FORCE_IPV4 === "1") baseArgs.push("--force-ipv4");

  const proxy = (process.env.PROXY_URL || "").trim();
  if (proxy) baseArgs.push("--proxy", proxy);

  const extra = (process.env.YTDLP_EXTRA_ARGS || "").trim();
  if (extra) {
    const parts = extra.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    baseArgs.push(...parts.map(s => s.replace(/^"(.*)"$/, "$1")));
  }

  if (cookiesPath) baseArgs.push("--cookies", cookiesPath);

  const fmtArgs = kind === "mp3"
    ? ["-f", "bestaudio/best", "--extract-audio", "--audio-format", "mp3"]
    : ["-f", "bv*+ba/b", "-S", "codec:avc:m4a,res,ext", "--merge-output-format", "mp4"];

  const args = [...baseArgs, ...fmtArgs, url];

  // log the exact command (args only; url is included at the end)
  console.log("[yt-dlp] args:", args.join(" "));

  const res = await spawnYtDlp(args, { cwd: __dirname });
  if (res.stderr) console.log("[yt-dlp:warn]", res.stderr.slice(0, 1000));

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

// ----- admin: ping / reload / status / reset -----
function adminOk(req) {
  const headerToken = String(req.headers["x-admin-token"] || "").trim();
  const envToken = String(process.env.ADMIN_TOKEN || "").trim();
  return !!envToken && headerToken === envToken;
}

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

// main convert (retry across cookie pool → then no cookies)
app.post("/api/convert", async (req, res) => {
  const { url, kind } = req.body || {};
  if (!url) return res.status(400).json({ ok: false, error: "Paste a link to start." });
  const fmt = (kind || "mp4").toLowerCase();
  if (!["mp3", "mp4"].includes(fmt)) return res.status(400).json({ ok: false, error: "Invalid format." });

  const attempts = Math.max(1, COOKIE_POOL.length) + 1; // pool + final no-cookie

  for (let i = 0; i < attempts; i++) {
    let cookieInfo = null;
    try {
      cookieInfo = (i < COOKIE_POOL.length) ? await nextCookiePathOrNull() : null;
      const label = cookieInfo ? `cookie#${cookieInfo.idx + 1}/${COOKIE_POOL.length}(${cookieInfo.id})` : "no-cookies";
      console.log(`[convert] attempt ${i+1}/${attempts} using ${label}`);

      const abs = await runYtDlp({ url, kind: fmt, cookiesPath: cookieInfo?.path });
      const file = path.basename(abs);
      const publicPath = `/out/${file}`;
      console.log(`[convert] SUCCESS via ${label} -> ${publicPath}`);

      if (cookieInfo) {
        const m = COOKIE_META[cookieInfo.idx];
        if (m) { m.ok++; m.lastOk = new Date().toISOString(); }
      }
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

      const label = cookieInfo ? `cookie#${cookieInfo.idx + 1}/${COOKIE_POOL.length}(${cookieInfo.id})` : "no-cookies";
      console.error(`[convert] FAIL via ${label}; reason=${reason}; code=${err?.code ?? "?"}`);
      if (stderr) console.error("[yt-dlp:stderr]", stderr.slice(0, 600));

      if (cookieInfo) {
        const m = COOKIE_META[cookieInfo.idx];
        if (m) { m.fail++; m.lastFail = new Date().toISOString(); }
      }

      const challenged = reason !== "unknown" || err?.code === 502;
      if (challenged && i + 1 < attempts) continue;

      break; // give up
    } finally {
      try { if (cookieInfo?.path) await fsp.unlink(cookieInfo.path); } catch {}
    }
  }

  console.error("[convert] all attempts exhausted");
  return res.status(502).json({ ok: false, error: "We’re refreshing access—try again in a moment." });
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










