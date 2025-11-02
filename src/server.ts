import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

// --- Resolve paths relative to the compiled file (dist/server.js) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When running in prod, __dirname === /opt/render/project/dist
// Project root is one level up from dist
const projectRoot = path.resolve(__dirname, "..");

// Prefer <repo>/public. (Do NOT point to src/public in prod.)
const publicDirCandidates = [
  path.join(projectRoot, "public"),      // ✅ correct in prod
  path.join(__dirname, "public"),        // dist/public (rarely used)
  path.join(projectRoot, "src", "public")// last resort if someone kept files there
];

const publicDir = publicDirCandidates.find(p => fs.existsSync(path.join(p, "index.html"))) 
                 ?? path.join(projectRoot, "public");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("tiny"));

console.log("[ameba] projectRoot:", projectRoot);
console.log("[ameba] serving static from:", publicDir);

// 1) Serve static FIRST so CSS/JS get correct MIME
app.use(express.static(publicDir, { extensions: ["html"] }));

// 2) Health (Render probes this)
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// 3) Your API routes (example)
// import { postConvert } from "./routes/destHub.js";
// app.post("/api/convert", postConvert);

// 4) SPA fallback AFTER static & API
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  const indexFile = path.join(publicDir, "index.html");
  fs.readFile(indexFile, (err) => {
    if (err) return next(err);
    res.sendFile(indexFile);
  });
});

// 5) Central error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: any) => {
  console.error("[ameba] server error:", err?.message || err);
  res.status(500).json({ error: "internal_error" });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`[ameba] web listening on :${port}`);
});
