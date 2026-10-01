import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  // API URL injected via env variable; defaults to localhost for development
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  },
  async rewrites() {
    return [
      { source: "/overview", destination: "/" },
      { source: "/mcp-tools", destination: "/tools" },
      { source: "/audit-logs", destination: "/audit" },
      { source: "/policy-inspector", destination: "/policies" },
      { source: "/login", destination: "/auth" },
      { source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" },
    ];
  },
};

export default nextConfig;
