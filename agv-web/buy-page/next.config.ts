import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // pnpm workspace hoists @types/react@18 and @19 simultaneously,
    // causing false-positive type errors during build. Types are still
    // checked by the IDE and `tsc` directly.
    ignoreBuildErrors: true,
  },
  eslint: {
    // ESLint flat config "Plugin '' not found" — lint separately via `pnpm lint`
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['thirdweb'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Exclude problematic packages from bundling to prevent Turbopack from processing test files
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],
};

export default nextConfig;