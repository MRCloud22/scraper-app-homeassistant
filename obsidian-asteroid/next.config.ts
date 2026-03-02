import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use static export ONLY for FTP sync, otherwise use server mode for HA API
  output: process.env.NEXT_PUBLIC_EXPORT === 'true' ? 'export' : undefined,
  // Ensure directory structures work (/signage/ instead of signage.html)
  trailingSlash: true,
  // Use root as base to satisfy both HA Ingress and Root FTP
  basePath: '',
  assetPrefix: '',
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: '',
  },
};

export default nextConfig;
