import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "node:path";
import fs from "node:fs";

const app = express();

// === Absolute anchors (never guess paths) ===
// On Render, process.cwd() === your Web Service Root Directory (you set it to ".")
const REPO_ROOT = process.cwd();                     // e.g., /opt/render/project
const PUBLIC_DIR = path.join(REPO_ROOT, "public");   // e.g., /opt/render/project/public
const INDEX_HTML = path.join(PUBLIC_DIR, "index.html");

app.use(cors());
app.use(express.json());
app.use(morgan("tiny"));

// Health check for Render
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// 1) Serve static FIRST so CSS/JS/images get proper MIME types
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

// 2) (Optional) API routes would go here, BEFORE SPA fallback
// app.post("/api/convert", ...);

// 3) SPA fallback LAST (skip /api/*)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  fs.access(INDEX_HTML, fs.constants.R_OK, (err) => {
    if (err) return next(err);
    res.sendFile(INDEX_HTML);
  });
});

// Central error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: any) => {
  console.error("[ameba] server error:", err?.message || err);
  res.status(500).json({ error: "internal_error" });
});

const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => {
  console.log("[ameba] REPO_ROOT:", REPO_ROOT);
  console.log(
    "[ameba] PUBLIC_DIR:", PUBLIC_DIR,
    fs.existsSync(INDEX_HTML) ? "(index.html OK)" : "(index.html MISSING)"
  );
  console.log(`[ameba] web listening on :${PORT}`);
});
