import express from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import url from "url";
import ffmpegPath from "ffmpeg-static";

const app = express();

// allow large JSON bodies (for cookie uploads)
app.use(express.json({ limit: "8mb" }));

// ---- Paths / Dirs ----
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.OUTPUT_DIR || "/app/output";
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, "public");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const YTDLP = process.env.YTDLP_PATH || "yt-dlp";
const YTDLP_TIMEOUT_MS = Number(process.env.YTDLP_TIMEOUT_MS || 120_000);
const YT_CLIENT = process.env.YT_CLIENT || ""; // "android" to try alt client
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

// ---- Cookies (read from /etc/secrets) ----
const DEFAULT_COOKIE_PATHS = [
  "/etc/secrets/cookies1.txt",
  "/etc/secrets/cookies2.txt",
];

let COOKIE_FILES = (process.env.COOKIE_FILES || DEFAULT_COOKIE_PATHS.join(","))
  .split(",").map(s => s.trim()).filter(Boolean)
  .filter(p => fs.existsSync(p));

function cookieStats() {
  return COOKIE_FILES.map(p => ({
    path: p,
    exists: fs.existsSync(p),
    size: fs.existsSync(p) ? fs.statSync(p).size : 0,
    lines: fs.existsSync(p) ? (fs.readFileSync(p, "utf8").match(/\n/g) || []).length + 1 : 0,
  }));
}

// ---- Proxies ----
let PROXIES = (process.env.PROXIES || process.env.PROXY_URL || "")
  .split(",").map(s => s.trim()).filter(Boolean);
let rrIndex = 0;

// ---- Static hosting ----
if (fs.existsSync(STATIC_DIR)) {
  console.log(`[dripl] serving static from ${STATIC_DIR}`);
  app.use(express.static(STATIC_DIR, { maxAge: "1h", extensions: ["html"] }));
}

// ---- Helpers ----
function classify(stderrAll = "") {
  const s = stderrAll.toLowerCase();
  if (s.includes("http error 403") || s.includes("forbidden")) return { type: "auth", hint: "403" };
  if (s.includes("http error 429") || s.includes("too many requests")) return { type: "rate", hint: "429" };
  if (s.includes("sign in to confirm your age")) return { type: "agegate", hint: "age-gate" };
  if (s.includes("geo-restricted") || s.includes("not available in your country")) return { type: "geo", hint: "geo" };
  if (s.includes("unable to extract") || s.includes("player url") || s.includes("decipher")) return { type: "extractor", hint: "extractor" };
  if (s.includes("proxy") && (s.includes("failed") || s.includes("tunnel") || s.includes("connection"))) return { type: "proxy", hint: "proxy" };
  if (s.includes("ssl:") || s.includes("certificate")) return { type: "tls", hint: "tls" };
  if (s.includes("timeout") || s.includes("timed out")) return { type: "timeout", hint: "timeout" };
  return { type: "unknown", hint: "" };
}

function ytArgs({ url, cookies, proxy, format }) {
  const formatArgs = (format === "mp3")
    ? ["-f", "ba/b", "--extract-audio", "--audio-format", "mp3", "--audio-quality", "0"]
    : ["-f", 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best', "--merge-output-format", "mp4"];

  const args = [
    "--force-ipv4",
    "--concurrent-fragments", "1",
    "--retries", "3",
    "--fragment-retries", "3",
    "--file-access-retries", "3",
    "--sleep-requests", "0.5",
    "--sleep-interval", "0.5",
    "--max-sleep-interval", "1",
    "--restrict-filenames",
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ...formatArgs,
    "-o", path.join(OUTPUT_DIR, "%(title).200B-%(id)s.%(ext)s"),
    url,
    "-v"
  ];
  if (cookies) args.unshift("--cookies", cookies);
  if (proxy) args.unshift("--proxy", proxy);
  if (YT_CLIENT === "android") args.unshift("--extractor-args", "youtube:player_client=android");
  if (ffmpegPath) args.unshift("--ffmpeg-location", ffmpegPath);
  return args;
}

function runYtDlp(opts) {
  return new Promise((resolve) => {
    const args = ytArgs(opts);
    const child = spawn(YTDLP, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";

    child.stdout.on("data", d => (out += d.toString()));
    child.stderr.on("data", d => (err += d.toString()));

    child.on("error", (e) => {
      resolve({ ok: false, code: "spawn_error", out, err: `spawn_error: ${e.message}` });
    });

    const t = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch {}
      resolve({ ok: false, code: "timeout", out, err });
    }, YTDLP_TIMEOUT_MS);

    child.on("close", (code) => {
      clearTimeout(t);
      resolve({ ok: code === 0, code, out, err });
    });
  });
}

