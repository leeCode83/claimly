import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { ClaimService } from '../service/claim/claim.service';
import { QUEUE_NAME } from '../lib/queue';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('CRITICAL: Missing Supabase environment variables');
  process.exit(1);
}

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

const supabase = createClient(supabaseUrl, supabaseServiceRole);
const claimService = new ClaimService(supabase);

console.log(`Worker ${process.pid} started and listening on ${QUEUE_NAME}`);

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    const { claimId, source } = job.data;
    console.log(`[Worker ${process.pid}] Processing claim: ${claimId} (source: ${source || 'submit'})`);

    try {
      // Reuse existing verifyClaim logic from ClaimService
      // This will update the database (zkp_proofs Table)
      const result = await claimService.verifyClaim(claimId);
      
      console.log(`[Worker ${process.pid}] ✅ Verified claim: ${claimId}. Result: ${result.verification_result}`);
      return result;
    } catch (error) {
      console.error(`[Worker ${process.pid}] ❌ Error verifying claim ${claimId}:`, error);
      
      // If it's a verification failure (invalid proof), we update status to rejected
      // If it's a technical error, we rethrow so BullMQ can retry
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Verifikasi ZKP proof gagal') || errorMessage.includes('Integritas proof gagal')) {
        console.log(`[Worker ${process.pid}] ⚠️ Invalid proof detected for ${claimId}. Setting status to rejected.`);
        // Note: verifyClaim currently throws AppError 400 for these.
        // We should explicitly reject the claim if it's an invalid proof.
        // Since verifyClaim only updates zkp_proofs, we need to update claims table status too if it's an invalid proof.
        
        await supabase
          .from('claims')
          .update({ 
            status: 'rejected',
            review_notes: `Sistem: ${errorMessage}`,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', claimId);
          
        return { claim_id: claimId, verification_result: false, reason: errorMessage };
      }

      throw error; // Rethrow technical errors for BullMQ retry
    }
  },
  {
    connection,
    concurrency: 1, // CPU-intensive, 1 job per process
  }
);

worker.on('failed', (job, err) => {
  console.error(`[Worker ${process.pid}] Job ${job?.id} failed:`, err);
});
