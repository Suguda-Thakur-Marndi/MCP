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
  title: "SentinelCore — AI Security & Approval Platform",
  description:
    "SentinelCore is an AI security and approval platform that protects MCP tool execution through policy enforcement, human-in-the-loop approvals, authentication, and comprehensive audit logging.",
  keywords: ["SentinelCore", "mcp", "security", "AI", "governance", "HITL", "FastMCP", "Supabase"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)] font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
