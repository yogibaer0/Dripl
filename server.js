// server.js — Dripl (MP3/MP4 converter) — ESM

import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import PQueue from "p-queue";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { path as YTDLP_BIN_PKG } from "yt-dlp-exec";
import mime from "mime";

// ────────────────────────── paths & globals ──────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const TMP    = path.join(__dirname, "tmp");
const PUBLIC = path.join(__dirname, "public");
const OUT    = path.join(PUBLIC, "out");

for (const d of [TMP, OUT]) fs.mkdirSync(d, { recursive: true });

// ───────────────────────── ffmpeg / ffprobe wiring ───────────────────
const FFMPEG_BIN   = ffmpegStatic || "";                     // absolute path or ""
const FFPROBE_BIN  = ffprobeInstaller?.path || "";           // absolute path or ""

// Tell fluent-ffmpeg where the binaries are (works locally and on Render)
if (FFMPEG_BIN)  ffmpeg.setFfmpegPath(FFMPEG_BIN);
if (FFPROBE_BIN) ffmpeg.setFfprobePath(FFPROBE_BIN);

// Put their folders on PATH for spawned processes like yt-dlp
process.env.PATH = [
  FFMPEG_BIN ? path.dirname(FFMPEG_BIN) : "",
  FFPROBE_BIN ? path.dirname(FFPROBE_BIN) : "",
  process.env.PATH || ""
].filter(Boolean).join(path.delimiter);

// ────────────────────────── yt-dlp binary resolve ────────────────────
// Prefer a local exe on Windows if present, else the package path.
const localWin = path.join(__dirname, "yt-dlp.exe");
const YTDLP_BIN = (process.platform === "win32" && fs.existsSync(localWin))
  ? localWin
  : YTDLP_BIN_PKG;

// ───────────────────────────── queue & config ─────────────────────────
const queue = new PQueue({
  concurrency: Number(process.env.WORKERS || 2)
});

const MAX_DURATION_SECONDS = Number(process.env.MAX_DURATION_SECONDS || 900); // 15m
const MAX_DOWNLOAD_BYTES   = Number(process.env.MAX_DOWNLOAD_BYTES   || 200*1024*1024); // 200MB

// ───────────────────────────── helpers ────────────────────────────────
const isHttpUrl = s => /^https?:\/\/\S+/i.test(s);

function normalizeUrl(raw) {
  try {
    let s = (raw || "").trim();
    if (!s) return s;

    // If no scheme, assume https
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;

    const u = new URL(s);

    // unify some hosts
    if (u.hostname === "m.youtube.com") u.hostname = "www.youtube.com";
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      u.hostname = "www.youtube.com";
      u.pathname = "/watch";
      u.searchParams.set("v", id);
    }

    // strip noise query params
    ["si", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(p => u.searchParams.delete(p));

    return u.toString();
  } catch {
    return raw || "";
  }
}

async function findProducedFile(dir, idPrefix) {
  const files = await fs.promises.readdir(dir);
  const hit = files.find(f => f.startsWith(idPrefix));
  return hit ? path.join(dir, hit) : "";
}

function cleanLater(filePath, ms = 6 * 60 * 60 * 1000) { // 6h
  setTimeout(() => {
    fs.promises.unlink(filePath).catch(() => {});
  }, ms);
}

function spawnYtDlp(args, childEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_BIN, args, {
      env: { ...process.env, ...childEnv },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", d => { stdout += d.toString(); });
    child.stderr.on("data", d => { stderr += d.toString(); });

    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(Object.assign(new Error(`yt-dlp exited ${code}`), {code, stdout, stderr}));
    });
  });
}

// ───────────────────────────── express app ────────────────────────────
const app = express();
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

// static site
app.use(express.static(PUBLIC, {
  setHeaders(res, filePath) {
    // force download for /out/*
    if (filePath.startsWith(OUT)) {
      res.setHeader("Content-Disposition", `attachment; filename="${path.basename(filePath)}"`);
    }
  }
}));

// health
app.get("/api/health", (req, res) => {
  res.json({ ok: true, ffmpeg: Boolean(FFMPEG_BIN), ffprobe: Boolean(FFPROBE_BIN), ytdlp: Boolean(YTDLP_BIN) });
});

// main: auto (MP3/MP4 by 'format')
app.post("/api/auto", async (req, res) => {
  const body   = req.body || {};
  const target = (body.format || "mp3").toLowerCase();
  const rawUrl = body.url || "";
  const url    = normalizeUrl(rawUrl);

  if (!isHttpUrl(url)) {
    return res.status(400).json({ error: "Enter a URL" });
  }

  // put the job in a small queue
  try {
    const result = await queue.add(() => runConvert(url, target));
    res.json(result);
  } catch (err) {
    console.error("RAW ERROR:", err);
    res.status(500).json({ error: "Unexpected error. Please try again." });
  }
});

// ─────────────────────────── conversion core ──────────────────────────
async function runConvert(url, target) {
  // 0) normalize -> id -> baseTmp
  const id      = uuidv4();
  const baseTmp = path.join(TMP, `${id}.%(ext)s`);

  // 1) build yt-dlp args
  const args = [url, "-o", baseTmp];

  if (target === "mp3") {
    // best audio, extract as mp3 (quality 0 = best)
    args.push(
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "0"
    );
  } else {
    // mp4: prefer H.264+AAC; if not available, remux
    // This combination gives nice results while keeping things simple.
    args.push(
      "-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
      "--merge-output-format", "mp4"
    );
  }

  // 2) sane limits
  args.push(
    "--no-playlist",
    "--no-warnings",
    "--restrict-filenames",
    "--max-filesize", `${MAX_DOWNLOAD_BYTES}`,
    "--download-sections", `*0-${MAX_DURATION_SECONDS}`
  );

  // 3) run
  await spawnYtDlp(args);

  // 4) find produced file
  const produced = await findProducedFile(TMP, id);
  if (!produced) {
    throw new Error("No output file produced");
  }

  // 5) move to public/out with a nice name
  const ext = path.extname(produced) || (target === "mp3" ? ".mp3" : ".mp4");
  const outName = `${id}${ext}`;
  const dest = path.join(OUT, outName);
  await fs.promises.rename(produced, dest);

  // 6) schedule cleanup
  cleanLater(dest);

  // 7) return link
  return {
    ok: true,
    file: `/out/${outName}`,
    mime: mime.getType(ext) || (target === "mp3" ? "audio/mpeg" : "video/mp4")
  };
}

// ─────────────────────────── start server ─────────────────────────────
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`FFMPEG at: ${FFMPEG_BIN || "(none)"}`);
  console.log(`FFPROBE at: ${FFPROBE_BIN || "(none)"}`);
  console.log(`YTDLP   at: ${YTDLP_BIN || "(none)"}`);
  console.log(`Server listening on http://127.0.0.1:${PORT}`);
});


