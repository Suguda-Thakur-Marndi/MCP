"use client";

import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  Shield,
  ShieldCheck,
  XCircle,
  Activity,
  Lock,
  UserCheck,
} from "lucide-react";

// =========================================================================
// RISK BADGE (icon + text + color + score)
// =========================================================================
export function RiskBadge({
  severity,
  score,
  className = "",
}: {
  severity?: string;
  score?: number | null;
  className?: string;
}) {
  const norm = (severity || "LOW").toUpperCase();

  let colors = "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)]";
  let Icon = Info;

  if (norm === "CRITICAL") {
    colors = "bg-[var(--risk-critical-bg)] text-[var(--risk-critical)] border-[var(--risk-critical-border)]";
    Icon = AlertCircle;
  } else if (norm === "HIGH") {
    colors = "bg-[var(--risk-high-bg)] text-[var(--risk-high)] border-[var(--risk-high-border)]";
    Icon = AlertTriangle;
  } else if (norm === "MEDIUM") {
    colors = "bg-[var(--risk-medium-bg)] text-[var(--risk-medium)] border-[var(--risk-medium-border)]";
    Icon = Activity;
  } else if (norm === "LOW") {
    colors = "bg-[var(--risk-low-bg)] text-[var(--risk-low)] border-[var(--risk-low-border)]";
    Icon = CheckCircle2;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border font-mono-tnum ${colors} ${className}`}
      title={score !== undefined && score !== null ? `Risk Score: ${score}/100` : norm}
    >
      <Icon className="w-3 h-3 flex-shrink-0" />
      <span>{norm}</span>
      {score !== undefined && score !== null && (
        <span className="opacity-80 text-[10px]">({Math.round(score)})</span>
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
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--risk-low-bg)] text-[var(--risk-low)] border border-[var(--risk-low-border)] font-mono-tnum ${className}`}
      >
        <CheckCircle2 className="w-3 h-3 text-[var(--risk-low)]" />
        <span>{norm}</span>
      </span>
    );
  }

  if (norm === "PENDING") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--risk-medium-bg)] text-[var(--risk-medium)] border border-[var(--risk-medium-border)] font-mono-tnum ${className}`}
      >
        <Clock className="w-3 h-3 text-[var(--risk-medium)]" />
        <span>PENDING</span>
      </span>
    );
  }

  if (norm === "DENIED" || norm === "FAILED" || norm === "REJECTED" || norm === "EXPIRED") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--risk-critical-bg)] text-[var(--risk-critical)] border border-[var(--risk-critical-border)] font-mono-tnum ${className}`}
      >
        <XCircle className="w-3 h-3 text-[var(--risk-critical)]" />
        <span>{norm}</span>
      </span>
    );
  }

  if (norm === "EXECUTING") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--info)]/10 text-[var(--info)] border border-[var(--info)]/30 font-mono-tnum ${className}`}
      >
        <Activity className="w-3 h-3 text-[var(--info)] animate-pulse" />
        <span>EXECUTING</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)] font-mono-tnum ${className}`}
    >
      <Clock className="w-3 h-3 text-[var(--text-muted)]" />
      <span>{norm}</span>
    </span>
  );
}

// =========================================================================
// SECURITY DECISION BADGE
// =========================================================================
export function DecisionBadge({
  decision,
  className = "",
}: {
  decision?: string;
  className?: string;
}) {
  const norm = (decision || "ALLOW").toUpperCase();

  if (norm === "ALLOW" || norm === "ALLOWED" || norm === "PASS") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--risk-low-bg)] text-[var(--risk-low)] border border-[var(--risk-low-border)] font-mono-tnum ${className}`}
      >
        <ShieldCheck className="w-3 h-3 text-[var(--risk-low)]" />
        <span>{norm}</span>
      </span>
    );
  }

  if (norm === "BLOCK" || norm === "BLOCKED" || norm === "DENY" || norm === "REJECTED" || norm === "FAIL") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--risk-critical-bg)] text-[var(--risk-critical)] border border-[var(--risk-critical-border)] font-mono-tnum ${className}`}
      >
        <AlertCircle className="w-3 h-3 text-[var(--risk-critical)]" />
        <span>{norm}</span>
      </span>
    );
  }

  if (norm === "REQUIRE_APPROVAL" || norm === "APPROVAL_REQUIRED" || norm === "GATED") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--risk-high-bg)] text-[var(--risk-high)] border border-[var(--risk-high-border)] font-mono-tnum ${className}`}
      >
        <Clock className="w-3 h-3 text-[var(--risk-high)]" />
        <span>APPROVAL REQUIRED</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)] font-mono-tnum ${className}`}
    >
      <Shield className="w-3 h-3 text-[var(--text-muted)]" />
      <span>{norm}</span>
    </span>
  );
}

// =========================================================================
// ROLE BADGE
// =========================================================================
export function RoleBadge({
  role,
  className = "",
}: {
  role?: string;
  className?: string;
}) {
  const norm = (role || "VIEWER").toUpperCase();

  let colors = "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)]";
  let icon = <UserCheck className="w-3 h-3" />;

  if (norm === "ADMIN") {
    colors = "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30";
    icon = <Lock className="w-2.5 h-2.5" />;
  } else if (norm === "APPROVER") {
    colors = "bg-[var(--risk-high-bg)] text-[var(--risk-high)] border-[var(--risk-high-border)]";
    icon = <ShieldCheck className="w-2.5 h-2.5" />;
  } else if (norm === "SECURITY_ANALYST") {
    colors = "bg-[var(--info)]/10 text-[var(--info)] border-[var(--info)]/30";
    icon = <Activity className="w-2.5 h-2.5" />;
  } else if (norm === "OPERATOR") {
    colors = "bg-[var(--risk-low-bg)] text-[var(--risk-low)] border-[var(--risk-low-border)]";
    icon = <UserCheck className="w-2.5 h-2.5" />;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono-tnum font-semibold tracking-wider border ${colors} ${className}`}
    >
      {icon}
      <span>{norm}</span>
    </span>
  );
}

// =========================================================================
// CRYPTOGRAPHIC VERIFICATION BADGE
// =========================================================================
export function VerificationBadge({
  label = "SEALED",
  verified = true,
  className = "",
}: {
  label?: string;
  verified?: boolean;
  className?: string;
}) {
  if (verified) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono-tnum bg-[var(--risk-low-bg)] text-[var(--risk-low)] border border-[var(--risk-low-border)] ${className}`}
        title="Verified cryptographic hash invariance"
      >
        <ShieldCheck className="w-2.5 h-2.5" />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono-tnum bg-[var(--risk-critical-bg)] text-[var(--risk-critical)] border border-[var(--risk-critical-border)] ${className}`}
      title="Verification mismatch or unverified"
    >
      <AlertCircle className="w-2.5 h-2.5" />
      <span>UNVERIFIED</span>
    </span>
  );
}
