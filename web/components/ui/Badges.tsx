"use client";

import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  ShieldCheck,
  XCircle,
  Activity,
  Lock,
} from "lucide-react";

// =========================================================================
// RISK BADGE (icon + text + score matching Stitch Precision Intelligence)
// =========================================================================
export function RiskBadge({
  severity,
  level,
  score,
  className = "",
}: {
  severity?: string;
  level?: string;
  score?: number | null;
  className?: string;
}) {
  const norm = (level || severity || "LOW").toUpperCase();

  let colors = "bg-surface-container text-on-surface-variant border-border";
  let Icon = Info;

  if (norm === "CRITICAL") {
    colors = "bg-error-container text-on-error-container border-error/30 font-bold";
    Icon = AlertCircle;
  } else if (norm === "HIGH") {
    colors = "bg-tertiary-fixed text-on-tertiary-fixed border-tertiary/30 font-bold";
    Icon = AlertTriangle;
  } else if (norm === "MEDIUM") {
    colors = "bg-secondary-fixed-dim/40 text-on-secondary-fixed border-secondary/30";
    Icon = Activity;
  } else if (norm === "LOW") {
    colors = "bg-secondary-fixed text-on-secondary-fixed border-secondary/20";
    Icon = CheckCircle2;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-space-xs py-space-xxs rounded font-code-sm text-code-sm uppercase tracking-wider border ${colors} ${className}`}
      title={score !== undefined && score !== null ? `Risk Score: ${score}/100` : norm}
    >
      <Icon className="w-3 h-3 flex-shrink-0" />
      <span>{norm}</span>
      {score !== undefined && score !== null && (
        <span className="opacity-80">({Math.round(score)})</span>
      )}
    </span>
  );
}

// =========================================================================
// APPROVAL STATUS BADGE
// =========================================================================
export function StatusBadge({
  status,
  className = "",
}: {
  status?: string;
  className?: string;
}) {
  const norm = (status || "PENDING").toUpperCase();

  if (norm === "APPROVED" || norm === "COMPLETED" || norm === "EXECUTED") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-space-xs py-space-xxs rounded bg-secondary-fixed text-on-secondary-fixed border border-secondary/20 font-code-sm text-code-sm uppercase font-semibold ${className}`}
      >
        <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-secondary" />
        <span>APPROVED</span>
      </span>
    );
  }

  if (norm === "DENIED" || norm === "BLOCKED" || norm === "REJECTED") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-space-xs py-space-xxs rounded bg-error-container text-on-error-container border border-error/30 font-code-sm text-code-sm uppercase font-semibold ${className}`}
      >
        <XCircle className="w-3 h-3 flex-shrink-0 text-error" />
        <span>DENIED</span>
      </span>
    );
  }

  if (norm === "EXPIRED" || norm === "CANCELLED") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-space-xs py-space-xxs rounded bg-surface-container text-on-surface-variant border border-border font-code-sm text-code-sm uppercase ${className}`}
      >
        <Clock className="w-3 h-3 flex-shrink-0" />
        <span>EXPIRED</span>
      </span>
    );
  }

  // Default: PENDING / IN ESCROW
  return (
    <span
      className={`inline-flex items-center gap-1 px-space-xs py-space-xxs rounded bg-tertiary-fixed text-on-tertiary-fixed border border-tertiary/30 font-code-sm text-code-sm uppercase font-bold ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
      <span>PENDING REVIEW</span>
    </span>
  );
}

// =========================================================================
// DECISION BADGE (Policy engine verdicts)
// =========================================================================
export function DecisionBadge({
  decision,
  className = "",
}: {
  decision?: string;
  className?: string;
}) {
  const norm = (decision || "ALLOW").toUpperCase();

  if (norm === "ALLOW" || norm === "ALLOWED" || norm === "PERMIT" || norm === "SUCCESS") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-space-xs py-space-xxs rounded bg-secondary-fixed text-on-secondary-fixed border border-secondary/20 font-code-sm text-code-sm uppercase font-semibold ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
        <span>ALLOW</span>
      </span>
    );
  }

  if (norm === "REQUIRE_APPROVAL" || norm === "PENDING" || norm === "GATED") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-space-xs py-space-xxs rounded bg-tertiary-fixed text-on-tertiary-fixed border border-tertiary/30 font-code-sm text-code-sm uppercase font-bold ${className}`}
      >
        <Lock className="w-3 h-3 text-tertiary" />
        <span>REQUIRE APPROVAL</span>
      </span>
    );
  }

  if (norm === "BLOCK" || norm === "BLOCKED" || norm === "DENIED" || norm === "BLOCK_CRITICAL") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-space-xs py-space-xxs rounded bg-error text-on-error border border-error font-code-sm text-code-sm uppercase font-bold ${className}`}
      >
        <AlertCircle className="w-3 h-3" />
        <span>BLOCK</span>
      </span>
    );
  }

  if (norm === "ALLOW_MASKED" || norm === "MASKED") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-space-xs py-space-xxs rounded bg-secondary-fixed text-on-secondary-fixed border border-secondary/20 font-code-sm text-code-sm uppercase font-medium ${className}`}
      >
        <ShieldCheck className="w-3 h-3 text-secondary" />
        <span>MASKED</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-space-xs py-space-xxs rounded bg-surface-container text-on-surface-variant font-code-sm text-code-sm uppercase ${className}`}
    >
      <span>{norm}</span>
    </span>
  );
}

// =========================================================================
// ROLE BADGE (ADMIN, OPERATOR, AUDITOR, VIEWER)
// =========================================================================
export function RoleBadge({
  role,
  className = "",
}: {
  role?: string;
  className?: string;
}) {
  const norm = (role || "VIEWER").toUpperCase();

  if (norm === "ADMIN") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-space-xs py-space-xxs rounded bg-primary-fixed text-on-primary-fixed border border-primary/20 font-code-sm text-code-sm uppercase font-semibold ${className}`}
      >
        <span>ADMIN</span>
      </span>
    );
  }

  if (norm === "OPERATOR") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-space-xs py-space-xxs rounded bg-secondary-fixed text-on-secondary-fixed border border-secondary/20 font-code-sm text-code-sm uppercase font-semibold ${className}`}
      >
        <span>OPERATOR</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-space-xs py-space-xxs rounded bg-surface-container text-on-surface-variant border border-border font-code-sm text-code-sm uppercase ${className}`}
    >
      <span>{norm}</span>
    </span>
  );
}
