// scripts/make-index.js
const fs = require("fs");
const path = require("path");

const tplPath = path.join(process.cwd(), "public", "index.template.html");
const outPath = path.join(process.cwd(), "public", "index.html");

let html = fs.readFileSync(tplPath, "utf8");

// simple env token replace, e.g. {{SUPABASE_URL}}
html = html.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, k) => process.env[k] ?? "");

fs.writeFileSync(outPath, html);
console.log("[build] Wrote", outPath);
