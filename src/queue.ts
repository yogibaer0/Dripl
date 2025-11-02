import Queue from "bull";
import type { Job, JobOptions, QueueOptions } from "bull";
import { redisUrl, redisPrefix } from "./lib/redis.js";

/** Single source of truth for the job payload. */
export type ConvertJobPayload = {
  inputUrl: string;          // required
  preset?: "mp3" | "mp4";    // optional output preset
  filePath?: string;         // optional local/remote path (keep if you use it)
};

const qOpts: QueueOptions = {
  prefix: redisPrefix,
  // Bull v4 accepts a redis connection string directly
  redis: redisUrl
};

export const convertQ = new Queue<ConvertJobPayload>("convert", qOpts);

/** Enqueue a convert job with sensible defaults. */
export async function enqueueConvert(
  payload: ConvertJobPayload,
  opts: JobOptions = {}
): Promise<Job<ConvertJobPayload>> {
  return convertQ.add("convert", payload, {
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: 100,
    ...opts,
  });
}
