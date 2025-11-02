import Queue, { type JobOptions, type Job } from "bull";
import { getRedis } from "./lib/redis.js";

export type ConvertJobPayload = {
  inputUrl: string;
  output: string;
  preset?: string;
};

export const conversionQueue = new Queue<ConvertJobPayload>("conversion", {
  prefix: process.env.REDIS_PREFIX ?? "ameba",
  redis: getRedis().options
});

// Enqueue helper (with sane defaults)
export function enqueueConvert(
  data: ConvertJobPayload,
  opts: JobOptions = {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true
  }
) {
  return conversionQueue.add("convert", data, opts);
}

// Optional: basic log
conversionQueue.on("error", (err: Error) => {
  console.error("[Queue error]", err);
});
