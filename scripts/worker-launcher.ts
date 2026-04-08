import cluster from 'cluster';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnvConfig } from '@next/env';

// Load environment variables (.env, .env.local, etc)
loadEnvConfig(process.cwd());

// Simulate __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Total workers - use logical CPUs but limited for CPU-intensive ZKP tasks
const numCPUs = os.cpus().length;
const TOTAL_WORKERS = process.env.TOTAL_WORKERS 
  ? parseInt(process.env.TOTAL_WORKERS) 
  : Math.max(1, Math.min(Math.floor(numCPUs / 2), 4)); // Ideal: Half CPUs, max 4 for stability

if (cluster.isPrimary) {
  console.log(`[Master ${process.pid}] Launching ${TOTAL_WORKERS} ZKP Workers...`);

  // Fork workers
  for (let i = 0; i < TOTAL_WORKERS; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`[Master ${process.pid}] Worker ${worker.process.pid} died. Resetting...`);
    cluster.fork(); // Always keep N workers alive
  });

  console.log(`[Master ${process.pid}] All workers are active. Monitoring...`);
} else {
  // Use ts-node/register if needed or just require the built worker
  // Note: we'll run this with ts-node directly
  import('./worker');
}
