import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['127.0.0.1', 'host.docker.internal'],
  serverExternalPackages: ["snarkjs"]
};

export default nextConfig;
