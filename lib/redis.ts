import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: IORedis };

function createRedis() {
  const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: () => null,
    reconnectOnError: () => false,
  });
}

export const redisConnection = globalForRedis.redis ?? createRedis();

redisConnection.on("error", () => {
  // Swallowed here; callers probe reachability explicitly via isRedisReachable().
});

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redisConnection;

let reachable: boolean | null = null;

/** Probes Valkey once and caches the result, so BullMQ never enters an
 * infinite reconnect loop when the container isn't running yet. */
export async function isRedisReachable(): Promise<boolean> {
  if (reachable !== null) return reachable;
  try {
    await redisConnection.connect();
    await redisConnection.ping();
    reachable = true;
  } catch {
    reachable = false;
  }
  return reachable;
}
