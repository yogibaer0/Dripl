// server.js  — Rippl (MP3/MP4 Converter)
// ESM module

import express from "express";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import axios from "axios";
import mime from "mime";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
// Resolve ffmpeg/ffprobe binaries and their folders
const FFMPEG_BIN = ffmpegStatic || "";
const FFMPEG_DIR = FFMPEG_BIN ? path.dirname(FFMPEG_BIN) : "";

const FFPROBE_BIN = ffprobeInstaller?.path || "";
const FFPROBE_DIR = FFPROBE_BIN ? path.dirname(FFPROBE_BIN) : "";

import PQueue from "p-queue";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// ---------- paths & globals ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const TMP    = path.join(__dirname, "tmp");
const PUBLIC = path.join(__dirname, "public");
const OUT    = path.join(PUBLIC, "out");
for (const d of [TMP, OUT]) fs.mkdirSync(d, { recursive: true });

// wire ffmpeg + ffprobe binaries
if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
if (ffprobeInstaller?.path) ffmpeg.setFfprobePath(ffprobeInstaller.path);

// log once so we know what binaries are in use
console.log("FFMPEG at:", ffmpegStatic);
console.log("FFPROBE at:", ffprobeInstaller?.path);
// -- ensure yt-dlp can find the binaries (run once) --
if (!globalThis.__ffmpegWired) {
  const FFMPEG_BIN = (ffmpegStatic || "").replace(/\\/g, "/");
  const FFMPEG_DIR = path.dirname(FFMPEG_BIN);

  const FFPROBE_BIN = (ffprobeInstaller?.path || "").replace(/\\/g, "/");
  const FFPROBE_DIR = FFPROBE_BIN ? path.dirname(FFPROBE_BIN) : "";

  // Put them on PATH for this process (cross-platform delimiter)
  process.env.PATH = [FFMPEG_DIR, FFPROBE_DIR, process.env.PATH]
    .filter(Boolean)
    .join(path.delimiter);

  globalThis.__ffmpegWired = { FFMPEG_DIR, FFPROBE_DIR };
}

// --- yt-dlp binary (cross-platform; works on Render + local) ---
import fs from "fs";
import path from "path";

const localWin   = path.join(__dirname, "yt-dlp.exe"); // if you keep the exe next to server.js for Windows
const YTDLP_PATH =
  process.platform === "win32" && fs.existsSync(localWin)
    ? localWin
    : "yt-dlp"; // Render/Docker: installed into PATH (e.g., /usr/local/bin/yt-dlp)

// ---------- config ----------
const queue = new PQueue({
  concurrency: Number(process.env.WORKERS || 2),
});
const MAX_DURATION_SECONDS = Number(process.env.MAX_DURATION_SECONDS || 900);           // 15 min
const MAX_DOWNLOAD_BYTES   = Number(process.env.MAX_DOWNLOAD_BYTES   || 200*1024*1024); // 200 MB

// ---------- helpers ----------
const isHttpUrl = s => /^https?:\/\/\S+/i.test(s);

function cleanLater(filePath, ms = 6 * 60 * 60 * 1000) { // default 6h
  setTimeout(() => fs.promises.unlink(filePath).catch(() => {}), ms);
}

async function findProducedFile(dir, idPrefix) {
  const files = await fs.promises.readdir(dir);
  const hit   = files.find(f => f.startsWith(idPrefix));
  return hit ? path.join(dir, hit) : "";
}

function run(cmd, args, opts = {}) {
    // Ensure yt-dlp knows where ffmpeg lives
  const wired = globalThis.__ffmpegWired;
  if (cmd.toLowerCase().includes("yt-dlp") && wired?.FFMPEG_DIR) {
    // only add once
    if (!args.includes("--ffmpeg-location")) {
      args = ["--ffmpeg-location", wired.FFMPEG_DIR, ...args];
    }
  }

  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
  ...opts,
});


    let out = "", err = "";
    p.stdout.on("data", d => (out += d.toString()));
    p.stderr.on("data", d => (err += d.toString()));
    p.on("error", reject);
    p.on("close", code => {
      if (code === 0) resolve({ out, err });
      else reject(new Error(`${cmd} exited ${code}: ${err || out}`));
    });
  });
}


// Friendly error text for UI
function friendly(err) {
  const raw = String(err?.message || err);
  if (process.env.DEBUG_ERRORS === "1") return raw;

  if (raw.includes("nsig") || raw.includes("yt-dlp exited"))
    return "Download failed. Try a different link.";
  if (raw.includes("Invalid data found when processing input"))
    return "That looks like a web page, not a media file.";
  if (raw.includes("(403)") || raw.includes("Forbidden"))
    return "The video is restricted (login/region/age).";
  if (raw.includes("File too large")) return "File too large.";
  if (raw.includes("Video too long")) return "Video is too long.";
  return "Unexpected error. Please try again.";
}

