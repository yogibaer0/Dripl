import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);

export const projectRoot = resolve(__dirname, "..");
export const publicDir = join(projectRoot, "public");
export const outDir = resolve(process.env.OUT_DIR ?? "public/out");

export function ensureDir(p: string) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}
