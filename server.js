// server.js (ESM)
// ------------------------------------------------------------
// Dripl backend: YouTube/TikTok/etc -> MP3 / MP4 with yt-dlp
// - Cookies via env: YTDLP_COOKIES_B64 (base64 of UTF-8 (no BOM) Netscape cookies.txt)
// - ffmpeg/ffprobe wired via PATH (ffmpeg-static / @ffprobe-installer/ffprobe)
// - Deterministic output folder: /public/out
// - Single endpoint: POST /api/convert  { url, kind: "mp3" | "mp4" }
// ------------------------------------------------------------

// ========== Imports ==========
import express from "express";
import helmet from "helmet";
import cors from "cors";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import ffmpegStatic from "ffmpeg-static";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

// ========== Helper: resolve dirname ==========
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== Paths & Folders ==========
const PUBLIC = path.join(__dirname, "public");
const OUT = path.join(PUBLIC, "out");
for (const d of [PUBLIC, OUT]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ========== ffmpeg / ffprobe wiring ==========
const FFMPEG_BIN = (ffmpegStatic || "").toString().replace(/\\/g, "/") || "";
const FFPROBE_BIN = (ffprobeInstaller?.path || "").toString().replace(/\\/g, "/") || "";
const sep = process.platform === "win32" ? ";" : ":";

// Prepend bins to PATH so yt-dlp can find them
process.env.PATH = [
  path.dirname(FFMPEG_BIN || ""),
  path.dirname(FFPROBE_BIN || ""),
  process.env.PATH || ""
].filter(Boolean).join(sep);

// Also export explicit env (some setups prefer these)
process.env.FFMPEG_PATH = FFMPEG_BIN;
process.env.FFPROBE_PATH = FFPROBE_BIN;

// ========== yt-dlp path detection ==========
function resolveYtDlpPath() {
  if (process.platform === "win32") {
    const localWin = path.join(__dirname, "yt-dlp.exe");
    if (fs.existsSync(localWin)) return localWin;
  }
  return "yt-dlp"; // rely on system PATH (Render image includes it)
}
const YTDLP_BIN = resolveYtDlpPath();

// ========== Cookies helpers (env -> temp file) ==========
function ensureCookiesFileFromEnv() {
  let raw = (process.env.YTDLP_COOKIES_B64 || "").trim();
  if (!raw) {
    console.log("[cookies] none");
    return null;
  }

  // remove whitespace/newlines to be safe
  raw = raw.replace(/\s+/g, "");

  let buf = Buffer.from(raw, "base64");
  // Strip UTF-8 BOM if present
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    buf = buf.slice(3);
  }

  // Light sanity preview (won't log secrets)
  try {
    const preview = buf.slice(0, 28).toString("utf8");
    console.log("[cookies] preview:", preview.replace(/\r|\n/g, " ").slice(0, 48));
  } catch {
    console.warn("[cookies] preview decode failed (non-UTF8?)");
  }

  const tmpPath = path.join("/tmp", `cookies-${Date.now()}.txt`);
  fs.writeFileSync(tmpPath, buf);
  console.log("[cookies] wrote temp file:", tmpPath, "bytes:", buf.length);
  return tmpPath;
}

// ========== Utility: run yt-dlp once ==========
function spawnYtDlp(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_BIN, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) return resolve({ code, stdout, stderr });
      const e = new Error(`yt-dlp exit ${code}\n${stderr || stdout}`);
      e.code = code;
      e.stdout = stdout;
      e.stderr = stderr;
      reject(e);
    });
  });
}

// ========== Core: runYtDlp(url, kind) ==========
async function runYtDlp({ url, kind }) {
  // Ensure output dir
  fs.mkdirSync(OUT, { recursive: true });




