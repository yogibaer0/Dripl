// src/lib/redis.ts
import * as IORedisNS from "ioredis";
import type { RedisOptions } from "ioredis";

// ESM/CJS-safe constructor (prevents “not constructable”)
type RedisCtor = new (url: string, opts?: RedisOptions) => import("ioredis").default;
const Redis = ((IORedisNS as any).default ?? IORedisNS) as unknown as RedisCtor;

// === exports used across the app ===
export const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
export const redisPrefix = process.env.REDIS_PREFIX ?? "ameba-prod";

declare global {
  // eslint-disable-next-line no-var
  var __AMEBA_REDIS__: import("ioredis").default | undefined;
}

function buildOptions(): RedisOptions {
  const tls = redisUrl.startsWith("rediss://")
    ? { rejectUnauthorized: false }
    : undefined;

  return {
    lazyConnect: true,
    maxRetriesPerRequest: null,     // let Bull handle retries
    enableReadyCheck: true,
    connectTimeout: 10_000,
    tls,                            // only set when rediss://
  };
}

function createRedis() {
  const client = new Redis(redisUrl, buildOptions());
  client.on("error", (err: Error) => console.error("[redis] error:", err.message));
  return client;
}

/** Use this for health checks or anywhere you need a client. */
export function getRedis() {
  if (!global.__AMEBA_REDIS__) global.__AMEBA_REDIS__ = createRedis();
  return global.__AMEBA_REDIS__!;
}
