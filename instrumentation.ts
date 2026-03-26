export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initZeroHashes } = await import('@/service/zkp');
    await initZeroHashes();
  }
}
