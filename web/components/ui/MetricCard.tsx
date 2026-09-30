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
  let borderStyle = "border-[#D1CEC7] dark:border-[#243044]";
  let valueColor = "text-[#1E1E1E] dark:text-slate-100";
  let bgStyle = "bg-[#FFFFFF] dark:bg-[#111827]";

  if (variant === "critical") {
    borderStyle = "border-rose-300 dark:border-rose-900/50";
    bgStyle = "bg-rose-50/70 dark:bg-gradient-to-b dark:from-[#111827] dark:to-rose-950/20";
    valueColor = "text-[#B71C1C] dark:text-rose-400";
  } else if (variant === "warning") {
    borderStyle = "border-amber-300 dark:border-amber-900/50";
    bgStyle = "bg-amber-50/70 dark:bg-gradient-to-b dark:from-[#111827] dark:to-amber-950/20";
    valueColor = "text-[#D95E00] dark:text-amber-400";
  } else if (variant === "success") {
    borderStyle = "border-emerald-300 dark:border-emerald-900/50";
    bgStyle = "bg-emerald-50/70 dark:bg-gradient-to-b dark:from-[#111827] dark:to-emerald-950/20";
    valueColor = "text-[#0A7A75] dark:text-emerald-400";
  } else if (variant === "info") {
    borderStyle = "border-sky-300 dark:border-sky-900/50";
    bgStyle = "bg-sky-50/70 dark:bg-gradient-to-b dark:from-[#111827] dark:to-sky-950/20";
    valueColor = "text-sky-700 dark:text-sky-400";
  }

  return (
    <div
      className={`p-4 rounded-lg ${bgStyle} border ${borderStyle} flex flex-col justify-between transition-all duration-200 hover:border-[#B5B2AB] dark:hover:border-slate-600/80 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold text-[#7A7670] dark:text-slate-400 uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className="p-1.5 rounded bg-[#E2DFDA] dark:bg-slate-800/80 text-[#1E1E1E] dark:text-slate-300 border border-[#D1CEC7] dark:border-slate-700/60 shadow-xs">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className={`text-2xl font-bold font-mono-tnum tracking-tight ${valueColor}`}>
          {value}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-[#7A7670] dark:text-slate-400 pt-1.5 border-t border-[#E2DFDA] dark:border-slate-800/80 mt-2">
        {trend ? (
          <div className="flex items-center gap-1 font-mono-tnum text-[11px]">
            {trendDirection === "up" && <ArrowUpRight className="w-3.5 h-3.5 text-[#B71C1C] dark:text-rose-400" />}
            {trendDirection === "down" && <ArrowDownRight className="w-3.5 h-3.5 text-[#0A7A75] dark:text-emerald-400" />}
            {trendDirection === "neutral" && <Minus className="w-3.5 h-3.5 text-[#7A7670] dark:text-slate-400" />}
            <span
              className={
                trendDirection === "up"
                  ? "text-[#B71C1C] dark:text-rose-400"
                  : trendDirection === "down"
                  ? "text-[#0A7A75] dark:text-emerald-400"
                  : "text-[#7A7670] dark:text-slate-400"
              }
            >
              {trend}
            </span>
          </div>
        ) : (
          <span className="text-[#A19D95] dark:text-slate-500 text-[11px] italic">Active Telemetry</span>
        )}
        {subtext && <span className="text-[#7A7670] dark:text-slate-500 text-[11px] truncate">{subtext}</span>}
      </div>
    </div>
  );
}
