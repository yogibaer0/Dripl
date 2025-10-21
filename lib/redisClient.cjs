// Simple, resilient Redis client (CommonJS)
const { createClient } = require('redis');

const client = createClient({
  url: process.env.REDIS_URL,
  socket: { reconnectStrategy: (retries) => Math.min(retries * 50, 2000) }
});

client.on('error', (e) => console.error('[redis] error:', e));
client.on('connect', () => console.log('[redis] connected'));
client.on('reconnecting', () => console.log('[redis] reconnecting...'));

let isReadyPromise;
async function getRedis() {
  if (!isReadyPromise) {
    isReadyPromise = client.connect().catch((e) => {
      isReadyPromise = null; // allow retry on next call
      throw e;
    });
  }
  await isReadyPromise;
  return client;
}

module.exports = { getRedis };
