export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 1. Inisialisasi ZKP Zero Hashes (Merkle Tree)
    const { initZeroHashes } = await import('@/service/zkp');
    await initZeroHashes();

    // 2. Inisialisasi BullMQ Verification Queue
    // Dipanggil saat bootup untuk memastikan koneksi Redis siap digunakan oleh API
    const { verificationQueue } = await import('@/lib/queue');
    if (verificationQueue) {
       console.log('[Instrumentation] ZKP Verification Queue initialized and ready.');
    }

    // 3. Konfigurasi Event Listeners
    const p = process as any;
    if (typeof p.setMaxListeners === 'function') {
      p.setMaxListeners(100);
    }
  }
}
