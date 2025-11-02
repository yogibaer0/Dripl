// src/lib/redis.ts
import * as IORedisNS from "ioredis";
import type { RedisOptions } from "ioredis";

// ESM/CJS safe constructor (avoids “not constructable” with TS+ESM)
type RedisCtor = new (url: string, opts?: RedisOptions) => import("ioredis").default;
const Redis = ((IORedisNS as any).default ?? IORedisNS) as unknown as RedisCtor;

declare global {
  // eslint-disable-next-line no-var
  var __AMEBA_REDIS__: import("ioredis").default | undefined;
}

function buildOptions(): RedisOptions {
  const url = process.env.REDIS_URL ?? "";
  // Render/Upstash often use rediss:// (TLS). Allow self-signed in PaaS envs.
  const tls = url.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined;

  return {
    lazyConnect: true,
    maxRetriesPerRequest: null, // let Bull handle retries
    enableReadyCheck: true,
    connectTimeout: 10_000,
    tls, // only set when rediss://
  };
}

function createRedis() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  const client = new Redis(url, buildOptions());
  client.on("error", (err: Error) => console.error("[redis] error:", err.message));
  return client;
}

export function getRedis() {
  if (!global.__AMEBA_REDIS__) global.__AMEBA_REDIS__ = createRedis();
  return global.__AMEBA_REDIS__!;
}
