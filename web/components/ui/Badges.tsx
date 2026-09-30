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

  let colors = "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700/80";
  let Icon = Info;

  if (norm === "CRITICAL") {
    colors = "bg-red-50 text-[#D64541] border-red-300 dark:bg-[#D64541]/15 dark:text-[#EF5350] dark:border-[#D64541]/40";
    Icon = AlertCircle;
  } else if (norm === "HIGH") {
    colors = "bg-orange-50 text-[#D05A40] border-orange-300 dark:bg-[#D05A40]/15 dark:text-[#F08060] dark:border-[#D05A40]/40";
    Icon = AlertTriangle;
  } else if (norm === "MEDIUM") {
    colors = "bg-amber-50 text-[#B87000] border-amber-300 dark:bg-[#E3A03E]/15 dark:text-[#F3BA63] dark:border-[#E3A03E]/40";
    Icon = Activity;
  } else if (norm === "LOW") {
    colors = "bg-teal-50 text-[#2C6E65] border-teal-300 dark:bg-[#3A8A7F]/15 dark:text-[#4EA699] dark:border-[#3A8A7F]/40";
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
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-[#2C6E65] border border-teal-300 dark:bg-[#3A8A7F]/15 dark:text-[#4EA699] dark:border-[#3A8A7F]/40 font-mono ${className}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-[#3A8A7F] dark:text-[#4EA699]" />
        <span>{norm}</span>
      </span>
    );
  }

  if (norm === "PENDING") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-[#B87000] border border-amber-300 dark:bg-[#E3A03E]/15 dark:text-[#F3BA63] dark:border-[#E3A03E]/40 font-mono ${className}`}
      >
        <Clock className="w-3.5 h-3.5 text-[#E3A03E] animate-pulse" />
        <span>PENDING</span>
      </span>
    );
  }

  if (norm === "DENIED" || norm === "FAILED" || norm === "REJECTED") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-[#D64541] border border-red-300 dark:bg-[#D64541]/15 dark:text-[#EF5350] dark:border-[#D64541]/40 font-mono ${className}`}
      >
        <XCircle className="w-3.5 h-3.5 text-[#D64541] dark:text-[#EF5350]" />
        <span>{norm}</span>
      </span>
    );
  }

  if (norm === "EXECUTING") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-700/60 font-mono ${className}`}
      >
        <Activity className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 animate-spin" />
        <span>EXECUTING</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/60 font-mono ${className}`}
    >
      <Clock className="w-3.5 h-3.5 text-slate-400" />
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
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-[#2C6E65] border border-teal-300 dark:bg-[#3A8A7F]/15 dark:text-[#4EA699] dark:border-[#3A8A7F]/40 font-mono ${className}`}
      >
        <ShieldCheck className="w-3.5 h-3.5 text-[#3A8A7F] dark:text-[#4EA699]" />
        <span>{norm}</span>
      </span>
    );
  }

  if (norm === "BLOCK" || norm === "BLOCKED" || norm === "DENY" || norm === "REJECTED" || norm === "FAIL") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-[#D64541] border border-red-300 dark:bg-[#D64541]/15 dark:text-[#EF5350] dark:border-[#D64541]/40 font-mono ${className}`}
      >
        <AlertCircle className="w-3.5 h-3.5 text-[#D64541] dark:text-[#EF5350]" />
        <span>{norm}</span>
      </span>
    );
  }

  if (norm === "REQUIRE_APPROVAL" || norm === "APPROVAL_REQUIRED" || norm === "GATED") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-orange-50 text-[#D05A40] border border-orange-300 dark:bg-[#D05A40]/15 dark:text-[#F08060] dark:border-[#D05A40]/40 font-mono ${className}`}
      >
        <Clock className="w-3.5 h-3.5 text-[#D05A40] dark:text-[#F08060]" />
        <span>REQUIRE APPROVAL</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700/60 font-mono ${className}`}
    >
      <Shield className="w-3.5 h-3.5 text-slate-400" />
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

  let colors = "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700";
  let icon = <UserCheck className="w-3 h-3 text-slate-500" />;

  if (norm === "ADMIN") {
    colors = "bg-orange-50 text-[#D05A40] border-orange-300 dark:bg-[#D05A40]/15 dark:text-[#F08060] dark:border-[#D05A40]/40";
    icon = <Lock className="w-3 h-3 text-[#D05A40] dark:text-[#F08060]" />;
  } else if (norm === "APPROVER") {
    colors = "bg-amber-50 text-[#B87000] border-amber-300 dark:bg-[#E3A03E]/15 dark:text-[#F3BA63] dark:border-[#E3A03E]/40";
    icon = <ShieldCheck className="w-3 h-3 text-[#E3A03E] dark:text-[#F3BA63]" />;
  } else if (norm === "SECURITY_ANALYST") {
    colors = "bg-teal-50 text-[#2C6E65] border-teal-300 dark:bg-[#3A8A7F]/15 dark:text-[#4EA699] dark:border-[#3A8A7F]/40";
    icon = <Activity className="w-3 h-3 text-[#3A8A7F] dark:text-[#4EA699]" />;
  } else if (norm === "OPERATOR") {
    colors = "bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/50";
    icon = <UserCheck className="w-3 h-3 text-sky-600 dark:text-sky-400" />;
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
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-teal-50 text-[#2C6E65] border border-teal-300 dark:bg-[#3A8A7F]/15 dark:text-[#4EA699] dark:border-[#3A8A7F]/40 ${className}`}
        title="Verified cryptographic hash invariance"
      >
        <ShieldCheck className="w-3 h-3 text-[#3A8A7F] dark:text-[#4EA699]" />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-red-50 text-[#D64541] border border-red-300 dark:bg-[#D64541]/15 dark:text-[#EF5350] dark:border-[#D64541]/40 ${className}`}
      title="Verification mismatch or unverified"
    >
      <AlertCircle className="w-3 h-3 text-[#D64541] dark:text-[#EF5350]" />
      <span>UNVERIFIED</span>
    </span>
  );
}
