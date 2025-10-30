import { Worker } from 'bullmq';
import { convertQ } from './queue.js';
import Redis from "ioredis";
import { runPreset } from './ff.js';
import path from 'node:path';
import fs from 'node:fs/promises';

const connection = new Redis(process.env.REDIS_URL ?? "", {
  maxRetriesPerRequest: null
});

export const amebaWorker = new Worker(
  "ameba",
  async job => {
    // TODO: your job logic
    return { ok: true };
  },
  { connection }
);

export const worker = new Worker(convertQ.name, async job => {
  const { filePath, preset, outDir, publicBase } = job.data as any;
  await fs.mkdir(outDir, { recursive: true });
  let last = 0;
  const outPath = await runPreset(filePath, preset, outDir, p => {
    if (p !== last) { last = p; job.updateProgress(p).catch(()=>{}); }
  });
  const publicUrl = path.posix.join(publicBase, path.basename(outPath)).replace(/\\/g,'/');
  return { url: publicUrl };
}, { connection });
