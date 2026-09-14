import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "MCP-Sentinel Security Console",
  description:
    "Enterprise MCP Security Platform — real-time AI agent monitoring, human approval gating, policy governance, and cryptographic audit logging.",
  keywords: ["MCP", "security", "AI", "agent", "approval", "RBAC", "audit"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
          <Sidebar />
          <main
            className="flex-1 overflow-y-auto"
            style={{ background: "var(--bg-primary)" }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
