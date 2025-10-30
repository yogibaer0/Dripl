// src/server.ts
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * ------------------------------------------------------------------
 * ESM/TS path helpers + environment
 * ------------------------------------------------------------------
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === "production";

const staticDir = isProd
  ? path.join(__dirname, "public")            // when running from dist/
  : path.resolve(process.cwd(), "public");    // local dev

const TEMPLATE_PATH = path.join(staticDir, "index.html");

/**
 * Minimal HTML injection – keep/extend as you need.
 * - Injects a CSP nonce if you set it on res.locals.nonce
 * - Replaces optional placeholders you were already using
 */
function injectHtml(raw: string, nonce?: string) {
  const sriAttr = process.env.SUPABASE_SRI_ATTR || "";  // optional
  const apiBase = process.env.API_BASE || "";
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || "";

  let html = raw;
  if (nonce) {
    html = html.replace(/%NONCE%/g, nonce);
  }
  html = html
    .replaceAll("{{SUPABASE_SRI_ATTR}}", sriAttr)
    .replaceAll("{{API_BASE}}", apiBase)
    .replaceAll("{{SUPABASE_ANON_KEY}}", supabaseAnon);

  return html;
}

/**
 * ------------------------------------------------------------------
 * App setup
 * ------------------------------------------------------------------
 */
const app = express();

app.use(cors());
app.use(morgan("tiny"));
app.use(
  helmet({
    // Keep it relaxed for now; add CSP later with your nonce handling.
    contentSecurityPolicy: false,
  })
);

// Serve static files, but do NOT auto-serve index.html.
// Our "/" handler below will read the template and inject variables.
app.use(express.static(staticDir, { index: false }));

/**
 * ------------------------------------------------------------------
 * Routes
 * ------------------------------------------------------------------
 */

// Single canonical "/" route that renders the template
app.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = await fs.readFile(TEMPLATE_PATH, "utf8");
    const html = injectHtml(raw, (res.locals as any)?.nonce);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// Health endpoints used by Render and monitors
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    pid: process.pid,
    node: process.version,
    env: process.env.NODE_ENV || "development",
  });
});

/**
 * ------------------------------------------------------------------
 * Error handling
 * ------------------------------------------------------------------
 */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[ameba] server error:", err);
  res.status(500).json({ ok: false, error: "Internal Server Error" });
});

/**
 * ------------------------------------------------------------------
 * Boot
 * ------------------------------------------------------------------
 */
const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => {
  console.log(`[ameba] server listening on ${PORT}, prod=${isProd}`);
});




