// scripts/copy-supabase-umd.js
// LABEL: Copies Supabase UMD to /public/vendor for same-origin loading (CSP friendly)

const fs = require('node:fs');
const path = require('node:path');

const src = path.join(process.cwd(), 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.min.js');
const dstDir = path.join(process.cwd(), 'public', 'vendor');
const dst = path.join(dstDir, 'supabase.min.js');

try {
  if (!fs.existsSync(src)) {
    console.error('[prepare:vendor] supabase.min.js not found at', src);
    process.exit(0); // don’t fail build; just skip copy
  }
  if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
  fs.copyFileSync(src, dst);
  console.log('[prepare:vendor] copied:', path.relative(process.cwd(), dst));
} catch (err) {
  console.error('[prepare:vendor] copy failed:', err);
  process.exit(1);
}
