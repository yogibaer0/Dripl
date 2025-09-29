// server.js — Dripl (yt-dlp + static UI + cookies via path/B64/multipart + debug)
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
import zlib from "zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- ENV
const PORT = process.env.PORT || 10000;
const PROXY_URL = process.env.PROXY_URL || "";
const COOKIES_DIR = process.env.COOKIES_DIR || path.join(__dirname, "cookies");
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, "public");
const YTDLP_EXTRA_ARGS = (process.env.YTDLP_EXTRA_ARGS || "").trim();

// Cookie file targets (where to write decoded cookies)
const COOKIE_YOUTUBE = process.env.COOKIE_YOUTUBE || path.join(COOKIES_DIR, "youtube.txt");
const COOKIE_TIKTOK  = process.env.COOKIE_TIKTOK  || path.join(COOKIES_DIR, "tiktok.txt");

// Base64 (single-var form also supported)
const COOKIE_YOUTUBE_B64 = process.env.COOKIE_YOUTUBE_B64 || "";
const COOKIE_TIKTOK_B64  = process.env.COOKIE_TIKTOK_B64  || "";

// ---- Helpers
const YTDLP = "/usr/local/bin/yt-dlp";
const fileExists = (p) => { try { fs.accessSync(p, fs.constants.R_OK); return true; } catch { return false; } };

// Read multipart envs like PREFIX_1, PREFIX_2, ... then join in order.
// If the *single* key exists, the caller should prefer it instead of this.
function readMultipartEnv(prefix) {
  const parts = Object.entries(process.env)
    .filter(([k]) => k.toUpperCase().startsWith((prefix + "_").toUpperCase()))
    .map(([k, v]) => {
      const m = k.match(/_(\d+)$/);
      return { idx: m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER, v };
    })
    .filter(x => Number.isFinite(x.idx))
    .sort((a, b) => a.idx - b.idx)
    .map(x => x.v);
  return parts.length ? parts.join("") : "";
}

// Write Base64 (or GZ+Base64) to target path
function writeCookieFromB64IfAny(targetPath, b64) {
  const joined = (b64 || "").trim();
  if (!joined) return false;

  let data;
  try {
    if (/^GZ:/i.test(joined)) {
      const raw = Buffer.from(joined.slice(3), "base64");
      data = zlib.gunzipSync(raw);
    } else {
      data = Buffer.from(joined, "base64");
    }
  } catch (e) {
    console.warn(`[dripl] cookie decode failed for ${path.basename(targetPath)}:`, e?.message || e);
    return false;
  }

  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, data);
    return true;
  } catch (e) {
    console.warn(`[dripl] cookie write failed for ${targetPath}:`, e?.message || e);
    return false;
  }
}

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
const splitArgs = (s) => (s ? s.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(a => a.replace(/^"(.*)"$/, "$1")) ?? [] : []);
const runYtDlp = (args) => new Promise((resolve, reject) => {
  const child = spawn(YTDLP, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", d => stdout += d.toString());
  child.stderr.on("data", d => stderr += d.toString());
  child.on("close", code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || `yt-dlp exit ${code}`)));
});

// ===== Cookie init + ultra-verbose diagnostics =====
function envLen(s) { return (typeof s === "string") ? s.length : 0; }
function countPartVars(prefix) {
  const re = new RegExp(`^${prefix}_\\d+$`, "i");
  return Object.keys(process.env).filter(k => re.test(k)).length;
}

// Returns { ok:boolean, data?:Buffer, error?:string, joinedLen:number, isGz:boolean }
function decodeCookieB64(joined) {
  const s = (joined || "").trim();
  const isGz = /^GZ:/i.test(s);
  const joinedLen = s.length;
  if (!s) return { ok:false, error:"empty", joinedLen, isGz:false };
  try {
    if (isGz) {
      const raw = Buffer.from(s.slice(3), "base64");
      const data = zlib.gunzipSync(raw);
      return { ok:true, data, joinedLen, isGz:true };
    } else {
      const data = Buffer.from(s, "base64");
      return { ok:true, data, joinedLen, isGz:false };
    }
  } catch (e) {
    return { ok:false, error: String(e?.message || e), joinedLen, isGz };
  }
}

