// TOP: imports
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const app        = express();

// 1) Compression (gzip/brotli if supported)
app.use(compression());

// 2) Basic security headers (moderate, no strict CSP)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // HSTS (only if HTTPS everywhere)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// 3) CORS (allow your frontend)
const CLIENT = process.env.AMEBA_CLIENT_ORIGIN || 'https://studio.dripl.io';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CLIENT);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ameba-user');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// 4) Serve static with cache & WASM MIME
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
    // Cache static assets (tune as you like)
    if (/\.(css|js|png|jpg|jpeg|svg|webp|gif|woff2?)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// 5) Healthcheck
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

// 6) HTML (SPA) fallback
app.get('*', (_req, res) => {
  const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
});

// 7) Start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Ameba running on :${PORT}`));





