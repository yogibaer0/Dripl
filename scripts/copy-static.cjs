// scripts/copy-static.cjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const src = path.resolve(__dirname, "..", "public");
const dest = path.resolve(__dirname, "..", "dist", "public");

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from)) {
    const s = path.join(from, entry);
    const d = path.join(to, entry);
    const stat = fs.statSync(s);
    if (stat.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (fs.existsSync(src)) {
  copyDir(src, dest);
  console.log(`[build] Copied public -> dist/public`);
} else {
  console.log(`[build] Skipped copy: public/ not found`);
}
