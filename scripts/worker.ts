import { loadEnvConfig } from '@next/env';
import path from 'path';

// 1. Load environment variables (.env.local, .env, etc)
// Menggunakan loader bawaan Next.js agar konsisten dengan aplikasi utama
loadEnvConfig(process.cwd());

// 2. Import logika Worker ZKP
// Logika utama (consumer) kini berada dalam folder workers/ untuk struktur yang lebih bersih
import '../workers/zkp.worker';

console.log(`[Worker ${process.pid}] ZKP Worker process successfully initialized via launcher.`);
