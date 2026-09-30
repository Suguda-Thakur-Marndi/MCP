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
  title: "RiskWise 2.0 — Supply Chain Risk Intelligence & Decision Support",
  description:
    "Enterprise Supply Chain Risk Intelligence and Decision Support Platform with Human-in-the-Loop Approval Gating, Invariant Policy Governance, and Cryptographic Audit Logging.",
  keywords: ["RiskWise", "supply-chain", "risk", "security", "AI", "agent", "approval", "governance"],
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
