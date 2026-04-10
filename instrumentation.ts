export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Lewati inisialisasi servis saat fase build untuk menghindari error koneksi (Redis/DB)
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.log('[Instrumentation] Skipping initialization during build phase.');
      return;
    }

    // Inisialisasi BullMQ Verification Queue
    // ZKP (snarkjs) tidak diinisialisasi di sini — library di-load secara lazy saat pertama kali
    // ada request ke API yang membutuhkannya, untuk menghindari masalah bundling Turbopack.
    const { verificationQueue } = await import('@/lib/queue');
    if (verificationQueue) {
       console.log('[Instrumentation] ZKP Verification Queue initialized and ready.');
    }

    // Konfigurasi Event Listeners
    const p = process as any;
    if (typeof p.setMaxListeners === 'function') {
      p.setMaxListeners(100);
    }
  }
}
