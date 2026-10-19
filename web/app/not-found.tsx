"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home, Terminal } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none font-sans animate-in fade-in duration-150">
      <div className="p-6 sm:p-8 rounded-xs border border-[var(--border-interactive)] bg-[var(--surface-container-low)] shadow-2xl max-w-lg w-full space-y-4">
        <div className="w-12 h-12 rounded-xs bg-[var(--tertiary-container)]/30 border border-[var(--tertiary-fixed-dim)]/40 flex items-center justify-center text-[var(--tertiary-fixed-dim)] mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <span className="px-2.5 py-0.5 rounded-xs font-label-caps text-[9px] font-bold uppercase bg-[var(--tertiary-container)]/20 text-[var(--tertiary-fixed-dim)] border border-[var(--tertiary-fixed-dim)]/40">
            HTTP 404 // BOUNDARY NOT LOCATED
          </span>

          <h1 className="font-headline-md text-lg sm:text-xl font-bold tracking-tight mt-2 text-[var(--primary)] font-mono">
            SECURITY PERIMETER INTERCEPT
          </h1>

          <p className="font-body-sm text-xs text-[var(--text-secondary)] leading-relaxed pt-1">
            The requested tactical resource, execution trace, or telemetry endpoint does not exist or has been quarantined behind authoritative dual-custody invariants.
          </p>
        </div>

        <div className="p-3 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] font-code-sm text-[11px] text-[var(--text-muted)] text-left space-y-1">
          <div className="flex items-center gap-1.5 text-[var(--secondary-container)] font-bold">
            <Terminal className="w-3.5 h-3.5" />
            <span>INCIDENT FORENSIC TRACE</span>
          </div>
          <div>STATUS: ROUTE_UNRESOLVED</div>
          <div>GATEWAY_ACTION: ZERO_TRUST_DROP</div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2 font-code-sm text-xs">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xs bg-[var(--primary-container)] text-[var(--surface-container-lowest)] font-bold hover:brightness-110 transition-all cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>COMMAND CENTER</span>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xs bg-[var(--surface-container-high)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-interactive)] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>STEP BACK</span>
          </button>
        </div>
      </div>
    </div>
  );
}
