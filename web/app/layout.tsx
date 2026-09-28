import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className={inter.className}>
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
