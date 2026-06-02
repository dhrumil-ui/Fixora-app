import Redis from "ioredis";

let redisClient = null;

export const connectRedis = () => {
  if (redisClient) return redisClient;
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });
  redisClient.on("connect", () => console.log("✅ Redis connected"));
  redisClient.on("ready", () => console.log("✅ Redis ready"));
  redisClient.on("error", (err) => console.error("❌ Redis error:", err.message));
  return redisClient;
};

export const getRedis = () => {
  if (!redisClient) return connectRedis();
  return redisClient;
};
