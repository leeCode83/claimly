import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

// Menangani error koneksi agar tidak men-terminate proses (terutama saat build)
connection.on('error', (err) => {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    // Abaikan error koneksi saat build
    return;
  }
  console.error('[Redis Connection Error]:', err.message);
});

export const QUEUE_NAME = 'verification-queue';

export const verificationQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
