import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const app = express();

// --- Diagnostics so we can see what's happening at runtime ---
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const CWD        = process.cwd();

console.log("[dripl] __dirname :", __dirname);
console.log("[dripl] process.cwd():", CWD);

// Where can public/ live in prod?
const candidates = [
  path.join(CWD, "public"),                       // repo root/public (if cwd == repo root)
  path.join(CWD, "..", "public"),                 // ../public (if cwd == /src)
  path.join(__dirname, "..", "public"),           // dist/../public (rare)
  path.join(__dirname, "..", "..", "public"),     // dist/../../public (if dist under src)
];

// Pick the first candidate that has index.html
let PUBLIC_DIR = candidates.find(p => fs.existsSync(path.join(p, "index.html")));
if (!PUBLIC_DIR) {
  // Fallback to repo-root guess to avoid crash; error handler will still catch if missing
  PUBLIC_DIR = path.join(CWD, "public");
}

const INDEX_HTML = path.join(PUBLIC_DIR, "index.html");
console.log("[dripl] public candidates:", candidates);
console.log("[dripl] PUBLIC_DIR chosen:", PUBLIC_DIR, fs.existsSync(INDEX_HTML) ? "(index.html OK)" : "(index.html MISSING)");

app.use(cors());
app.use(express.json());
app.use(morgan("tiny"));

// Health
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// Serve static FIRST (correct MIME for CSS/JS)
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

// (Your API routes would go here)

// SPA fallback LAST
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  fs.access(INDEX_HTML, fs.constants.R_OK, err => {
    if (err) return next(err);
    res.sendFile(INDEX_HTML);
  });
});

// Central error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: any) => {
  console.error("[dripl] server error:", err?.message || err);
  res.status(500).json({ error: "internal_error" });
});

const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => {
  console.log(`[dripl] web listening on :${PORT}`);
});
