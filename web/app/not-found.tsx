"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home, FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="p-8 sm:p-10 rounded border border-[var(--border)] bg-[var(--card)] shadow-sm max-w-lg w-full">
        <div className="w-12 h-12 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto mb-4">
          <FileQuestion className="w-6 h-6" />
        </div>

        <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          HTTP 404 / RESOURCE NOT LOCATED
        </span>

        <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-3 text-[var(--foreground)]">
          Security Boundary Enforced
        </h1>

        <p className="text-xs text-[var(--muted-foreground)] mt-2 leading-relaxed">
          The requested endpoint, route, or audit payload does not exist or has been gated behind authoritative access controls.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-[var(--primary)] text-white text-xs font-semibold shadow-xs hover:opacity-90 transition-opacity"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Dashboard</span>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-[var(--surface-elevated)] text-xs font-semibold text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--surface-elevated)]/80 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    </div>
  );
}