function handleError(res, e, status = 500) {
  console.error("RAW ERROR:", e?.message || e);
  const pretty = friendly(e);
  console.error("FRIENDLY SHOWN:", pretty);
  res.status(status).json({ error: pretty });
}

// Normalize incoming URLs (strip noisy params, unify hosts)
function normalizeUrl(raw) {
  try {
    let s = (raw || "").trim();
    if (!s) return s;

    // assume https if user pasted without scheme
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;

    const u = new URL(s);

    // unify YouTube
    if (u.hostname === "m.youtube.com") u.hostname = "www.youtube.com";
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      u.hostname = "www.youtube.com";
      u.pathname = "/watch";
      u.searchParams.set("v", id);
    }

    // normalize TikTok host (with or without www doesn’t matter)
    if (u.hostname === "www.tiktok.com") u.hostname = "tiktok.com";

    // drop request/noise params (incl. ?lang=)
    ["si","utm_source","utm_medium","utm_campaign","utm_term","utm_content","lang"]
      .forEach(p => u.searchParams.delete(p));

    return u.toString();
  } catch {
    return raw;
  }
}

// Heuristic: looks like a social/video platform page?
function looksLikePlatform(urlStr) {
  try {
    const host = new URL(urlStr).hostname.replace(/^www\./, "");
    return /(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|reddit\.com|x\.com|twitter\.com|facebook\.com)$/i
      .test(host);
  } catch { return false; }
}

// Try to detect a direct-media URL with HEAD, otherwise a tiny GET range
async function fetchContentType(urlStr) {
  try {
    const resp = await axios.head(urlStr, {
      timeout: 8000, maxRedirects: 3, validateStatus: () => true
    });
    const ct = (resp.headers["content-type"] || "").toLowerCase();
    if (ct) return ct;
  } catch {}
  try {
    const resp = await axios.get(urlStr, {
      timeout: 8000, maxRedirects: 3,
      headers: { Range: "bytes=0-0" },
      validateStatus: () => true
    });
    return (resp.headers["content-type"] || "").toLowerCase();
  } catch {}
  return "";
}

// ---------- core operations shared by routes ----------

// A) Platform URLs via yt-dlp
async function handlePlatform(url, target) {
  const id      = uuidv4();
  const baseTmp = path.join(TMP, `${id}.%(ext)s`);

  // build yt-dlp args
  const args = [
  "--ffmpeg-location", FFMPEG_DIR,   // <<< ensures ffmpeg/ffprobe are found
  url, "-o", baseTmp
];

  if (target === "mp3") {
    args.push("-x", "--audio-format", "mp3", "--audio-quality", "0");
  } else {
    // prefer mp4+m4a; remux to mp4 if needed
    args.push("-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b");
    args.push("--merge-output-format", "mp4");
  }

  // run yt-dlp
  await run(YTDLP_PATH, args);

  // find what yt-dlp actually produced
  const produced = await findProducedFile(TMP, id);
  if (!produced) throw new Error("no output file found");

  // Optional safety: transcode/remux to the exact target if needed
  let publishPath = produced;
  const needsMp3 = target === "mp3" && !/\.mp3$/i.test(publishPath);
  const needsMp4 = target === "mp4" && !/\.mp4$/i.test(publishPath);

  if (needsMp3 || needsMp4) {
    const finalPath = path.join(TMP, `${id}-final.${target}`);
    await new Promise((resolve, reject) => {
      let cmd = ffmpeg(publishPath);
      if (target === "mp3") {
        cmd = cmd.noVideo().audioCodec("libmp3lame").format("mp3");
      } else {
        cmd = cmd
          .videoCodec("libx264").audioCodec("aac")
          .outputOptions(["-preset","veryfast","-crf","23","-movflags","+faststart"])
          .format("mp4");
      }
      cmd.on("start", c => console.log("FFMPEG CMD:", c))
         .on("stderr", l => console.log("FFMPEG:", l))
         .on("end", resolve)
         .on("error", reject)
         .save(finalPath);
    });
    publishPath = finalPath;
    // remove original tmp file
    fs.promises.unlink(produced).catch(() => {});
  }

  // move to /public/out and respond
  const outName = `${id}.${target}`;
  const outPath = path.join(OUT, outName);
  await fs.promises.rename(publishPath, outPath).catch(async () => {
    await fs.promises.copyFile(publishPath, outPath);
    await fs.promises.unlink(publishPath).catch(() => {});
  });

  cleanLater(outPath);
  return { url: `/out/${outName}` };
}

