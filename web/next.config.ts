import type { NextConfig } from "next";

const backendUrl = (
  process.env.API_BASE_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  // Disable automatic AGENTS.md / CLAUDE.md rule generation in Next.js
  agentRules: false,
  // API URL injected via env variable; empty string defaults to same-origin in browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "",
  },
  async rewrites() {
    return [
      { source: "/overview", destination: "/" },
      { source: "/mcp-tools", destination: "/tools" },
      { source: "/audit-logs", destination: "/audit" },
      { source: "/policy-inspector", destination: "/policies" },
      { source: "/login", destination: "/auth" },
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
    ];
  },
};

export default nextConfig;
