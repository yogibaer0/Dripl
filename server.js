// server.js — Dripl (Docker/Render). Calls the yt-dlp binary directly + serves static UI.
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { tmpdir } from "os";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import rateLimit from "express-rate-limit";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- ENV
const PORT = process.env.PORT || 10000;
const PROXY_URL = process.env.PROXY_URL || "";
const COOKIES_DIR = process.env.COOKIES_DIR || path.join(__dirname, "cookies");

// NEW: allow serving your existing UI wherever it lives (default /public)
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, "public");

const COOKIE_YOUTUBE = process.env.COOKIE_YOUTUBE || path.join(COOKIES_DIR, "youtube.txt");
const COOKIE_TIKTOK  = process.env.COOKIE_TIKTOK  || path.join(COOKIES_DIR, "tiktok.txt");
const COOKIE_YOUTUBE_B64 = process.env.COOKIE_YOUTUBE_B64 || "";
const COOKIE_TIKTOK_B64  = process.env.COOKIE_TIKTOK_B64  || "";

// Ensure cookie files (from Base64 if provided)
try {
  fs.mkdirSync(COOKIES_DIR, { recursive: true });
  if (COOKIE_YOUTUBE_B64) fs.writeFileSync(COOKIE_YOUTUBE, Buffer.from(COOKIE_YOUTUBE_B64, "base64"));
  if (COOKIE_TIKTOK_B64)  fs.writeFileSync(COOKIE_TIKTOK,  Buffer.from(COOKIE_TIKTOK_B64,  "base64"));
} catch (e) {
  console.warn("[dripl] cookie init warn:", e?.message || e);
}

// ---- App
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));
app.use("/api/", rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false }));

// NEW: serve static UI if the folder exists
try {
  if (fs.existsSync(STATIC_DIR)) {
    app.use(express.static(STATIC_DIR));
    console.log(`[dripl] serving static from ${STATIC_DIR}`);
  } else {
    console.log(`[dripl] STATIC_DIR not found: ${STATIC_DIR}`);
  }
} catch (e) {
  console.log("[dripl] static serve skip:", e?.message || e);
}

// ---- Helpers
const YTDLP = "/usr/local/bin/yt-dlp"; // installed by Dockerfile
const fileExists = (p) => { try { fs.accessSync(p, fs.constants.R_OK); return true; } catch { return false; } };

const pickCookieFor = (url) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("youtube.") || host.includes("youtu.be")) return fileExists(COOKIE_YOUTUBE) ? COOKIE_YOUTUBE : null;
    if (host.includes("tiktok.")) return fileExists(COOKIE_TIKTOK) ? COOKIE_TIKTOK : null;
    return null;
  } catch { return null; }
};

const pickFormat = ({ audioOnly, quality }) => {
  if (audioOnly) return "bestaudio[ext=m4a]/bestaudio/best";
  if (quality === "1080p") return "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";
  if (quality === "720p")  return "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";
  return "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";
};

const sanitizeName = (s) => s?.replace(/[^\p{L}\p{N}\-_.\s]/gu, "").trim().slice(0,120) || "dripl";

const runYtDlp = (args) => new Promise((resolve, reject) => {
  const child = spawn(YTDLP, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", d => stdout += d.toString());
  child.stderr.on("data", d => stderr += d.toString());
  child.on("close", code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || `yt-dlp exit ${code}`)));
});

// ---- Routes
app.get("/health", (_req, res) => res.json({ ok: true, service: "dripl", time: new Date().toISOString() }));

app.post("/api/probe", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: "Missing url" });

    const args = [
      "--dump-single-json", "--simulate", "--no-warnings", "--no-call-home",
    ];
    if (PROXY_URL) args.push("--proxy", PROXY_URL);
    const cookieFile = pickCookieFor(url);
    if (cookieFile) args.push("--cookies", cookieFile);
    args.push(url);

    const { stdout } = await runYtDlp(args);
    // yt-dlp may print progress lines; parse last JSON block
    const lastBrace = stdout.lastIndexOf("}");
    const firstBrace = stdout.indexOf("{");
    const json = (firstBrace >= 0 && lastBrace > firstBrace) ? JSON.parse(stdout.slice(firstBrace, lastBrace+1)) : {};
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// body: { url, audioOnly?: boolean, quality?: "720p"|"1080p", filename?: string }
app.post("/api/download", async (req, res) => {
  const startedAt = Date.now();
  try {
    const { url, audioOnly = false, quality = "", filename = "" } = req.body || {};
    if (!url) return res.status(400).json({ error: "Missing url" });

    const format = pickFormat({ audioOnly, quality });
    const cookieFile = pickCookieFor(url);

    const id = nanoid(10);
    const outBase = sanitizeName(filename) || "dripl";
    const ext = audioOnly ? "m4a" : "mp4";
    const outPath = path.join(tmpdir(), `${outBase}-${id}.%(ext)s`);

    const args = [
      "-f", format,
      "-o", outPath,
      "--merge-output-format", audioOnly ? "m4a" : "mp4",
      "--retries", "6",
      "--fragment-retries", "10",
      "--no-warnings",
      "--no-call-home",
      "--no-check-certificates"
    ];
    if (PROXY_URL) args.push("--proxy", PROXY_URL);
    if (cookieFile) args.push("--cookies", cookieFile);
    args.push(url);

    await runYtDlp(args);

    const tmp = tmpdir();
    const candidates = fs.readdirSync(tmp).filter(f => f.startsWith(outBase) && f.includes(id)).map(f => path.join(tmp, f));
    if (!candidates.length) return res.status(500).json({ error: "No output file was produced." });
    const filePath = candidates.find(f => f.endsWith(`.${ext}`)) || candidates[0];

    const stat = fs.statSync(filePath);
    res.setHeader("Content-Type", audioOnly ? "audio/mp4" : "video/mp4");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(filePath)}"`);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on("close", () => { fs.unlink(filePath, () => {}); console.log(`[dripl] served in ${Date.now()-startedAt}ms`); });
    stream.on("error", e => { console.error("stream error", e); fs.unlink(filePath, () => {}); });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Root (fallback text if no index.html in STATIC_DIR)
app.get("/", (_req, res) => res.type("text").send("dripl api is up. POST /api/download"));

app.listen(PORT, () => {
  console.log(`[dripl] server listening on :${PORT}`);
  if (PROXY_URL) console.log(`[dripl] using proxy ${PROXY_URL}`);
  console.log(`[dripl] cookies dir ${COOKIES_DIR}`);
});



















