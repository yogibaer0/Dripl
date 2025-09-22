// server.js (ESM)
// ------------------------------------------------------------
// Dripl backend: YouTube/TikTok/etc -> MP3 / MP4 with yt-dlp
// - Cookies: YTDLP_COOKIES_PATH or YTDLP_COOKIES_B64
// - ffmpeg/ffprobe wired via PATH
// - Safe args incl. user-agent to reduce "bot" challenges
// - Static files served from /public (results in /public/out)
//
// ------------------------------------------------------------

import express from "express";
import helmet from "helmet";
import cors from "cors";
import PQueue from "p-queue";
import { v4 as uuidv4 } from "uuid";

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import ffmpegStatic from "ffmpeg-static";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

// ---------- paths & folders ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMP = path.join(__dirname, "tmp");
const PUBLIC = path.join(__dirname, "public");
const OUT = path.join(PUBLIC, "out");
for (const d of [TMP, PUBLIC, OUT]) {
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

// For safety, expose these bins to yt-dlp via env too
process.env.FFMPEG_PATH = FFMPEG_BIN;
process.env.FFPROBE_PATH = FFPROBE_BIN;

// ---------- yt-dlp path detection ----------
function resolveYtDlpPath() {
  if (process.platform === "win32") {
    const localWin = path.join(__dirname, "yt-dlp.exe");
    if (fs.existsSync(localWin)) return localWin;
  }
  // let system PATH provide it (e.g. apt, brew, render image)
  return "yt-dlp";
}
const YTDLP_BIN = resolveYtDlpPath();

// ---------- cookies: env -> file path ----------
let CACHED_COOKIES_FILE = null;

async function resolveCookiesFile() {
  if (CACHED_COOKIES_FILE) return CACHED_COOKIES_FILE;

  const fromPath = process.env.YTDLP_COOKIES_PATH;
  const fromB64 = process.env.YTDLP_COOKIES_B64;

  if (fromPath && fs.existsSync(fromPath)) {
    CACHED_COOKIES_FILE = fromPath;
    console.log("[cookies] using (path):", CACHED_COOKIES_FILE);
    return CACHED_COOKIES_FILE;
  }

  if (fromB64) {
    try {
      const buf = Buffer.from(fromB64, "base64");
      const tmpFile = path.join(os.tmpdir(), `cookies-${uuidv4()}.txt`);
      await fsp.writeFile(tmpFile, buf);
      CACHED_COOKIES_FILE = tmpFile;
      console.log("[cookies] using (temp from B64):", CACHED_COOKIES_FILE);
      return CACHED_COOKIES_FILE;
    } catch (e) {
      console.warn("[cookies] failed to decode YTDLP_COOKIES_B64:", e.message);
    }
  }

  console.log("[cookies] none set (will try without)");
  return null;
}

if (process.env.YTDLP_COOKIES_B64) {
  console.log("Loaded cookies, length =", process.env.YTDLP_COOKIES_B64.length);
}


// ---------- utility: run a process ----------
function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) return resolve({ code, stdout, stderr });
      const err = new Error(`Process failed: ${cmd} ${args.join(" ")}\nExit ${code}\n${stderr}`);
      err.code = code;
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    });
  });
}

// ---------- arg builder ----------
async function buildYtDlpArgs({ url, format, outFileBase }) {
  const cookies = await resolveCookiesFile();

  // Base args helpful for reliability
  const args = [
    "--no-color",
    "--no-playlist",
    "--geo-bypass",
    "--ignore-errors",
    "--abort-on-error",
    "--user-agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "--ffmpeg-location", FFMPEG_BIN || "",  // helps some environments
    "--no-progress",
    url
  ];

  if (cookies) {
    args.push("--cookies", cookies);
  }

  // Output pattern
  const outPattern = path.join(OUT, `${outFileBase}.%(ext)s`);

  if (format === "mp3") {
    // Best audio, extract to MP3
    args.splice(args.indexOf(url), 0, "-f", "bestaudio/best");
    args.push("--extract-audio", "--audio-format", "mp3", "-o", outPattern);
  } else {
    // mp4: prefer mp4 video+audio, merge via ffmpeg
    const videoSel = "bestvideo*[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";
    args.splice(args.indexOf(url), 0, "-f", videoSel);
    args.push("--merge-output-format", "mp4", "-o", outPattern);
  }

  return args.filter(Boolean);
}

// ---------- conversion ----------
async function convert({ url, format = "mp4" }) {
  const id = uuidv4();

  const args = await buildYtDlpArgs({
    url,
    format,
    outFileBase: id
  });

  console.log("[yt-dlp] =>", YTDLP_BIN, args.join(" "));

  await run(YTDLP_BIN, args, { cwd: __dirname });

  // Figure out which file was created
  // (mp3 => .mp3, mp4 => .mp4 typically; but check the folder)
  const files = await fsp.readdir(OUT);
  const match = files.find((f) => f.startsWith(id + "."));
  if (!match) {
    throw new Error("No output file produced. Check logs above.");
  }

  const abs = path.join(OUT, match);
  const pub = "/out/" + match; // served by express.static
  return { id, abs, publicPath: pub, file: match };
}

// ---------- express app ----------
const app = express();

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({ origin: "*"}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Small rate limit (in-memory)
const queue = new PQueue({ concurrency: 2 });

// Health
app.get("/api/health", async (_req, res) => {
  res.json({
    ok: true,
    ffmpeg: !!FFMPEG_BIN,
    ffprobe: !!FFPROBE_BIN,
    ytdlp: YTDLP_BIN
  });
});

// Convert endpoint
app.post("/api/auto", async (req, res) => {
  try {
    const { url, format } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ ok: false, error: "Missing 'url'." });
    }
    const fmt = (format || "mp4").toLowerCase();
    if (!["mp3", "mp4"].includes(fmt)) {
      return res.status(400).json({ ok: false, error: "format must be 'mp3' or 'mp4'" });
    }

    const result = await queue.add(() => convert({ url, format: fmt }));
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[/api/auto] error:", err);
    // Friendly error for common cookie challenge messages
    if (String(err.stderr || err.message).toLowerCase().includes("confirm you're not a bot")
       || String(err.stderr || err.message).toLowerCase().includes("sign in to confirm")) {
      return res.status(502).json({
        ok: false,
        error: "YouTube asked for verification. Add/refresh cookies (YTDLP_COOKIES_PATH or YTDLP_COOKIES_B64)."
      });
    }
    res.status(500).json({ ok: false, error: err.message || "Unexpected error." });
  }
});

// Static files (results available at /out/<file>)
app.use(express.static(PUBLIC, { extensions: ["html"] }));

// -------- start server --------
const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";          // required for Render

app.set("trust proxy", 1);       // good practice behind Render's proxy

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


