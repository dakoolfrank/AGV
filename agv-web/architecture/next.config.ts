import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['thirdweb'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  eslint: {
    // This skips ESLint completely during `next build`
    // Warning: Only use if you're okay shipping with potential lint issues
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;