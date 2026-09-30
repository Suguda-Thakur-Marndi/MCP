"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home, FileQuestion } from "lucide-react";
import { BorderBeam } from "@/components/ui/BorderBeam";

export default function NotFoundPage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="relative overflow-hidden p-8 sm:p-10 rounded-2xl bg-white dark:bg-[#111827] border border-[#D1CEC7] dark:border-[#243044] shadow-xl max-w-lg w-full">
        <BorderBeam size={260} duration={12} colorFrom="#D95E00" colorTo="#0A7A75" />

        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto mb-4">
          <FileQuestion className="w-7 h-7" />
        </div>

        <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          HTTP 404 / RESOURCE NOT LOCATED
        </span>

        <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-3 text-[#1E1E1E] dark:text-white">
          Security Boundary Enforced
        </h1>

        <p className="text-xs text-[#4A4A4A] dark:text-slate-400 mt-2 leading-relaxed">
          The requested endpoint, route, or audit payload does not exist or has been gated behind authoritative access controls.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#D95E00] dark:bg-sky-600 hover:bg-[#BF5300] dark:hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Dashboard</span>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#F5F4F0] dark:bg-[#0F172A] hover:bg-[#E2DFDA] dark:hover:bg-[#1A2332] text-xs font-semibold text-[#1E1E1E] dark:text-slate-300 border border-[#D1CEC7] dark:border-[#243044] transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    </div>
  );
}
