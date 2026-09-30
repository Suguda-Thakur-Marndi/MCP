import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MCP Sentinel — AI Security & Approval Platform",
  description:
    "Enterprise AI Security Platform with Human-in-the-Loop Approval Gating, Invariant Policy Governance, Cryptographic Audit Logging, and Autonomous LangGraph Agent Boundary Enforcement.",
  keywords: ["MCP Sentinel", "mcp", "security", "AI", "agent", "approval", "governance", "HITL"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)] font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
