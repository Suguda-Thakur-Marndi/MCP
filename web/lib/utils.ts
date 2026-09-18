/**
 * Utility helpers for the security console UI.
 */

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
  if (l === "CRITICAL") return "badge badge-danger";
  if (l === "HIGH") return "badge badge-warning";
  if (l === "MEDIUM") return "badge badge-warning";
  return "badge badge-success";
}

// --------------------------------------------------------------------------
// Approval status utilities
// --------------------------------------------------------------------------
export function statusBadgeClass(status: string): string {
  const s = status?.toUpperCase();
  if (s === "APPROVED" || s === "COMPLETED") return "badge badge-success";
  if (s === "PENDING") return "badge badge-warning";
  if (s === "DENIED" || s === "FAILED") return "badge badge-danger";
  if (s === "EXPIRED" || s === "CANCELLED") return "badge badge-neutral";
  if (s === "EXECUTING") return "badge badge-info";
  return "badge badge-neutral";
}

// --------------------------------------------------------------------------
// Decision badge
// --------------------------------------------------------------------------
export function decisionBadgeClass(decision: string): string {
  const d = decision?.toUpperCase();
  if (d === "ALLOW" || d === "ALLOWED" || d === "PASS") return "badge badge-success";
  if (d === "BLOCK" || d === "BLOCKED" || d === "REJECTED" || d === "FAIL") return "badge badge-danger";
  if (d === "REQUIRE_APPROVAL" || d === "PENDING") return "badge badge-warning";
  return "badge badge-neutral";
}

// --------------------------------------------------------------------------
// Date formatting
// --------------------------------------------------------------------------
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
