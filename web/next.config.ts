import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // API URL injected via env variable; defaults to localhost for development
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  },
};

export default nextConfig;
