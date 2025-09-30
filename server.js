// server.js — Dripl (remote-first cookies)
// Priority: Remote URL (+optional headers) -> Secret Files -> (missing)
// Endpoints: /api/probe, /api/download, /debug/cookies, /admin/reload-cookies

import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import axios from "axios";
import { nanoid } from "nanoid";
import { tmpdir } from "os";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------- ENV --------
const PORT = process.env.PORT || 10000;
const PROXY_URL = process.env.PROXY_URL || "";
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, "public");
const COOKIES_DIR = process.env.COOKIES_DIR || path.join(__dirname, "cookies");
const COOKIE_TIKTOK = process.env.COOKIE_TIKTOK || path.join(COOKIES_DIR, "tiktok.txt");
const COOKIE_YOUTUBE = process.env.COOKIE_YOUTUBE || path.join(COOKIES_DIR, "youtube.txt");

// Remote fetch (e.g. GitHub API “contents” URLs)
const COOKIE_TIKTOK_URL   = (process.env.COOKIE_TIKTOK_URL   || "").trim();
const COOKIE_YOUTUBE_URL  = (process.env.COOKIE_YOUTUBE_URL  || "").trim();
// Optional JSON headers, e.g. {"Authorization":"Bearer <github_pat_...>","Accept":"application/vnd.github.v3.raw"}
const COOKIE_TIKTOK_HEADERS  = safeParseJSON(process.env.COOKIE_TIKTOK_HEADERS);
const COOKIE_YOUTUBE_HEADERS = safeParseJSON(process.env.COOKIE_YOUTUBE_HEADERS);

const ADMIN_TOKEN       = (process.env.ADMIN_TOKEN || "").trim();
const YTDLP_EXTRA_ARGS  = (process.env.YTDLP_EXTRA_ARGS || "").trim();
const YTDLP             = "/usr/local/bin/yt-dlp";

// -------- utils --------
function safeParseJSON(s) {
  try { return s ? JSON.parse(s) : undefined; } catch { return undefined; }
}
const fileExists = (p) => { try { fs.accessSync(p, fs.constants.R_OK); return true; } catch { return false; } };
const sanitizeName = (s) => s?.replace(/[^\p{L}\p{N}\-_.\s]/gu, "").trim().slice(0,120) || "dripl";
const splitArgs = (s) => (s ? s.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(a => a.replace(/^"(.*)"$/, "$1")) ?? [] : []);

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", d => stdout += d.toString());
    child.stderr.on("data", d => stderr += d.toString());
    child.on("close", code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || `yt-dlp exit ${code}`)));
  });
}

function pickCookieFor(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("youtube.") || host.includes("youtu.be")) return fileExists(COOKIE_YOUTUBE) ? COOKIE_YOUTUBE : null;
    if (host.includes("tiktok.")) return fileExists(COOKIE_TIKTOK) ? COOKIE_TIKTOK : null;
    return null;
  } catch { return null; }
}

function pickFormat({ audioOnly, quality }) {
  if (audioOnly) return "bestaudio[ext=m4a]/bestaudio/best";
  if (quality === "1080p") return "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";
  if (quality === "720p")  return "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";
  return "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";
}

async function fetchToFile(url, outPath, headers) {
  const resp = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxContentLength: Infinity,
    headers: headers || undefined
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, resp.data);
  return fs.statSync(outPath).size;
}

// -------- cookie load (REMOTE FIRST) --------
async function loadCookiesOnce() {
  fs.mkdirSync(COOKIES_DIR, { recursive: true });

  // 1) Remote fetch first (if URLs provided)
  const remotes = [
    { key: "tiktok",  url: COOKIE_TIKTOK_URL,  dest: COOKIE_TIKTOK,  headers: COOKIE_TIKTOK_HEADERS },
    { key: "youtube", url: COOKIE_YOUTUBE_URL, dest: COOKIE_YOUTUBE, headers: COOKIE_YOUTUBE_HEADERS },
  ];
  for (const r of remotes) {
    if (r.url) {
      try {
        const sz = await fetchToFile(r.url, r.dest, r.headers);
        console.log(`[dripl] ${r.key} cookies fetched from URL -> ${r.dest} (${sz} bytes)`);
      } catch (e) {
        console.warn(`[dripl] ${r.key} cookie fetch failed: ${e?.message || e}`);
      }
    }
  }

  // 2) Secret Files fallback (Render → /etc/secrets/<filename>)
  const secretCandidates = {
    tiktok:  ["/etc/secrets/tiktok.txt",  "/etc/secrets/ttcookies.txt"],
    youtube: ["/etc/secrets/youtube.txt", "/etc/secrets/ytcookies.txt"]
  };
  for (const [key, candidates] of Object.entries(secretCandidates)) {
    const dest = key === "tiktok" ? COOKIE_TIKTOK : COOKIE_YOUTUBE;
    if (!fileExists(dest)) {
      const found = candidates.find(p => fileExists(p));
      if (found) {
        fs.copyFileSync(found, dest);
        const sz = fs.statSync(dest).size;
        console.log(`[dripl] ${key} cookies loaded from secret file -> ${dest} (${sz} bytes)`);
      }
    }
  }

  // Summary (quick, non-chatty)
  const haveTT = fileExists(COOKIE_TIKTOK),  ttSz = haveTT ? fs.statSync(COOKIE_TIKTOK).size : 0;
  const haveYT = fileExists(COOKIE_YOUTUBE), ytSz = haveYT ? fs.statSync(COOKIE_YOUTUBE).size : 0;
  console.log(`[dripl] cookies summary -> TT: ${haveTT ? "ok" : "missing"} (${ttSz}), YT: ${haveYT ? "ok" : "missing"} (${ytSz})`);
}

