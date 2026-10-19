"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Inbox,
  Loader2,
  Lock,
  RefreshCw,
  Layers,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

export function LoadingState({
  message = "Loading security telemetry...",
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-14 px-4 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="w-7 h-7 text-[var(--accent)] animate-spin mb-3" />
      <p className="text-xs font-semibold text-[var(--text-primary)]">{message}</p>
      <span className="text-[11px] text-[var(--text-muted)] mt-1 font-mono-tnum">
        Connecting to authoritative FastMCP backend...
      </span>
    </div>
  );
}

export function EmptyState({
  title = "No records found",
  message = "No security events match your current filters or query.",
  icon: Icon = Inbox,
  action,
  className = "",
}: {
  title?: string;
  message?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-14 px-4 text-center rounded-xs border border-dashed border-[var(--border)] bg-[var(--bg-secondary)]/30 ${className}`}
    >
      <div className="w-10 h-10 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] mb-3 shadow-2xs">
        <Icon className="w-5 h-5 text-[var(--text-muted)]" />
      </div>
      <h3 className="text-xs font-bold text-[var(--text-primary)]">{title}</h3>
      <p className="text-xs text-[var(--text-secondary)] max-w-sm mt-1 mb-4 leading-relaxed">
        {message}
      </p>
      {action}
    </div>
  );
}

export function NoIntegrationsEmptyState() {
  return (
    <EmptyState
      title="No software is connected to your security gateway yet."
      message="Connect external enterprise applications or custom MCP servers to begin evaluating and governing autonomous AI agent actions."
      icon={Layers}
      action={
        <Link
          href="/integrations"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xs text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-95 shadow-2xs"
        >
          <span>Connect software</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      }
    />
  );
}

export function NoApprovalsEmptyState() {
  return (
    <EmptyState
      title="All security decisions are currently resolved."
      message="There are no pending high-risk or destructive actions awaiting dual-custody human sign-off in the decision queue."
      icon={CheckCircle2}
      action={
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--text-muted)]"
        >
          <span>Return to Command Center</span>
        </Link>
      }
    />
  );
}

export function NoAuditEventsEmptyState() {
  return (
    <EmptyState
      title="No governed actions have been recorded yet."
      message="Audit logs are cryptographically sealed whenever an AI agent requests a tool execution through the MCP Sentinel gateway."
      icon={ShieldAlert}
    />
  );
}

export function ErrorState({
  title = "Security Telemetry Error",
  message = "Unable to load data from backend services. Please retry.",
  whatHappened = "The security gateway encountered an unexpected response from the invariant engine.",
  why = "Backend service may be temporarily unavailable or credentials expired.",
  whatYouCanDo = "Verify that the backend gateway daemon and database are active on ports 8000 and 5000.",
  onRetry,
  className = "",
}: {
  title?: string;
  message?: string;
  whatHappened?: string;
  why?: string;
  whatYouCanDo?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`p-6 rounded-xs border border-[var(--risk-critical-border)] bg-[var(--risk-critical-bg)]/30 text-left space-y-3 font-mono-tnum text-xs ${className}`}
      role="alert"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-[var(--risk-critical)] flex-shrink-0" />
        <h3 className="text-xs font-bold text-[var(--risk-critical)] uppercase tracking-wider">
          {title}
        </h3>
      </div>

      <p className="text-xs font-sans text-[var(--text-primary)] leading-relaxed">
        {message}
      </p>

      <div className="p-3 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] space-y-1.5 text-[11px]">
        <div>
          <span className="text-[var(--text-muted)] font-bold">What happened: </span>
          <span className="text-[var(--text-primary)]">{whatHappened}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)] font-bold">Why: </span>
          <span className="text-[var(--text-primary)]">{why}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)] font-bold">What you can do: </span>
          <span className="text-[var(--text-primary)]">{whatYouCanDo}</span>
        </div>
      </div>

      {onRetry && (
        <div className="pt-1">
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-95 transition-all shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Request</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function ForbiddenState({
  requiredRole = "Admin or Approver",
  message = "Your current account role does not have authorization to access this operational subsystem.",
  className = "",
}: {
  requiredRole?: string;
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-14 px-4 text-center rounded-xs border border-[var(--risk-high-border)] bg-[var(--risk-high-bg)]/20 ${className}`}
      role="alert"
    >
      <div className="w-10 h-10 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[var(--risk-high)] mb-3">
        <Lock className="w-4 h-4 text-[var(--risk-high)]" />
      </div>
      <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Access Restricted (403)</h3>
      <p className="text-xs text-[var(--text-secondary)] max-w-sm mt-1">{message}</p>
      <span className="text-[11px] font-mono-tnum text-[var(--accent)] font-semibold mt-2">
        Required Role: {requiredRole}
      </span>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}
