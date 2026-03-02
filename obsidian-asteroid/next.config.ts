import type { NextConfig } from "next";

const isGithubPages = process.env.NEXT_PUBLIC_EXPORT === 'true';

const nextConfig: NextConfig = {
  // Use static export only when building for production/IONOS
  output: isGithubPages ? 'export' : undefined,
  // basePath is now dynamic based on the environment variable
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH ? `${process.env.NEXT_PUBLIC_BASE_PATH}/` : '',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || '',
  },
};

export default nextConfig;
