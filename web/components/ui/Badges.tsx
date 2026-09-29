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

  let colors = "bg-slate-800/80 text-slate-300 border-slate-700/80";
  let Icon = Info;

  if (norm === "CRITICAL") {
    colors = "bg-rose-950/50 text-rose-300 border-rose-800/60";
    Icon = AlertCircle;
  } else if (norm === "HIGH") {
    colors = "bg-orange-950/50 text-orange-300 border-orange-800/60";
    Icon = AlertTriangle;
  } else if (norm === "MEDIUM") {
    colors = "bg-amber-950/50 text-amber-300 border-amber-800/60";
    Icon = Activity;
  } else if (norm === "LOW") {
    colors = "bg-emerald-950/50 text-emerald-300 border-emerald-800/60";
    Icon = CheckCircle2;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border font-mono-tnum ${colors} ${className}`}
      title={score !== undefined && score !== null ? `Risk Score: ${score}/100` : norm}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{norm}</span>
      {score !== undefined && score !== null && (
        <span className="opacity-75 font-mono text-[10px]">({Math.round(score)})</span>
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

  if (norm === "APPROVED" || norm === "COMPLETED") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/50 text-emerald-300 border border-emerald-700/60 font-mono ${className}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>{norm}</span>
      </span>
    );
  }

  if (norm === "PENDING") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/50 text-amber-300 border border-amber-700/60 font-mono ${className}`}
      >
        <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        <span>PENDING</span>
      </span>
    );
  }

  if (norm === "DENIED" || norm === "FAILED" || norm === "REJECTED") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-950/50 text-rose-300 border border-rose-700/60 font-mono ${className}`}
      >
        <XCircle className="w-3.5 h-3.5 text-rose-400" />
        <span>{norm}</span>
      </span>
    );
  }

  if (norm === "EXECUTING") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-sky-950/50 text-sky-300 border border-sky-700/60 font-mono ${className}`}
      >
        <Activity className="w-3.5 h-3.5 text-sky-400 animate-spin" />
        <span>EXECUTING</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800/60 text-slate-400 border border-slate-700/60 font-mono ${className}`}
    >
      <Clock className="w-3.5 h-3.5 text-slate-500" />
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
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/50 text-emerald-300 border border-emerald-800/60 font-mono ${className}`}
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>{norm}</span>
      </span>
    );
  }

  if (norm === "BLOCK" || norm === "BLOCKED" || norm === "DENY" || norm === "REJECTED" || norm === "FAIL") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-950/50 text-rose-300 border border-rose-800/60 font-mono ${className}`}
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
        <span>{norm}</span>
      </span>
    );
  }

  if (norm === "REQUIRE_APPROVAL" || norm === "APPROVAL_REQUIRED" || norm === "GATED") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/50 text-amber-300 border border-amber-800/60 font-mono ${className}`}
      >
        <Clock className="w-3.5 h-3.5 text-amber-400" />
        <span>REQUIRE APPROVAL</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60 font-mono ${className}`}
    >
      <Shield className="w-3.5 h-3.5 text-slate-500" />
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

  let colors = "bg-slate-800/80 text-slate-300 border-slate-700";
  let icon = <UserCheck className="w-3 h-3 text-slate-400" />;

  if (norm === "ADMIN") {
    colors = "bg-purple-950/50 text-purple-300 border-purple-800/60";
    icon = <Lock className="w-3 h-3 text-purple-400" />;
  } else if (norm === "APPROVER") {
    colors = "bg-blue-950/50 text-blue-300 border-blue-800/60";
    icon = <ShieldCheck className="w-3 h-3 text-blue-400" />;
  } else if (norm === "SECURITY_ANALYST") {
    colors = "bg-sky-950/50 text-sky-300 border-sky-800/60";
    icon = <Activity className="w-3 h-3 text-sky-400" />;
  } else if (norm === "OPERATOR") {
    colors = "bg-emerald-950/50 text-emerald-300 border-emerald-800/60";
    icon = <UserCheck className="w-3 h-3 text-emerald-400" />;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wider border ${colors} ${className}`}
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
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/40 text-emerald-300 border border-emerald-700/50 ${className}`}
        title="Verified cryptographic hash invariance"
      >
        <ShieldCheck className="w-3 h-3 text-emerald-400" />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950/40 text-rose-300 border border-rose-700/50 ${className}`}
      title="Verification mismatch or unverified"
    >
      <AlertCircle className="w-3 h-3 text-rose-400" />
      <span>UNVERIFIED</span>
    </span>
  );
}
