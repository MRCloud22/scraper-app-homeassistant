import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Always use static export for HA and FTP
  output: 'export',
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
