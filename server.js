// server.js — Dripl API (ESM)

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";


// ------------------------- basic app setup -------------------------
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors());
app.use(helmet());

// rate limit: 100 requests / 15 minutes per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ESM helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// folders
const PUBLIC = path.join(__dirname, "public");
const OUT = path.join(PUBLIC, "out");
const TMP = path.join(__dirname, "tmp");
for (const d of [PUBLIC, OUT, TMP]) fs.mkdirSync(d, { recursive: true });

// serve static frontend + generated files
app.use(express.static(PUBLIC, { fallthrough: true }));

// ------------------------- yt-dlp resolution -------------------------
/**
 * We try in this order:
 * 1) env YTDLP_PATH
 * 2) local Windows exe (./yt-dlp.exe)
 * 3) system PATH ("yt-dlp")
 */
function resolveYtDlp() {
  const fromEnv = process.env.YTDLP_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const localWin = path.join(__dirname, "yt-dlp.exe");
  if (process.platform === "win32" && fs.existsSync(localWin)) return localWin;

  return "yt-dlp"; // expect found on PATH (Linux/macOS or user-installed)
}

const YTDLP_BIN = resolveYtDlp();
console.log("YTDLP_BIN:", YTDLP_BIN);
const FFMPEG_BIN = ffmpegStatic || process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE_BIN = ffprobeInstaller?.path || process.env.FFPROBE_PATH || "";
console.log("FFMPEG_BIN:", FFMPEG_BIN);
if (FFPROBE_BIN) console.log("FFPROBE_BIN:", FFPROBE_BIN);


// ------------------------- utilities -------------------------
const toUrlPath = (absPath) =>
  absPath.replace(PUBLIC, "").replace(/\\/g, "/").replace(/^\/?/, "/");

const isLikelyFilePath = (line) =>
  /^[A-Za-z]:\\.*\.(mp4|m4a|mp3|mkv|webm)$/i.test(line.trim()) || // Windows
  /^\/.*\.(mp4|m4a|mp3|mkv|webm)$/i.test(line.trim()); // *nix

const allowedFormats = new Set(["mp3", "mp4"]);
const safeProtocols = new Set(["http:", "https:"]);

function validateInput(url, format) {
  if (!url || !format) throw new Error("Missing url or format");
  if (!allowedFormats.has(format)) throw new Error("Unsupported format");
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!safeProtocols.has(parsed.protocol)) throw new Error("Invalid URL protocol");
}

function buildArgs(url, fmt) {
  const template = path.join(OUT, "%(id)s.%(ext)s");

  const base = [
    url,
    "--no-color",
    "--no-playlist",
    "--ignore-errors",
    "--abort-on-error",
    "--no-overwrites",
    "--restrict-filenames",
    "--newline",
    "-o", template,
    "--print", "after_move:filepath",
    "--print", "filename",
    "--user-agent", "Mozilla/5.0",
    // 👇 tell yt-dlp exactly where ffmpeg is
    "--ffmpeg-location", FFMPEG_BIN,
  ];

  if (fmt === "mp4") {
    base.push(
      "-f",
      "bestvideo*[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--merge-output-format", "mp4"
    );
  } else if (fmt === "mp3") {
    base.push("-f", "bestaudio/best", "-x", "--audio-format", "mp3");
  }

  return base;
}


function runYtDlp(url, format) {
  return new Promise((resolve, reject) => {
    const args = buildArgs(url, format);
    const child = spawn(YTDLP_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });

    let finalPath = "";
    let lastLine = "";

    child.stdout.on("data", (buf) => {
      const text = buf.toString();
      text.split(/\r?\n/).forEach((line) => {
        if (!line) return;
        lastLine = line.trim();
        // yt-dlp will print absolute output path (because we used --print ...)
        if (isLikelyFilePath(lastLine)) finalPath = lastLine;
        // helpful debugging
        // console.log("[yt-dlp]", lastLine);
      });
    });

    child.stderr.on("data", (buf) => {
      // Keep stderr visible for debugging, but don't fail just on warnings
      console.error("[yt-dlp]", buf.toString().trim());
    });

    child.on("close", (code) => {
      // Some versions don’t always print the file path twice, so fall back
      if (!finalPath && isLikelyFilePath(lastLine)) finalPath = lastLine;

      if (code !== 0) return reject(new Error(`yt-dlp exited ${code}`));
      if (!finalPath || !fs.existsSync(finalPath)) {
        return reject(
          new Error(
            "Download finished but no output file was detected (maybe blocked or removed)."
          )
        );
      }
      resolve(finalPath);
    });
  });
}

// Clean old tmp files on boot (best effort)
try {
  if (fs.existsSync(TMP)) {
    for (const f of fs.readdirSync(TMP)) {
      const p = path.join(TMP, f);
      try {
        const st = fs.statSync(p);
        if (Date.now() - st.mtimeMs > 6 * 60 * 60 * 1000) fs.unlinkSync(p); // >6h old
      } catch {}
    }
  }
} catch {}

// ------------------------- routes -------------------------
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    ytdlp: YTDLP_BIN,
    outDir: "/out",
  });
});

app.post("/api/auto", async (req, res) => {
  try {
    const { url, format } = req.body || {};
    validateInput(url, format);
    const outPath = await runYtDlp(url, format);
    const relUrl = toUrlPath(outPath); // e.g. "/out/VIDEOID.mp4"
    return res.json({ ok: true, url: relUrl });
  } catch (err) {
    console.error("[/api/auto] error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Failed" });
  }
});

// Fallback to index.html for any non-API route (optional)
app.get("*", (req, res, next) => {
  const maybeFile = path.join(PUBLIC, req.path);
  if (fs.existsSync(maybeFile) && fs.statSync(maybeFile).isFile()) {
    return res.sendFile(maybeFile);
  }
  const index = path.join(PUBLIC, "index.html");
  if (fs.existsSync(index)) return res.sendFile(index);
  next();
});

// ------------------------- start server -------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://127.0.0.1:${PORT}`);
});




