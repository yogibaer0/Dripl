// server.js (ESM) — clean, working baseline

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

// ---------- resolve __dirname ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- paths & folders ----------
const PUBLIC = path.join(__dirname, "public");
const OUT = path.join(PUBLIC, "out");
for (const d of [PUBLIC, OUT]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ---------- ffmpeg / ffprobe wiring ----------
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

// ---------- yt-dlp resolution ----------
function resolveYtDlpPath() {
  if (process.platform === "win32") {
    const localWin = path.join(__dirname, "yt-dlp.exe");
    if (fs.existsSync(localWin)) return localWin;
  }
  return "yt-dlp";
}
const YTDLP_BIN = resolveYtDlpPath();

// ---------- cookies helper ----------
function ensureCookiesFileFromEnv() {
  let raw = (process.env.YTDLP_COOKIES_B64 || "").trim();
  if (!raw) {
    console.log("[cookies] none");
    return null;
  }
  raw = raw.replace(/\s+/g, "");
  let buf = Buffer.from(raw, "base64");
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) buf = buf.slice(3);

  try {
    const preview = buf.slice(0, 28).toString("utf8");
    console.log("[cookies] preview:", preview.replace(/\r|\n/g, " ").slice(0, 48));
  } catch { console.warn("[cookies] preview decode failed"); }

  const tmp = path.join("/tmp", `cookies-${Date.now()}.txt`);
  fs.writeFileSync(tmp, buf);
  console.log("[cookies] wrote:", tmp, "bytes:", buf.length);
  return tmp;
}

// ---------- spawn yt-dlp ----------
function spawnYtDlp(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_BIN, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "", stderr = "";
    child.stdout.on("data", d => (stdout += d.toString()));
    child.stderr.on("data", d => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) return resolve({ code, stdout, stderr });
      const e = new Error(`yt-dlp exit ${code}\n${stderr || stdout}`);
      e.code = code; e.stdout = stdout; e.stderr = stderr;
      reject(e);
    });
  });
}

// ---------- core run (mp3/mp4) ----------
async function runYtDlp({ url, kind }) {
  fs.mkdirSync(OUT, { recursive: true });

  // always prefix with "dripl-"
  // choose predictable ID-based names:
  const outTpl = path.join(OUT, "dripl-%(id)s.%(ext)s");
  // (or for random: const outTpl = path.join(OUT, `dripl-${crypto.randomUUID()}.%(ext)s`);)

  const cookies = ensureCookiesFileFromEnv();

  const baseArgs = [
    "--no-color", "--no-playlist", "--ignore-errors", "--abort-on-error",
    "--geo-bypass", "--no-progress",
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "--ffmpeg-location", FFMPEG_BIN || "",
    "-o", outTpl
  ];
  if (cookies) baseArgs.push("--cookies", cookies);

  const fmtArgs = kind === "mp3"
    ? ["-f", "bestaudio/best", "--extract-audio", "--audio-format", "mp3"]
    : ["-f", "bv*+ba/b", "-S", "codec:avc:m4a,res,ext", "--merge-output-format", "mp4"];

  const args = [...baseArgs, ...fmtArgs, url];
  console.log("[yt-dlp] >", YTDLP_BIN, args.join(" "));
  await spawnYtDlp(args, { cwd: __dirname });

  // newest file in last 2 minutes
  const now = Date.now();
  const entries = (await fsp.readdir(OUT))
    .map(n => {
      const p = path.join(OUT, n);
      const t = fs.statSync(p).mtimeMs;
      return { n, p, t };
    })
    .filter(f => now - f.t < 120000)
    .sort((a,b) => b.t - a.t);

  if (!entries.length) throw new Error("Download finished but no file found.");
  return entries[0].p;
}

// ---------- express app ----------
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// health
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ffmpeg: !!FFMPEG_BIN, ffprobe: !!FFPROBE_BIN, ytdlp: YTDLP_BIN });
});

// main convert
app.post("/api/convert", async (req, res) => {
  try {
    const { url, kind } = req.body || {};
    if (!url) return res.status(400).json({ ok: false, error: "Missing 'url'." });
    const fmt = (kind || "mp4").toLowerCase();
    if (!["mp3", "mp4"].includes(fmt)) return res.status(400).json({ ok: false, error: "kind must be 'mp3' or 'mp4'" });

    const abs = await runYtDlp({ url, kind: fmt });
    const file = path.basename(abs);
    const publicPath = `/out/${file}`;
    res.json({ ok: true, id: crypto.randomUUID(), abs, publicPath, file, url: publicPath });
  } catch (err) {
    const msg = String(err.stderr || err.message || err).slice(0, 1200);
    const low = msg.toLowerCase();
    if (low.includes("confirm you're not a bot") || low.includes("sign in to confirm")) {
      return res.status(502).json({ ok: false, error: "YouTube asked for verification. Add/refresh cookies (YTDLP_COOKIES_B64)." });
    }
    res.status(400).json({ ok: false, error: msg });
  }
});

// legacy shim (/api/auto)
app.post("/api/auto", async (req, res) => {
  try {
    const { url, format } = req.body || {};
    if (!url) return res.status(400).json({ ok: false, error: "Missing 'url'." });
    const kind = (format || "mp4").toLowerCase();
    if (!["mp3", "mp4"].includes(kind)) return res.status(400).json({ ok: false, error: "format must be 'mp3' or 'mp4'" });

    const abs = await runYtDlp({ url, kind });
    const file = path.basename(abs);
    const publicPath = `/out/${file}`;
    res.json({ ok: true, id: crypto.randomUUID(), abs, publicPath, file, url: publicPath });
  } catch (err) {
    const msg = String(err.stderr || err.message || err).slice(0, 1200);
    const low = msg.toLowerCase();
    if (low.includes("confirm you're not a bot") || low.includes("sign in to confirm")) {
      return res.status(502).json({ ok: false, error: "YouTube asked for verification. Add/refresh cookies (YTDLP_COOKIES_B64)." });
    }
    res.status(400).json({ ok: false, error: msg });
  }
});

// static files
app.use(express.static(PUBLIC, { extensions: ["html"] }));

// start server
const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
app.set("trust proxy", 1);

app.listen(PORT, HOST, () => {
  console.log("FFMPEG at:", FFMPEG_BIN || "(not found)");
  console.log("FFPROBE at:", FFPROBE_BIN || "(not found)");
  console.log("YTDLP_BIN:", YTDLP_BIN);
  if (process.env.YTDLP_COOKIES_B64) {
    console.log("Loaded cookies, length =", process.env.YTDLP_COOKIES_B64.length);
  } else {
    console.log("Loaded cookies: NONE");
  }
  console.log(`Server listening on http://${HOST}:${PORT}`);
});






