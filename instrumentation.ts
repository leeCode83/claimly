export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initZeroHashes } = await import('@/service/zkp');
    await initZeroHashes();

    // Naikkan limit listener menjadi 100 agar aman saat banyak request masuk secara bersamaan
    // Gunakan akses dinamis untuk menghindari peringatan statis di Edge Runtime
    const p = process as any;
    if (typeof p.setMaxListeners === 'function') {
      p.setMaxListeners(100);
    }
  }
}
