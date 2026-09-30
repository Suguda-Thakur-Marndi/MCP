import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
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

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MCP-SENTINEL — Secure AI Agent & MCP Gatekeeper",
  description:
    "Enterprise MCP Security Platform — real-time AI agent monitoring, human-in-the-loop approval gating, policy governance, and cryptographic audit logging.",
  keywords: ["MCP", "security", "AI", "agent", "approval", "RBAC", "audit", "governance"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${playfair.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans transition-colors duration-200">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
