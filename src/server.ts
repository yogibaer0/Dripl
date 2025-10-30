import express from "express";
import fs from "fs/promises";
import crypto from "crypto";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";


const app = express();
app.set("trust proxy", true);
app.use(helmet());
app.use(cors());
app.use(morgan(isProd ? "combined" : "tiny"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ------- Static assets -------
const PUBLIC_DIR = path.join(process.cwd(), "public");
app.use("/vendor", express.static(path.join(PUBLIC_DIR, "vendor"), { immutable: true, maxAge: "365d" }));
app.use(express.static(PUBLIC_DIR, { maxAge: "1h" }));

// ------- CSP with per-request nonce -------
app.use((req, res, next) => {
  const nonce = crypto.randomBytes(16).toString("base64");
  (res.locals as any).nonce = nonce;

// Resolve __dirname in ESM/TS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production we serve from dist/public (we copy it during build).
// In dev (ts-node-dev), serve from project/public so hot reload works.
const staticDir = path.join(process.cwd(), "public");
const isProd = process.env.NODE_ENV === "production";
  ? path.join(__dirname, "public")
  : path.resolve(process.cwd(), "public");

app.use(express.static(staticDir));


  // If you use a Supabase URL, allow it in connect-src.
  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const connectSources = ["'self'"];
  if (supabaseUrl) connectSources.push(supabaseUrl);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "base-uri": ["'self'"],
          "object-src": ["'none'"],
          "style-src": ["'self'"],
          "img-src": ["'self'", "data:"],
          "font-src": ["'self'"],
          "connect-src": connectSources,
          // Allow our nonced inline script bootstrap + nonced JS files.
          "script-src": ["'self'", `'nonce-${nonce}'`],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    })
  );

  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

// ------- HTML template injection -------
const TEMPLATE_PATH = path.join(PUBLIC_DIR, "index.template.html");

function injectHtml(html: string, nonce: string) {
  const supaSRI = (process.env.SUPABASE_SRI || "").trim();
  const sriAttr = supaSRI ? `integrity="${supaSRI}" crossorigin="anonymous"` : "";

  return html
    .replaceAll("{{NONCE}}", nonce)
    .replaceAll("{{SUPABASE_URL}}", process.env.SUPABASE_URL || "")
    .replaceAll("{{SUPABASE_ANON_KEY}}", process.env.SUPABASE_ANON_KEY || "")
    .replaceAll("{{API_BASE}}", process.env.API_BASE || "")
    .replaceAll("{{SUPABASE_SRI_ATTR}}", sriAttr);
}

// SPA entry — inject nonce etc., fall back to plain index.html on error
app.get("/", async (_req, res) => {
  try {
    const raw = await fs.readFile(TEMPLATE_PATH, "utf8");
    const html = injectHtml(raw, (res.locals as any).nonce);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  } catch (err) {
    console.error("[root] inject error, sending file:", err);
    res.sendFile(path.join(staticDir, "index.html"));
  }
});

// Health endpoints
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.get("/health", (_req, res) =>
  res.json({
    status: "ok",
    env: process.env.NODE_ENV || "development",
    time: new Date().toISOString()
  })
);

// ------- Destination Hub API (minimal demo) -------
// Presets are hardcoded for now; move to DB/config as needed.
const PRESETS = [
  { id: "tiktok",    label: "TikTok",    video: { aspect: "9:16",  maxDuration: 180,  codec: "h264", out: "mp4" } },
  { id: "instagram", label: "Instagram", video: { aspect: "1:1",   maxDuration: 90,   codec: "h264", out: "mp4" } },
  { id: "youtube",   label: "YouTube",   video: { aspect: "16:9",  maxDuration: 43200, codec: "h264", out: "mp4" } },
  { id: "reddit",    label: "Reddit",    video: { aspect: "16:9",  maxDuration: 600,  codec: "h264", out: "mp4" } },
  { id: "twitter",   label: "Twitter",   video: { aspect: "16:9",  maxDuration: 140,  codec: "h264", out: "mp4" } },
];

app.get("/api/presets", (_req, res) => {
  res.json({ presets: PRESETS });
});

// In-memory job store for demo.  Swap with BullMQ/Redis in production.
type Job = { id: string; status: "queued"|"processing"|"completed"|"failed"; url?: string };
const jobs = new Map<string, Job>();

app.post("/api/convert", async (req, res) => {
  const { preset, options, fileIds } = req.body || {};
  if (!preset || !PRESETS.find(p => p.id === preset)) {
    return res.status(400).json({ error: "Unknown preset" });
  }

  const id = crypto.randomUUID();
  jobs.set(id, { id, status: "queued" });

  // Fake async work
  setTimeout(() => {
    const j = jobs.get(id);
    if (!j) return;
    j.status = "processing";
    setTimeout(() => {
      j.status = "completed";
      // In real build, point at your storage URL of the converted file.
      j.url = `/downloads/${id}-${preset}.mp4`;
      jobs.set(id, j);
    }, 1200);
  }, 300);

  res.json({ jobId: id, accepted: true, options, fileIds });
});

app.get("/api/jobs/:id", (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ error: "Not found" });
  res.json(j);
});

// ----- Source of Truth------ 

type Platform = null | "tiktok" | "instagram" | "youtube" | "reddit";

interface HubState {
  activePlatform: Platform;        // null = Default Hub
  media: {                         // persistent preview node; no re-mounts
    url?: string; type?: "video"|"image";
    width?: number; height?: number; duration?: number;
  };
  presets: { [P in Exclude<Platform,null>]: {
    resolution: string; codec: string; lastUserEdits?: Record<string, string|number|boolean>;
  }};
}

// SPA fallback (if you route on client)
app.get("*", (req, res, next) => {
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    return res.sendFile(path.join(staticDir, "index.html"));
  }
  return next();
});

// ------- Error handling -------
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

// ------- Server -------
const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => {
  console.log(`[ameba] server listening on ${PORT}, prod=${isProd}`);
});




