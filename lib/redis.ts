// lib/redis.ts
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

export default redis;

/**
 * Menghapus semua cache key yang cocok dengan prefix tertentu.
 * Menggunakan SCAN (non-blocking) untuk menemukan key, lalu DEL.
 * 
 * Contoh: invalidateCache('institutions') akan menghapus:
 *   - institutions:page=1:limit=10
 *   - institution:abc-123
 */
export async function invalidateCache(prefix: string): Promise<void> {
  const stream = redis.scanStream({ match: `${prefix}*`, count: 100 });
  
  return new Promise((resolve, reject) => {
    stream.on('data', async (keys: string[]) => {
      if (keys.length > 0) {
        try {
          await redis.del(...keys);
        } catch (err) {
          reject(err);
        }
      }
    });
    
    stream.on('end', () => resolve());
    stream.on('error', (err) => reject(err));
  });
}