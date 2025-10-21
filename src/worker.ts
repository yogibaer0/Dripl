import { Worker } from 'bullmq';
import { convertQ } from './queue.js';
import IORedis from 'ioredis';
import { runPreset } from './ff.js';
import path from 'node:path';
import fs from 'node:fs/promises';

const connection = new IORedis(process.env.REDIS_URL as string, { maxRetriesPerRequest: null });

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
