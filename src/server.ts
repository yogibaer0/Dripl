// ESM + Express production server for Ameba
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

// When compiled, this file lives at <repo>/dist/server.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is one level up from dist
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Public dir sits at repo root alongside /src
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");

// Optional: log & soft-guard if public is missing (still serve /healthz)
if (!fs.existsSync(PUBLIC_DIR)) {
  console.warn("[ameba] WARNING: public folder not found at", PUBLIC_DIR);
}

const app = express();

// Core middleware
app.use(cors());
app.use(express.json());
app.use(morgan("tiny"));

// Health (Render uses this)
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// --- Your API routes go here (before static & fallback) ---
// import { postConvert } from "./routes/destHub.js";
// app.post("/api/convert", postConvert);

// Serve static assets FIRST so CSS/JS get correct MIME
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

// SPA fallback LAST, and skip /api/*
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next(); // let API 404 normally
  const indexFile = path.join(PUBLIC_DIR, "index.html");
  fs.access(indexFile, fs.constants.R_OK, (err) => {
    if (err) return next(err);
    res.sendFile(indexFile);
  });
});

// Centralized error handler (no stack leaks)
app.use((err: any, _req: express.Request, res: express.Response, _next: any) => {
  console.error("[ameba] server error:", err?.message || err);
  res.status(500).json({ error: "internal_error" });
});

// Port from Render (or default)
const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => {
  console.log(`[ameba] web listening on :${PORT}`);
  console.log(`[ameba] serving static from: ${PUBLIC_DIR}`);
});
