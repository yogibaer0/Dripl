// server.js
import express from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

const app = express();
app.use(express.json({ limit: "2mb" }));

// ---------- CONFIG ----------
// Absolute or PATH-resolved yt-dlp binary
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";

// Where to save finished files
const OUTPUT_DIR = process.env.OUTPUT_DIR || "/app/output";

// One or more cookie files (full paths). Comma-separated in env.
const COOKIE_FILES = (process.env.COOKIE_FILES || "/app/secrets/cookies1.txt,/app/secrets/cookies2.txt")
  .split(",")
  .map(s => s.trim())
  .filter(p => p && fs.existsSync(p));

// One or more proxies. Use full URL form: http://user:pass@host:port
// Tip: keep 1–2 for now; add more later if you scale.
const PROXIES = (process.env.PROXIES || process.env.PROXY_URL || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean); // can be empty; we handle "no proxy"

// Optional: try alternate YT client; set to "android" to enable
const YT_CLIENT = process.env.YT_CLIENT || ""; // "android" or ""

// Per-request timeout (ms) for yt-dlp
const YTDLP_TIMEOUT_MS = Number(process.env.YTDLP_TIMEOUT_MS || 120_000);

// ---------- UTIL ----------
function ensureDirs() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
ensureDirs();

function classify(stderrAll) {
  const s = (stderrAll || "").toLowerCase();
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

function ytArgs({ url, cookies, proxy }) {
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
    "--merge-output-format", "mp4",
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "-f", 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best',
    "-o", path.join(OUTPUT_DIR, "%(title).200B-%(id)s.%(ext)s"),
    url,
    "-v"
  ];

  if (cookies) args.unshift("--cookies", cookies);
  if (proxy) args.unshift("--proxy", proxy);
  if (YT_CLIENT === "android") {
    args.unshift("--extractor-args", "youtube:player_client=android");
  }
  return args;
}

function runYtDlp(opts) {
  return new Promise((resolve) => {
    const args = ytArgs(opts);
    const child = spawn(YTDLP, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";

    child.stdout.on("data", d => (out += d.toString()));
    child.stderr.on("data", d => (err += d.toString()));

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

// ---------- ROUTES ----------
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    cookieFiles: COOKIE_FILES.map(p => ({ path: p, exists: fs.existsSync(p) })),
    proxies: PROXIES.length,
  });
});

app.post("/api/convert", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ ok: false, error: "bad_url", message: "Please provide a valid http(s) URL." });
    }

    // build attempt plan (proxy x cookies); both lists can be empty
    const proxies = PROXIES.length ? PROXIES : [null];
    const cookies = COOKIE_FILES.length ? COOKIE_FILES : [null];

    const attempts = [];
    for (const p of proxies) for (const c of cookies) attempts.push({ proxy: p, cookies: c });

    let last = { type: "unknown", detail: "" };

    for (let i = 0; i < attempts.length; i++) {
      const { proxy, cookies } = attempts[i];
      console.log(`[convert] attempt ${i + 1}/${attempts.length} proxy=${proxy ? "on" : "off"} cookies=${cookies ? path.basename(cookies) : "none"}`);

      const r = await runYtDlp({ url, cookies, proxy });

      if (r.ok) {
        // pick the newest file
        const files = fs.readdirSync(OUTPUT_DIR)
          .map(f => ({ f, t: fs.statSync(path.join(OUTPUT_DIR, f)).mtimeMs }))
          .sort((a, b) => b.t - a.t);
        const newest = files[0]?.f;
        if (!newest) {
          last = { type: "unknown", detail: "no_output_file" };
          continue;
        }
        return res.json({ ok: true, file: `/download/${encodeURIComponent(newest)}` });
      }

      const cls = classify((r.err || "") + "\n" + (r.out || ""));
      last = { type: cls.type, detail: cls.hint, raw: (r.err || "").slice(0, 2000) };
      console.warn(`[convert] FAIL via proxy=${proxy ? "on" : "off"} cookies=${cookies ? path.basename(cookies) : "none"}; type=${cls.type}; code=${r.code}`);
    }

    // map failure → status/message key
    const map = {
      auth:     { status: 401, key: "yt_403_auth", message: "YouTube blocked the request (403). Refresh cookies or use a different account export." },
      rate:     { status: 429, key: "yt_429_ratelimit", message: "Too many requests (429). Please try again later or rotate proxy/IP." },
      agegate:  { status: 451, key: "yt_age_gate", message: "Age-restricted content. Use logged-in cookies that can view the video." },
      geo:      { status: 451, key: "yt_geo_block", message: "This video is not available in your region. Try a proxy in an allowed region." },
      extractor:{ status: 502, key: "yt_extractor", message: "Extractor hiccup. Retrying with alternate client or updating yt-dlp usually fixes this." },
      proxy:    { status: 502, key: "proxy_failed", message: "Proxy connection failed. Check credentials or switch to a fresh IP." },
      tls:      { status: 502, key: "tls_error", message: "TLS/SSL handshake failed. Try --force-ipv4, another proxy, or update OpenSSL." },
      timeout:  { status: 504, key: "upstream_timeout", message: "Upstream timed out. The video/network is slow—try again or use a different proxy." },
      unknown:  { status: 502, key: "unknown_upstream", message: "Upstream failed for an unknown reason. Please try again." },
    };
    const m = map[last.type] || map.unknown;
    return res.status(m.status).json({ ok: false, error: m.key, message: m.message, detail: last.detail });

  } catch (e) {
    console.error("[convert] fatal", e);
    return res.status(500).json({ ok: false, error: "server_crash", message: "Server error. Check logs." });
  }
});

// simple download route
app.get("/download/:file", (req, res) => {
  const file = path.join(OUTPUT_DIR, req.params.file);
  if (!fs.existsSync(file)) return res.status(404).send("Not found");
  res.download(file);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[dripl] server listening on :${PORT}`);
});











