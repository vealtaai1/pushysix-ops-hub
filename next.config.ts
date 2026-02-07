import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Next 15 + flat config can be finicky; we run `npm run lint` separately.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
