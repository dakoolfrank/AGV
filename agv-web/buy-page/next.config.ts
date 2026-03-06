import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['thirdweb'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Exclude problematic packages from bundling to prevent Turbopack from processing test files
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],
};

export default nextConfig;