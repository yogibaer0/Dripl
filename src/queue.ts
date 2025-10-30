import Redis from "ioredis";
import { Queue } from "bullmq";

export const connection = new Redis(process.env.REDIS_URL ?? "", {
  maxRetriesPerRequest: null
});

export const amebaQueue = new Queue("ameba", { connection });
export const convertQ = new Queue('ameba:convert', { connection });
export const convertQE = new QueueEvents('ameba:convert', { connection });

export type ConvertJob = {
  filePath: string;          // absolute path of source (or download to temp first)
  preset: 'tiktok'|'instagram-reel'|'twitter'|'reddit'|'youtube';
  outDir: string;            // absolute output dir
  publicBase: string;        // base url used to expose file (e.g. /uploads/converted/123)
};

export const defaultOpts: JobsOptions = {
  removeOnComplete: 50,
  removeOnFail: 100,
  attempts: 2,
  backoff: { type: 'exponential', delay: 2000 }
};

// helper to add job
export function enqueueConvert(data: ConvertJob) {
  return convertQ.add('convert', data, defaultOpts);
}
