/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react']
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        stream: false,
        https: false,
        crypto: false,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        os: false,
        path: false,
        util: false,
        buffer: false,
        events: false,
        url: false,
        querystring: false,
        zlib: false,
        http: false,
        assert: false,
        constants: false,
        domain: false,
        punycode: false,
        process: false,
      };
    }
    return config;
  }
};

module.exports = nextConfig;