function readMultipartEnv(prefix) {
  const parts = Object.entries(process.env)
    .filter(([k]) => k.toUpperCase().startsWith((prefix + "_").toUpperCase()))
    .map(([k, v]) => {
      const m = k.match(/_(\d+)$/);
      return { idx: m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER, v };
    })
    .filter(x => Number.isFinite(x.idx))
    .sort((a, b) => a.idx - b.idx)
    .map(x => x.v);
  return parts.length ? parts.join("") : "";
}

try {
  fs.mkdirSync(COOKIES_DIR, { recursive: true });

  const ttSingle = (process.env.COOKIE_TIKTOK_B64 || "").trim();
  const ytSingle = (process.env.COOKIE_YOUTUBE_B64 || "").trim();
  const ttPartsCount = countPartVars("COOKIE_TIKTOK_B64");
  const ytPartsCount = countPartVars("COOKIE_YOUTUBE_B64");

  // Prefer single (if non-empty) over parts
  const ttJoined = ttSingle || readMultipartEnv("COOKIE_TIKTOK_B64");
  const ytJoined = ytSingle || readMultipartEnv("COOKIE_YOUTUBE_B64");

  console.log(`[dripl] cookie envs: TT single=${envLen(ttSingle)} chars, TT parts=${ttPartsCount}; YT single=${envLen(ytSingle)} chars, YT parts=${ytPartsCount}`);

  const ttDec = decodeCookieB64(ttJoined);
  console.log(`[dripl] TT joined_len=${ttDec.joinedLen}, isGZ=${ttDec.isGz}, decode_ok=${ttDec.ok}${ttDec.error ? `, error=${ttDec.error}` : ""}`);

  const ytDec = decodeCookieB64(ytJoined);
  console.log(`[dripl] YT joined_len=${ytDec.joinedLen}, isGZ=${ytDec.isGz}, decode_ok=${ytDec.ok}${ytDec.error ? `, error=${ytDec.error}` : ""}`);

  if (ttDec.ok) {
    try {
      fs.writeFileSync(COOKIE_TIKTOK, ttDec.data);
      const sz = fs.statSync(COOKIE_TIKTOK).size;
      console.log(`[dripl] TikTok cookies loaded -> ${COOKIE_TIKTOK} (${sz} bytes)`);
    } catch (e) {
      console.warn(`[dripl] TikTok cookie write failed: ${e?.message || e}`);
    }
  } else {
    console.log("[dripl] TikTok cookies not loaded (no env or decode failed).");
  }

  if (ytDec.ok) {
    try {
      fs.writeFileSync(COOKIE_YOUTUBE, ytDec.data);
      const sz = fs.statSync(COOKIE_YOUTUBE).size;
      console.log(`[dripl] YouTube cookies loaded -> ${COOKIE_YOUTUBE} (${sz} bytes)`);
    } catch (e) {
      console.warn(`[dripl] YouTube cookie write failed: ${e?.message || e}`);
    }
  } else {
    console.log("[dripl] YouTube cookies not loaded (no env or decode failed).");
  }
} catch (e) {
  console.warn("[dripl] cookie init fatal:", e?.message || e);
}