// ---- Routes ----
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    cookieFiles: cookieStats(),
    proxies: PROXIES,
    roundRobinIndex: rrIndex,
    static: fs.existsSync(STATIC_DIR),
  });
});

app.post("/api/convert", async (req, res) => {
  try {
    const { url, format, proxyIndex, proxyUrl, rotate } = req.body || {};
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ ok: false, error: "bad_url", message: "Please provide a valid http(s) URL." });
    }

    let proxiesToTry = [null];
    if (PROXIES.length) {
      if (proxyUrl) {
        proxiesToTry = [proxyUrl];
      } else if (typeof proxyIndex === "number" && PROXIES[proxyIndex]) {
        proxiesToTry = [PROXIES[proxyIndex]];
      } else {
        if (rotate === "next") rrIndex = (rrIndex + 1) % PROXIES.length;
        proxiesToTry = [PROXIES[rrIndex]];
      }
    }

    const cookies = COOKIE_FILES.length ? COOKIE_FILES : [null];
    const attempts = [];
    for (const p of proxiesToTry) for (const c of cookies) attempts.push({ proxy: p, cookies: c });

    let last = { type: "unknown", detail: "", raw: "" };

    for (let i = 0; i < attempts.length; i++) {
      const { proxy, cookies } = attempts[i];
      console.log(`[convert] attempt ${i + 1}/${attempts.length} proxy=${proxy ? "on" : "off"} cookies=${cookies ? path.basename(cookies) : "none"}`);

      const r = await runYtDlp({ url, cookies, proxy, format });

      if (r.ok) {
        const files = fs.readdirSync(OUTPUT_DIR)
          .map(f => ({ f, t: fs.statSync(path.join(OUTPUT_DIR, f)).mtimeMs }))
          .sort((a, b) => b.t - a.t);
        const newest = files[0]?.f;
        if (!newest) { last = { type: "unknown", detail: "no_output_file" }; continue; }
        return res.json({ ok: true, file: `/download/${encodeURIComponent(newest)}` });
      }

      const cls = classify((r.err || "") + "\n" + (r.out || ""));
      last = { type: cls.type, detail: cls.hint, raw: (r.err || "").slice(0, 2000) };
      console.warn(`[convert] FAIL via proxy=${proxy ? "on" : "off"} cookies=${cookies ? path.basename(cookies) : "none"}; type=${cls.type}; code=${r.code}`);
    }

    const map = {
      auth:     { status: 401, key: "yt_403_auth",      message: "YouTube blocked the request (403). Refresh cookies or use a different account export." },
      rate:     { status: 429, key: "yt_429_ratelimit", message: "Too many requests (429). Please try again later or rotate proxy/IP." },
      agegate:  { status: 451, key: "yt_age_gate",      message: "Age-restricted content. Use logged-in cookies that can view the video." },
      geo:      { status: 451, key: "yt_geo_block",     message: "This video is not available in your region. Try a proxy in an allowed region." },
      extractor:{ status: 502, key: "yt_extractor",     message: "Extractor hiccup. Try again, switch client, or update yt-dlp." },
      proxy:    { status: 502, key: "proxy_failed",     message: "Proxy connection failed. Check credentials or switch to a fresh IP." },
      tls:      { status: 502, key: "tls_error",        message: "TLS/SSL handshake failed. Try another proxy or keep IPv4." },
      timeout:  { status: 504, key: "upstream_timeout", message: "Upstream timed out. Try again or use a different proxy." },
      unknown:  { status: 502, key: "unknown_upstream", message: "Upstream failed for an unknown reason. Please try again." },
    };
    const m = map[last.type] || map.unknown;
    const payload = { ok: false, error: m.key, message: m.message, detail: last.detail };

    if (ADMIN_TOKEN && req.headers["x-admin-token"] === ADMIN_TOKEN) {
      payload.raw = last.raw || "";
    }

    return res.status(m.status).json(payload);

  } catch (e) {
    console.error("[convert] fatal", e);
    return res.status(500).json({ ok: false, error: "server_crash", message: "Server error. Check logs." });
  }
});

app.get("/download/:file", (req, res) => {
  const file = path.join(OUTPUT_DIR, req.params.file);
  if (!fs.existsSync(file)) return res.status(404).send("Not found");
  res.download(file);
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/download") || !fs.existsSync(STATIC_DIR)) return next();
  res.sendFile(path.join(STATIC_DIR, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[dripl] server listening on :${PORT}`);
});