// B) Direct media URL (download stream -> ffmpeg transcode)
async function handleDirect(url, target) {
  const id     = uuidv4();
  const tmpIn  = path.join(TMP, `${id}-in`);

  // stream download with size guard
  const response = await axios.get(url, {
    responseType: "stream",
    timeout: 60000,
    maxRedirects: 5,
    validateStatus: () => true
  });

  const ctype = (response.headers["content-type"] || "").toLowerCase();
  if (!ctype || ctype.includes("text/html"))
    throw new Error("This URL returned HTML (a web page).");

  // write stream to tmp
  await new Promise((resolve, reject) => {
    let downloaded = 0;
    const ws = fs.createWriteStream(tmpIn);
    response.data.on("data", chunk => {
      downloaded += chunk.length;
      if (downloaded > MAX_DOWNLOAD_BYTES) {
        ws.destroy(new Error("File too large"));
        response.data.destroy();
      }
    });
    ws.on("finish", resolve);
    ws.on("error", reject);
    response.data.pipe(ws);
  });

  // transcode/remux to final target
  const outName  = `${id}.${target}`;
  const outPath  = path.join(OUT, outName);
  await new Promise((resolve, reject) => {
    let cmd = ffmpeg(tmpIn);
    if (target === "mp3") {
      cmd = cmd.noVideo().audioCodec("libmp3lame").format("mp3");
    } else {
      cmd = cmd
        .videoCodec("libx264").audioCodec("aac")
        .outputOptions(["-preset","veryfast","-crf","23","-movflags","+faststart"])
        .format("mp4");
    }
    cmd.on("start", c => console.log("FFMPEG CMD:", c))
       .on("stderr", l => console.log("FFMPEG:", l))
       .on("end", resolve)
       .on("error", reject)
       .save(outPath);
  });

  fs.promises.unlink(tmpIn).catch(() => {});
  cleanLater(outPath);
  return { url: `/out/${outName}` };
}

// ---------- express app ----------
const app = express();
// Serve everything in /public as static files
app.use(express.static("public"));

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(express.static(PUBLIC));
app.use(express.json({ limit: "2mb" }));
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

// simple request log (optional)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// health
app.get("/api/health", async (_req, res) => {
  try {
    const { out } = await run(YTDLP_PATH, ["--version"]);
    res.json({ ok: true, ffmpeg: !!ffmpegStatic, yt_dlp: out.trim() });
  } catch (e) {
    handleError(res, e, 500);
  }
});

// AUTO: pick yt-dlp vs direct file
app.post("/api/auto", async (req, res) => {
  try {
    const rawUrl = (req.body?.url || "").trim();
    const url    = normalizeUrl(rawUrl);
    const target = (req.body?.format || "mp3").toLowerCase();

    if (!isHttpUrl(url)) return res.status(400).json({ error: "Provide a URL." });
    if (!["mp3","mp4"].includes(target)) return res.status(400).json({ error: "format must be mp3 or mp4" });

    if (looksLikePlatform(url)) {
      const data = await queue.add(() => handlePlatform(url, target));
      return res.json({ ok: true, ...data });
    }

    const ctype = await fetchContentType(url);
    if (!ctype || ctype.includes("text/html")) {
      const data = await queue.add(() => handlePlatform(url, target));
      return res.json({ ok: true, ...data });
    }

    const data = await queue.add(() => handleDirect(url, target));
    return res.json({ ok: true, ...data });
  } catch (e) {
    handleError(res, e, 500);
  }
});

// PLATFORM (YouTube/TikTok/Twitter/Reddit/IG/Facebook) explicitly
app.post("/api/yt", async (req, res) => {
  try {
    const url    = normalizeUrl(req.body?.url || "");
    const target = (req.body?.format || "mp3").toLowerCase();

    if (!isHttpUrl(url)) return res.status(400).json({ error: "Provide a URL." });
    if (!["mp3","mp4"].includes(target)) return res.status(400).json({ error: "format must be mp3 or mp4" });

    const data = await queue.add(() => handlePlatform(url, target));
    res.json({ ok: true, ...data });
  } catch (e) {
    handleError(res, e, 500);
  }
});

// DIRECT file → MP3/MP4
app.post("/api/convert", async (req, res) => {
  try {
    const url    = normalizeUrl(req.body?.url || "");
    const target = (req.body?.format || "mp3").toLowerCase();

    if (!isHttpUrl(url)) return res.status(400).json({ error: "Provide a direct http(s) media URL." });
    if (!["mp3","mp4"].includes(target)) return res.status(400).json({ error: "format must be mp3 or mp4" });

    const data = await queue.add(() => handleDirect(url, target));
    res.json({ ok: true, ...data });
  } catch (e) {
    handleError(res, e, 500);
  }
});

// ---------- start server ----------
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.ALLOW_PUBLIC === "1" ? "0.0.0.0" : "127.0.0.1";

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});

