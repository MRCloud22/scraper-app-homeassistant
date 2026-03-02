import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolate build directories: .next for server (HA UI), .next_export for FTP static export
  distDir: process.env.NEXT_PUBLIC_EXPORT === 'true' ? '.next_export' : '.next',
  // Use static export ONLY for FTP sync, otherwise use server mode for HA API
  output: process.env.NEXT_PUBLIC_EXPORT === 'true' ? 'export' : undefined,
  // Ensure directory structures work (/signage/ instead of signage.html)
  trailingSlash: false,
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
