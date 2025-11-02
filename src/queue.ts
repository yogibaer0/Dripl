// src/queue.ts
import Queue from "bull";
import type { Job, JobOptions, QueueOptions } from "bull";
import { redisUrl, redisPrefix } from "./lib/redis.js";

export type ConvertJobPayload = {
  inputUrl: string;         // required
  preset?: string;          // optional (e.g., "mp3", "mp4", "veryfast")
  filePath?: string;        // optional (you referenced this earlier)
  output?: string;          // optional (some code used 'output')
};

const qOpts: QueueOptions = {
  prefix: redisPrefix,
  // Bull v4 accepts a Redis connection string
  redis: redisUrl,
};

export const convertQ = new Queue<ConvertJobPayload>("convert", qOpts);

/** Enqueue with sane defaults (retries, backoff, auto-clean). */
export function enqueueConvert(
  payload: ConvertJobPayload,
  opts: JobOptions = {}
): Promise<Job<ConvertJobPayload>> {
  return convertQ.add("convert", payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 100,
    ...opts,
  });
}
