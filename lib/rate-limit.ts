import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Inisialisasi Redis client menggunakan variabel lingkungan (env) secara otomatis.
 * Middleware Next.js berjalan di Edge Runtime, jadi kita menggunakan HTTP-based Redis client ini.
 */
const redis = Redis.fromEnv();

// Tier 1: Auth endpoints — proteksi brute force (signin/signup)
export const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  analytics: true,
  prefix: "rl:auth",
});

// Tier 2: ZKP-heavy endpoints — operasi komputasi berat (submit/verify)
export const zkpLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
  prefix: "rl:zkp",
});

// Tier 3: Data list & sensitive details — proteksi anti-scraping
export const listLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: true,
  prefix: "rl:list",
});

// Tier 4: Batch / File upload operations — operasi paling berat per request
export const batchLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  analytics: true,
  prefix: "rl:batch",
});