// ---- Debug route: show env counts, joined lengths, decode status, and file sizes
app.get("/debug/cookies", (_req, res) => {
  const ttSingle = (process.env.COOKIE_TIKTOK_B64 || "").trim();
  const ytSingle = (process.env.COOKIE_YOUTUBE_B64 || "").trim();
  const ttPartsCount = countPartVars("COOKIE_TIKTOK_B64");
  const ytPartsCount = countPartVars("COOKIE_YOUTUBE_B64");

  const ttJoined = ttSingle || readMultipartEnv("COOKIE_TIKTOK_B64");
  const ytJoined = ytSingle || readMultipartEnv("COOKIE_YOUTUBE_B64");

  const ttDec = decodeCookieB64(ttJoined);
  const ytDec = decodeCookieB64(ytJoined);

  res.json({
    env: {
      TT_single_len: envLen(ttSingle),
      TT_parts_count: ttPartsCount,
      TT_joined_len: ttDec.joinedLen,
      TT_is_gz: ttDec.isGz,
      TT_decode_ok: ttDec.ok,
      YT_single_len: envLen(ytSingle),
      YT_parts_count: ytPartsCount,
      YT_joined_len: ytDec.joinedLen,
      YT_is_gz: ytDec.isGz,
      YT_decode_ok: ytDec.ok
    },
    files: {
      dir: COOKIES_DIR,
      tiktok_exists: fileExists(COOKIE_TIKTOK),
      youtube_exists: fileExists(COOKIE_YOUTUBE),
      tiktok_size: fileExists(COOKIE_TIKTOK) ? fs.statSync(COOKIE_TIKTOK).size : 0,
      youtube_size: fileExists(COOKIE_YOUTUBE) ? fs.statSync(COOKIE_YOUTUBE).size : 0
    }
  });
});

// ===== App =====
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));
app.use("/api/", rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false }));

// Serve static UI
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

// ===== Debug route to inspect cookie envs/files =====
app.get("/debug/cookies", (_req, res) => {
  const info = {
    env: {
      TT_single_len: envLen(process.env.COOKIE_TIKTOK_B64 || ""),
      TT_parts_count: countPartVars("COOKIE_TIKTOK_B64"),
      YT_single_len: envLen(process.env.COOKIE_YOUTUBE_B64 || ""),
      YT_parts_count: countPartVars("COOKIE_YOUTUBE_B64"),
    },
    files: {
      dir: COOKIES_DIR,
      tiktok_exists: fileExists(COOKIE_TIKTOK),
      youtube_exists: fileExists(COOKIE_YOUTUBE),
      tiktok_size: fileExists(COOKIE_TIKTOK) ? fs.statSync(COOKIE_TIKTOK).size : 0,
      youtube_size: fileExists(COOKIE_YOUTUBE) ? fs.statSync(COOKIE_YOUTUBE).size : 0,
    }
  };
  res.json(info);
});

// ===== Routes =====
app.get("/health", (_req, res) => res.json({ ok: true, service: "dripl", time: new Date().toISOString() }));

app.post("/api/probe", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: "Missing url" });

    const args = ["--dump-single-json", "--simulate", "--no-warnings"];
    if (PROXY_URL) args.push("--proxy", PROXY_URL);
    const cookieFile = pickCookieFor(url);
    if (cookieFile) args.push("--cookies", cookieFile);
    if (YTDLP_EXTRA_ARGS) args.push(...splitArgs(YTDLP_EXTRA_ARGS));
    args.push(url);

    const { stdout } = await runYtDlp(args);
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
      "--no-check-certificates"
    ];
    if (PROXY_URL) args.push("--proxy", PROXY_URL);
    if (cookieFile) args.push("--cookies", cookieFile);
    if (YTDLP_EXTRA_ARGS) args.push(...splitArgs(YTDLP_EXTRA_ARGS));
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

app.get("/", (_req, res) => res.type("text").send("dripl api is up. POST /api/download"));

app.listen(PORT, () => {
  console.log(`[dripl] server listening on :${PORT}`);
  if (PROXY_URL) console.log(`[dripl] using proxy ${PROXY_URL}`);
  console.log(`[dripl] cookies dir ${COOKIES_DIR}`);
  if (YTDLP_EXTRA_ARGS) console.log(`[dripl] extra yt-dlp args: ${YTDLP_EXTRA_ARGS}`);
});























