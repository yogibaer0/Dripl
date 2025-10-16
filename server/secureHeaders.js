// server/secureHeaders.js
import crypto from "node:crypto";

export function secureHeaders() {
  return (req, res, next) => {
    // Generate per-request nonce
    const nonce = crypto.randomBytes(16).toString("base64");
    res.locals.nonce = nonce;

    // --- Content Security Policy ---
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      // Allow Ameba’s trusted CDNs and APIs
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
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
      "report-sample",
    ].join("; ");

    // --- Apply security headers ---
    res.setHeader("Content-Security-Policy", csp);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(), camera=(), microphone=(), interest-cohort=()"
    );
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");

    next();
  };
}

