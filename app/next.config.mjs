/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better error detection
  reactStrictMode: true,

  // Experimental features
  experimental: {
    // Enable server actions if needed
    // serverActions: true,
  },

  // Image optimization
  images: {
    // Add domains for external images (e.g., S3, MinIO, Figma)
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
      // TODO: Add production S3/R2 domains
      // {
      //   protocol: 'https',
      //   hostname: 'your-bucket.s3.amazonaws.com',
      // },
    ],
  },

  // Environment variables exposed to the browser (must start with NEXT_PUBLIC_)
  env: {
    // These are build-time variables
  },

  // Redirects (if needed)
  async redirects() {
    return [];
  },

  // Custom webpack config (if needed)
  webpack: (config, { isServer }) => {
    // Add custom webpack config here if needed
    return config;
  },

  // Output configuration
  output: 'standalone', // Optimized for Docker deployments

  // TODO: Configure headers for security in production
  // async headers() {
  //   return [
  //     {
  //       source: '/:path*',
  //       headers: [
  //         { key: 'X-DNS-Prefetch-Control', value: 'on' },
  //         { key: 'X-Frame-Options', value: 'DENY' },
  //         { key: 'X-Content-Type-Options', value: 'nosniff' },
  //       ],
  //     },
  //   ];
  // },
};

export default nextConfig;

