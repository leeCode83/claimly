import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'host.docker.internal'],

  // snarkjs harus di-list di serverExternalPackages agar tidak di-bundle oleh
  // Turbopack/webpack — package ini berisi WASM dan dynamic require yang tidak
  // kompatibel dengan bundler. Next.js akan me-require langsung dari node_modules.
  serverExternalPackages: ["snarkjs"],

  // output: 'standalone' -> membuat folder terpisah yang hanya berisi file yang
  // diperlukan untuk production. Ini memperkecil ukuran image Docker.
  output: 'standalone',
};

export default nextConfig;
