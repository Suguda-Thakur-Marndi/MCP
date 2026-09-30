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
  let borderLeft = "border-l-[var(--border)]";
  let valueColor = "text-[var(--text-primary)]";

  if (variant === "critical") {
    borderLeft = "border-l-[var(--danger)]";
    valueColor = "text-[var(--danger)]";
  } else if (variant === "warning") {
    borderLeft = "border-l-[var(--warning)]";
    valueColor = "text-[var(--warning)]";
  } else if (variant === "success") {
    borderLeft = "border-l-[var(--success)]";
    valueColor = "text-[var(--success)]";
  } else if (variant === "info") {
    borderLeft = "border-l-[var(--info)]";
    valueColor = "text-[var(--info)]";
  }

  return (
    <div
      className={`p-3 rounded bg-[var(--bg-card)] border border-[var(--border)] border-l-2 ${borderLeft} flex flex-col justify-between transition-colors shadow-xs ${className}`}
    >
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{title}</span>
        {Icon && (
          <Icon className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className={`text-xl font-bold font-mono-tnum tracking-tight ${valueColor}`}>
          {value}
        </span>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)] mt-1">
        {trend ? (
          <div className="flex items-center gap-1 font-mono-tnum">
            {trendDirection === "up" && <ArrowUpRight className="w-3 h-3 text-[var(--danger)]" />}
            {trendDirection === "down" && <ArrowDownRight className="w-3 h-3 text-[var(--success)]" />}
            {trendDirection === "neutral" && <Minus className="w-3 h-3 text-[var(--text-muted)]" />}
            <span
              className={
                trendDirection === "up"
                  ? "text-[var(--danger)]"
                  : trendDirection === "down"
                  ? "text-[var(--success)]"
                  : "text-[var(--text-muted)]"
              }
            >
              {trend}
            </span>
          </div>
        ) : (
          <span className="font-mono-tnum text-[10px]">Verified Invariant</span>
        )}
        {subtext && <span className="truncate ml-1 text-[10px]">{subtext}</span>}
      </div>
    </div>
  );
}
