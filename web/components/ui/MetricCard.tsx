"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export function MetricCard({
  title,
  value,
  subtext,
  trend,
  trendDirection,
  icon: Icon,
  variant = "default",
  className = "",
}: {
  title: string;
  value: string | number;
  subtext?: string;
  trend?: string | null;
  trendDirection?: "up" | "down" | "neutral";
  icon?: React.ElementType;
  variant?: "default" | "critical" | "warning" | "success" | "info";
  className?: string;
}) {
  let borderStyle = "border-[#243044]";
  let valueColor = "text-slate-100";

  if (variant === "critical") {
    borderStyle = "border-rose-900/50 bg-gradient-to-b from-[#111827] to-rose-950/20";
    valueColor = "text-rose-400";
  } else if (variant === "warning") {
    borderStyle = "border-amber-900/50 bg-gradient-to-b from-[#111827] to-amber-950/20";
    valueColor = "text-amber-400";
  } else if (variant === "success") {
    borderStyle = "border-emerald-900/50 bg-gradient-to-b from-[#111827] to-emerald-950/20";
    valueColor = "text-emerald-400";
  } else if (variant === "info") {
    borderStyle = "border-sky-900/50 bg-gradient-to-b from-[#111827] to-sky-950/20";
    valueColor = "text-sky-400";
  }

  return (
    <div
      className={`p-4 rounded-lg bg-[#111827] border ${borderStyle} flex flex-col justify-between transition-all duration-200 hover:border-slate-600/80 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className="p-1.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className={`text-2xl font-bold font-mono-tnum tracking-tight ${valueColor}`}>
          {value}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 pt-1.5 border-t border-slate-800/80 mt-2">
        {trend ? (
          <div className="flex items-center gap-1 font-mono-tnum text-[11px]">
            {trendDirection === "up" && <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />}
            {trendDirection === "down" && <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />}
            {trendDirection === "neutral" && <Minus className="w-3.5 h-3.5 text-slate-400" />}
            <span
              className={
                trendDirection === "up"
                  ? "text-rose-400"
                  : trendDirection === "down"
                  ? "text-emerald-400"
                  : "text-slate-400"
              }
            >
              {trend}
            </span>
          </div>
        ) : (
          <span className="text-slate-500 text-[11px] italic">Active Telemetry</span>
        )}
        {subtext && <span className="text-slate-500 text-[11px] truncate">{subtext}</span>}
      </div>
    </div>
  );
}
