// scripts/copy-supabase-umd.js
const fs = require("node:fs");
const path = require("node:path");

const src = path.join(process.cwd(), "node_modules", "@supabase", "supabase-js", "dist", "umd", "supabase.min.js");
const dstDir = path.join(process.cwd(), "public", "vendor");
const dst = path.join(dstDir, "supabase.min.js");

if (!fs.existsSync(src)) {
  console.error("[prepare:vendor] supabase.min.js not found:", src);
  process.exit(0); // don't fail build; lib may be installed later
}
fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(src, dst);
console.log("[prepare:vendor] copied:", path.relative(process.cwd(), dst));
