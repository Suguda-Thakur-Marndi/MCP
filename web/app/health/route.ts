import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "mcp-sentinel-web",
    timestamp: new Date().toISOString(),
  });
}