// -------- app --------
const app = express();
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));
app.use("/api/", rateLimit({ windowMs: 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false }));

if (fileExists(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));
  console.log(`[dripl] serving static from ${STATIC_DIR}`);
} else {
  console.log(`[dripl] no static dir at ${STATIC_DIR} (ok)`);
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "dripl", time: new Date().toISOString() }));

app.get("/debug/cookies", (_req, res) => {
  res.json({
    dir: COOKIES_DIR,
    tiktok_exists: fileExists(COOKIE_TIKTOK),
    youtube_exists: fileExists(COOKIE_YOUTUBE),
    tiktok_size: fileExists(COOKIE_TIKTOK) ? fs.statSync(COOKIE_TIKTOK).size : 0,
    youtube_size: fileExists(COOKIE_YOUTUBE) ? fs.statSync(COOKIE_YOUTUBE).size : 0,
    tiktok_url_set: Boolean(COOKIE_TIKTOK_URL),
    youtube_url_set: Boolean(COOKIE_YOUTUBE_URL)
  });
});

app.post("/admin/reload-cookies", async (req, res) => {
  if (!ADMIN_TOKEN || req.get("x-admin-token") !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    await loadCookiesOnce();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
});

// Probe (metadata only)
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
    const a = stdout.indexOf("{"), b = stdout.lastIndexOf("}");
    const json = (a >= 0 && b > a) ? JSON.parse(stdout.slice(a, b+1)) : {};
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Download
app.post("/api/download", async (req, res) => {
  const t0 = Date.now();
  try {
    const { url, audioOnly = false, quality = "", filename = "" } = req.body || {};
    if (!url) return res.status(400).json({ error: "Missing url" });

    const format = pickFormat({ audioOnly, quality });
    const cookieFile = pickCookieFor(url);

    const id = nanoid(10);
    const base = sanitizeName(filename) || "dripl";
    const ext = audioOnly ? "m4a" : "mp4";
    const outPath = path.join(tmpdir(), `${base}-${id}.%(ext)s`);

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
    const candidates = fs.readdirSync(tmp).filter(f => f.startsWith(base) && f.includes(id)).map(f => path.join(tmp, f));
    if (!candidates.length) return res.status(500).json({ error: "No output file was produced." });
    const filePath = candidates.find(f => f.endsWith(`.${ext}`)) || candidates[0];

    const stat = fs.statSync(filePath);
    res.setHeader("Content-Type", audioOnly ? "audio/mp4" : "video/mp4");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(filePath)}"`);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on("close", () => { fs.unlink(filePath, () => {}); console.log(`[dripl] served in ${Date.now() - t0}ms`); });
    stream.on("error", e => { console.error("stream error", e); fs.unlink(filePath, () => {}); });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Root
app.get("/", (_req, res) => res.type("text").send("dripl api is up. POST /api/download"));

// Boot
(async () => {
  try { await loadCookiesOnce(); } catch (e) { console.warn("[dripl] cookie init warn:", e?.message || e); }
  const server = app.listen(PORT, () => {
    console.log(`[dripl] server listening on :${PORT}`);
    if (PROXY_URL) console.log(`[dripl] using proxy ${PROXY_URL}`);
    console.log(`[dripl] cookies dir ${COOKIES_DIR}`);
    if (YTDLP_EXTRA_ARGS) console.log(`[dripl] extra yt-dlp args: ${YTDLP_EXTRA_ARGS}`);
  });
  server.keepAliveTimeout = 75_000;
  server.headersTimeout   = 90_000;
})();






























