/**
 * Utility helpers for the security console UI.
 */

export function cn(...classes: (string | undefined | null | false | Record<string, boolean>)[]): string {
  return classes
    .flatMap((c) => {
      if (!c) return [];
      if (typeof c === "string") return c.split(" ");
      return Object.entries(c).filter(([, v]) => Boolean(v)).map(([k]) => k);
    })
    .filter(Boolean)
    .join(" ");
}

// --------------------------------------------------------------------------
// Risk level utilities
// --------------------------------------------------------------------------
export function riskClass(level: string): string {
  const l = level?.toUpperCase();
  if (l === "CRITICAL") return "risk-critical";
  if (l === "HIGH") return "risk-high";
  if (l === "MEDIUM") return "risk-medium";
  return "risk-low";
}

export function riskBadgeClass(level: string): string {
  const l = level?.toUpperCase();
  if (l === "CRITICAL")
    return "font-label-mono text-label-mono font-semibold px-space-xs py-0.5 rounded-xs bg-[#FAECEC] text-[#B33939] border border-[#F3D1D1]";
  if (l === "HIGH")
    return "font-label-mono text-label-mono font-semibold px-space-xs py-0.5 rounded-xs bg-[#FEF7EC] text-[#D97706] border border-[#FCE2B6]";
  if (l === "MEDIUM")
    return "font-label-mono text-label-mono font-semibold px-space-xs py-0.5 rounded-xs bg-surface-container-high text-on-surface-variant border border-surface-container-highest";
  return "font-label-mono text-label-mono font-semibold px-space-xs py-0.5 rounded-xs bg-[#EEF6F5] text-[#2A7B76] border border-[#C5E3E1]";
}

// --------------------------------------------------------------------------
// Approval status utilities
// --------------------------------------------------------------------------
export function statusBadgeClass(status: string): string {
  const s = status?.toUpperCase();
  if (s === "APPROVED" || s === "COMPLETED")
    return "font-label-mono text-label-mono font-semibold px-space-xs py-0.5 rounded-xs bg-secondary text-on-secondary";
  if (s === "PENDING" || s === "AWAITING")
    return "font-label-mono text-label-mono font-semibold px-space-xs py-0.5 rounded-xs bg-primary text-on-primary";
  if (s === "DENIED" || s === "FAILED" || s === "REJECTED" || s === "BLOCKED")
    return "font-label-mono text-label-mono font-semibold px-space-xs py-0.5 rounded-xs bg-error text-on-error";
  if (s === "EXECUTING" || s === "RUNNING")
    return "font-label-mono text-label-mono font-semibold px-space-xs py-0.5 rounded-xs bg-secondary-container text-on-secondary-container";
  return "font-label-mono text-label-mono font-semibold px-space-xs py-0.5 rounded-xs bg-surface-container-high text-on-surface-variant";
}

// --------------------------------------------------------------------------
// Decision badge
// --------------------------------------------------------------------------
export function decisionBadgeClass(decision: string): string {
  const d = decision?.toUpperCase();
  if (d === "ALLOW" || d === "ALLOWED" || d === "PASS")
    return "font-label-mono text-label-mono font-bold px-space-xs py-0.5 rounded-xs bg-secondary text-on-secondary";
  if (d === "BLOCK" || d === "BLOCKED" || d === "REJECTED" || d === "FAIL" || d === "INTERCEPTED")
    return "font-label-mono text-label-mono font-bold px-space-xs py-0.5 rounded-xs bg-error text-on-error";
  if (d === "REQUIRE_APPROVAL" || d === "PENDING" || d === "PENDING APPROVAL")
    return "font-label-mono text-label-mono font-bold px-space-xs py-0.5 rounded-xs bg-primary text-on-primary";
  return "font-label-mono text-label-mono font-semibold px-space-xs py-0.5 rounded-xs bg-surface-container-high text-on-surface-variant";
}

// --------------------------------------------------------------------------
// Number and date formatting with fixed locale to avoid hydration mismatches
// --------------------------------------------------------------------------
export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(Number(num))) return "0";
  return new Intl.NumberFormat("en-US").format(Number(num));
}

export function formatTime(iso: string | Date | undefined | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function relativeTime(iso: string): string {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

// --------------------------------------------------------------------------
// Ticket ID shortener for display
// --------------------------------------------------------------------------
export function shortId(id: string): string {
  if (!id) return "—";
  return id.substring(0, 12) + "…";
}

// --------------------------------------------------------------------------
// JSON parameter display (indented)
// --------------------------------------------------------------------------
export function prettyJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}
