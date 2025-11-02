import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ----- Resolve paths safely in ESM -----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When built, this file sits in dist/. So project root = dist/..
const projectRoot = path.resolve(__dirname, "..");
// Public assets live at repo root: /public (NOT in dist)
const publicDir = path.join(projectRoot, "public");

// Optional: basic sanity check at boot
import fs from "node:fs";
if (!fs.existsSync(publicDir)) {
  console.warn("[ameba] public folder not found at:", publicDir);
}

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ----- Serve static BEFORE any catch-all -----
// This makes /styles.css, /script.js, /icons/... work with correct MIME.
app.use(express.static(publicDir, { extensions: ["html"] }));

// ----- Your API routes go here -----
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// Example: API prefix
// import { postConvert } from "./routes/destHub.js";
// app.post("/api/convert", postConvert);

// ----- SPA fallback (AFTER static + API) -----
// Only for non-API requests. Prevents catching CSS/JS.
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next(); // let API 404 naturally
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) next(err);
  });
});

// ----- Error handler -----
app.use((err: any, _req: express.Request, res: express.Response, _next: any) => {
  console.error("[ameba] server error:", err?.message || err);
  res.status(500).json({ error: "internal_error" });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`[ameba] web listening on :${port}`);
  console.log(`[ameba] serving static from: ${publicDir}`);
});
