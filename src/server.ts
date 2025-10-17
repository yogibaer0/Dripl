// ------- paths -------
// src/server.ts (drop-in replacement for your index route + static order)

// at top of the file:
import fs from "fs/promises";
import * as fssync from "fs";
import path from "path";
import express from "express";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");
const tplPath = path.join(publicDir, "index.template.html");

// Catch-all for non-API routes: ALWAYS send injected template
app.get(/^\/(?!api\/).*/, async (_req, res, next) => {
  try {
    let html = await fs.readFile(tplPath, "utf8");
    html = html
      .replaceAll("{{NONCE}}", (res.locals as any).nonce ?? "")
      .replaceAll("{{SUPABASE_URL}}", process.env.SUPABASE_URL ?? "")
      .replaceAll("{{SUPABASE_ANON_KEY}}", process.env.SUPABASE_ANON_KEY ?? "")
      .replaceAll("{{API_BASE}}", process.env.API_BASE ?? "");

    res.setHeader("X-Dripl-Injected", "1");   // debug header to confirm
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// Static AFTER, never auto-serve index
app.use(
  express.static(publicDir, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".js") || filePath.endsWith(".mjs"))
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      if (filePath.endsWith(".wasm"))
        res.setHeader("Content-Type", "application/wasm");
    },
  })
);

// Ensure uploads dir
const uploadsDir = path.join(publicDir, "uploads");
if (!fssync.existsSync(uploadsDir)) fssync.mkdirSync(uploadsDir, { recursive: true });


/* ------------------------ secure headers (inline) ------------------------ */
function secureHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    const nonce = crypto.randomBytes(16).toString("base64");
    (res.locals as any).nonce = nonce;

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://cdn.jsdelivr.net https://*.supabase.co https://www.youtube.com https://*.googleapis.com https://apis.google.com https://*.gstatic.com https://*.googleusercontent.com https://*.dropboxapi.com https://*.dropbox.com`,
      `script-src-elem 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net https://*.supabase.co https://www.youtube.com https://*.googleapis.com https://apis.google.com https://*.gstatic.com https://*.googleusercontent.com https://*.dropboxapi.com https://*.dropbox.com`,
      "connect-src 'self' https://*.supabase.co https://cdn.jsdelivr.net https://www.googleapis.com https://content.googleapis.com https://*.googleapis.com https://*.dropboxapi.com https://*.dropbox.com https://studio.dripl.io http://localhost:8080",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://*.google.com https://drive.google.com https://*.dropbox.com",
      "img-src 'self' data: blob: https://i.ytimg.com https://*.googleusercontent.com https://*.dropboxusercontent.com https://cdn.jsdelivr.net",
      "media-src 'self' https: blob:",
      `style-src 'self' 'nonce-${nonce}'`,
      "font-src 'self' data:",
      "worker-src 'self' blob:",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    res.setHeader("Content-Security-Policy", csp);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=(), interest-cohort=()");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");

    next();
  };
}
/* ------------------------------------------------------------------------ */

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("tiny"));
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-site" },
    frameguard: { action: "sameorigin" },
    referrerPolicy: { policy: "no-referrer" }
  })
);
app.use(secureHeaders());

// destination API
const upload = multer({ dest: path.join(publicDir, "uploads") });

app.post("/api/destination/upload", upload.single("file"), (req: Request, res: Response) => {
  const file = (req as any).file;
  res.json({
    ok: true,
    url: `/uploads/${file.filename}`,
    id: file.filename,
    name: file.originalname,
    size: file.size,
    type: file.mimetype?.startsWith("audio") ? "audio" : "video",
    source: "local"
  });
});

app.post("/api/destination/convert-link", async (req: Request, res: Response) => {
  const { url, out } = (req.body || {}) as { url?: string; out?: string };
  if (!url) return res.status(400).json({ error: "url required" });
  const id = crypto.randomUUID();
  let name = "link";
  try { name = new URL(url).hostname; } catch {}
  res.json({
    id,
    name,
    size: 0,
    type: out === "mp3" ? "audio" : "video",
    source: "link",
    url: null
  });
});

app.get("/api/destination/recent", async (_req: Request, res: Response) => {
  res.json([]);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Ameba TS server listening on http://localhost:${PORT}`);
});
