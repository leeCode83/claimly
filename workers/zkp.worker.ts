import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { ClaimService } from '@/service/claim/claim.service';
import ioredis from 'ioredis';

// Konfigurasi Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

const connection = new ioredis(redisConfig);

// Konfigurasi Supabase dengan Service Role Key (untuk akses bypass RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const claimService = new ClaimService(supabase);

/**
 * Worker ZKP
 * Mendengarkan antrean 'verification-queue' dan memproses verifikasi proof.
 * Diatur untuk berjalan pada 4 CPU (concurrency: 4).
 */
export const zkpWorker = new Worker(
  'verification-queue',
  async (job: Job) => {
    const { claimId, source } = job.data;
    console.log(`[Worker] [${job.id}] Processing claim ${claimId} (source: ${source})`);

    try {
      // Eksekusi logika internal verifikasi di ClaimService
      const result = await claimService.executeInternalVerification(claimId);
      
      return { 
        claimId, 
        isVerified: result,
        timestamp: new Date().toISOString() 
      };
    } catch (error: any) {
      console.error(`[Worker] Error processing claim ${claimId}:`, error.message);
      throw error; // Biarkan BullMQ menangani retry jika perlu
    }
  },
  { 
    connection,
    concurrency: 4 // Menggunakan 4 CPU sesuai instruksi
  }
);

zkpWorker.on('completed', (job) => {
  console.log(`[Worker] [${job.id}] Completed claim ${job.data.claimId}`);
});

zkpWorker.on('failed', (job, err) => {
  console.error(`[Worker] [${job?.id}] Failed claim ${job?.data?.claimId}:`, err.message);
});

console.log('[Worker] ZKP Worker logic loaded and ready.');
