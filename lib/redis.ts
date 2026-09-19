import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: IORedis };

export const redisConnection =
  globalForRedis.redis ??
  new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: () => null, // fail fast instead of retrying forever
    reconnectOnError: () => false,
  });

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
