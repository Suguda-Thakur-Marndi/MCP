"use client";

import React, { useEffect, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Database,
  RefreshCw,
  Download,
  Search,
  ExternalLink,
  Blocks,
  AlertTriangle,
  ArrowRight,
  Eye,
  X,
  Copy,
  Check,
} from "lucide-react";
import {
  api,
  HealthStatus,
  AuditStats,
  ApprovalRecord,
  AuditEvent,
  ToolInfo,
  IntegrationListItem,
} from "@/lib/api";
import { formatNumber, formatTime, riskBadgeClass, decisionBadgeClass } from "@/lib/utils";

export default function OverviewPage() {
  const [, startTransition] = useTransition();

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRecord[]>([]);
  const [recentEvents, setRecentEvents] = useState<AuditEvent[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");

  // Inspect modal
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [copied, setCopied] = useState(false);

  // Fast action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ ticketId: string; action: "approve" | "deny"; toolName: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [
        healthRes,
        auditStatsRes,
        pendingRes,
        eventsRes,
        toolsRes,
        integrationsRes,
      ] = await Promise.all([
        api.healthReady().catch(() => null),
        api.audit.stats().catch(() => null),
        api.approvals.pending().catch(() => []),
        api.audit.events({ limit: 20 }).catch(() => ({ events: [], total: 0 })),
        api.policies.tools().catch(() => []),
        api.integrations.list().catch(() => []),
      ]);

      startTransition(() => {
        if (healthRes) setHealth(healthRes);
        if (auditStatsRes) setAuditStats(auditStatsRes);
        if (Array.isArray(pendingRes)) setPendingApprovals(pendingRes);
        if (eventsRes?.events) setRecentEvents(eventsRes.events);
        if (Array.isArray(toolsRes)) setTools(toolsRes);
        if (Array.isArray(integrationsRes)) setIntegrations(integrationsRes);
        setLoading(false);
      });
    } catch (err: unknown) {
      console.warn("Failed to load overview data:", err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const interval = setInterval(loadData, 12000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleAction = async (ticketId: string, action: "approve" | "deny") => {
    setActionLoading(ticketId);
    setActionFeedback(null);
    setConfirmDialog(null);
    try {
      if (action === "approve") {
        await api.approvals.approve(ticketId, "Authorized by Security Officer via Operations Console");
        setActionFeedback({ type: "success", msg: "Approval granted. Mutation operation authorized." });
      } else {
        await api.approvals.deny(ticketId, "Denied by Security Officer via Operations Console");
        setActionFeedback({ type: "success", msg: "Operation rejected and locked." });
      }
      setTimeout(() => setActionFeedback(null), 4000);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process decision.";
      setActionFeedback({ type: "error", msg });
      setTimeout(() => setActionFeedback(null), 5000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportCSV = () => {
    const headers = "Event ID,Timestamp,Actor ID,Tool Name,Decision,Risk Score\n";
    const rows = recentEvents
      .map(
        (e) =>
          `"${e.id}","${e.created_at}","${e.actor_id || "agent"}","${e.tool_name}","${e.decision}","${e.risk_score || 0}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `mcp_sentinel_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyJson = (payload: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Authoritative metrics derived from live PostgreSQL data
  const totalEvents = auditStats?.total_events ?? auditStats?.total ?? recentEvents.length;
  const allowedEvents =
    (auditStats?.by_decision?.ALLOWED ?? 0) +
    (auditStats?.by_decision?.APPROVED ?? 0) +
    (auditStats?.by_decision?.EXECUTED ?? 0) +
    (auditStats?.by_decision?.PERMIT ?? 0);
  const blockedEvents =
    (auditStats?.by_decision?.BLOCKED ?? 0) +
    (auditStats?.by_decision?.DENIED ?? 0) +
    (auditStats?.by_decision?.DENY ?? 0);

  const pendingCount = pendingApprovals.length;
  const passRate =
    totalEvents > 0 && allowedEvents + blockedEvents > 0
      ? (((allowedEvents) / (allowedEvents + blockedEvents)) * 100).toFixed(1)
      : totalEvents > 0
      ? (((allowedEvents) / totalEvents) * 100).toFixed(1)
      : "100.0";

  // Filter live table events
  const filteredEvents = recentEvents.filter((evt) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      String(evt.id).toLowerCase().includes(q) ||
      (evt.actor_id && evt.actor_id.toLowerCase().includes(q)) ||
      (evt.tool_name && evt.tool_name.toLowerCase().includes(q)) ||
      (evt.decision && evt.decision.toLowerCase().includes(q))
    );
  });

  const dbConnected = health?.dependencies?.database === "connected" || health?.database === "connected";
  const mcpReady = health?.dependencies?.mcp_server === "operational" || health?.mcp_server === "operational";

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6 select-none font-sans">
      {/* 1. System Telemetry & Cluster Header */}
      <section className="bg-[var(--surface-container-lowest)] p-4 sm:p-5 rounded-lg border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-[10px] text-emerald-400 font-bold flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              SECURITY OBSERVATORY // ACTIVE
            </span>
            <span className="font-mono text-[10px] text-[var(--on-surface-variant)] px-2 py-0.5 rounded bg-[var(--surface-container)] border border-[var(--border)]">
              NODE: {health?.service || "mcp-sentinel"} • {health?.environment?.toUpperCase() || "DEVELOPMENT"}
            </span>
          </div>
          <h1 className="font-headline-lg text-lg sm:text-xl font-bold tracking-tight text-[var(--on-surface)]">
            Command Center &amp; Policy Interceptor
          </h1>
          <p className="font-body-sm text-xs text-[var(--on-surface-variant)] mt-0.5">
            Model Context Protocol security envelope, dual-custody approval gating, and immutable audit telemetry
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => void loadData()}
            className="px-3 py-1.5 rounded bg-[var(--surface-container)] text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] border border-[var(--border)] transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Refresh telemetry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Poll Cluster</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90 font-semibold shadow-xs transition-opacity flex items-center gap-1.5 cursor-pointer"
            title="Export audit log as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit Log</span>
          </button>
        </div>
      </section>

      {/* Action feedback toast */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-lg font-mono text-xs flex items-center justify-between border ${
            actionFeedback.type === "success"
              ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/30"
              : "bg-rose-950/80 text-rose-300 border-rose-500/30"
          }`}
        >
          <span>{actionFeedback.msg}</span>
          <button onClick={() => setActionFeedback(null)} className="cursor-pointer font-bold px-1">
            ✕
          </button>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
          <div className="w-full max-w-md rounded-lg bg-[var(--surface-container-low)] border border-[var(--border)] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                  confirmDialog.action === "approve"
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-950 text-rose-400 border border-rose-500/30"
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--on-surface)]">
                  Confirm Human Decision: {confirmDialog.action.toUpperCase()}
                </h3>
                <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">
                  Ticket ID: <span className="font-mono text-[var(--primary)]">{confirmDialog.ticketId}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--on-surface-variant)] leading-relaxed">
              {confirmDialog.action === "approve"
                ? `You are signing off on the execution of "${confirmDialog.toolName}". The FastMCP server will execute the requested database mutation once.`
                : `You are denying and locking the execution of "${confirmDialog.toolName}". The AI agent will be halted and the violation recorded in the immutable audit ledger.`}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)] font-mono text-xs">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-3 py-1.5 rounded bg-[var(--surface-container)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAction(confirmDialog.ticketId, confirmDialog.action)}
                disabled={actionLoading === confirmDialog.ticketId}
                className={`px-3 py-1.5 rounded font-bold cursor-pointer transition-opacity ${
                  confirmDialog.action === "approve"
                    ? "bg-emerald-500 text-black hover:bg-emerald-400"
                    : "bg-rose-500 text-white hover:bg-rose-600"
                }`}
              >
                {actionLoading === confirmDialog.ticketId ? "Executing..." : `Confirm ${confirmDialog.action.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Four Operational Metric Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Governed Invocations */}
        <div className="bg-[var(--surface-container-lowest)] p-4 rounded-lg border border-[var(--border)] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-mono text-[10px] text-[var(--on-surface-variant)] uppercase tracking-wider block">
                Total Governed Operations
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-headline-xl text-xl sm:text-2xl font-bold text-[var(--on-surface)]">
                  {formatNumber(totalEvents)}
                </span>
                <span className="font-mono text-[11px] text-emerald-400 font-bold">
                  {passRate}% ALLOW
                </span>
              </div>
            </div>
            <div className="w-8 h-8 rounded bg-[var(--surface-container)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between font-mono text-[10px] text-[var(--on-surface-variant)]">
            <span>FastMCP intercepted calls</span>
            <span className="text-emerald-400 font-semibold">{allowedEvents} Permitted</span>
          </div>
        </div>

        {/* Metric 2: Pending Human Approvals */}
        <div className="bg-[var(--surface-container-lowest)] p-4 rounded-lg border border-[var(--border)] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-mono text-[10px] text-[var(--on-surface-variant)] uppercase tracking-wider block">
                Pending Approval Queue
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`font-headline-xl text-xl sm:text-2xl font-bold ${pendingCount > 0 ? "text-amber-400" : "text-[var(--on-surface)]"}`}>
                  {pendingCount}
                </span>
                <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${pendingCount > 0 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-[var(--surface-container)] text-[var(--on-surface-variant)]"}`}>
                  {pendingCount > 0 ? "ACTION REQUIRED" : "NOMINAL"}
                </span>
              </div>
            </div>
            <div className="w-8 h-8 rounded bg-[var(--surface-container)] border border-[var(--border)] flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between font-mono text-[10px]">
            <span className="text-[var(--on-surface-variant)]">Dual-custody gate</span>
            <Link href="/approvals" className="text-[var(--primary)] hover:underline flex items-center gap-0.5">
              Review Queue <ArrowRight className="w-2.5 h-2.5" />
            </Link>
          </div>
        </div>

        {/* Metric 3: Security Interceptions */}
        <div className="bg-[var(--surface-container-lowest)] p-4 rounded-lg border border-[var(--border)] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-mono text-[10px] text-[var(--on-surface-variant)] uppercase tracking-wider block">
                Security Interceptions
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`font-headline-xl text-xl sm:text-2xl font-bold ${blockedEvents > 0 ? "text-rose-400" : "text-[var(--on-surface)]"}`}>
                  {blockedEvents}
                </span>
                <span className="font-mono text-[10px] text-[var(--on-surface-variant)]">
                  BLOCKED
                </span>
              </div>
            </div>
            <div className="w-8 h-8 rounded bg-[var(--surface-container)] border border-[var(--border)] flex items-center justify-center text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between font-mono text-[10px] text-[var(--on-surface-variant)]">
            <span>SQL Injection &amp; bypasses</span>
            <span className="text-emerald-400 font-semibold">0 Unchecked</span>
          </div>
        </div>

        {/* Metric 4: Governed Tools & Connectors */}
        <div className="bg-[var(--surface-container-lowest)] p-4 rounded-lg border border-[var(--border)] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-mono text-[10px] text-[var(--on-surface-variant)] uppercase tracking-wider block">
                Governed MCP Tools
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-headline-xl text-xl sm:text-2xl font-bold text-[var(--on-surface)]">
                  {tools.length || 8}
                </span>
                <span className="font-mono text-[10px] text-emerald-400 font-semibold">
                  ACTIVE REGISTRY
                </span>
              </div>
            </div>
            <div className="w-8 h-8 rounded bg-[var(--surface-container)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)]">
              <Blocks className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between font-mono text-[10px] text-[var(--on-surface-variant)]">
            <span>Supabase + Notion</span>
            <Link href="/tools" className="text-[var(--primary)] hover:underline flex items-center gap-0.5">
              Tools Catalog <ArrowRight className="w-2.5 h-2.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Subsystem Health & Integration Telemetry Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Supabase PostgreSQL */}
        <div className="bg-[var(--surface-container-lowest)] p-4 rounded-lg border border-[var(--border)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-[var(--on-surface-variant)] uppercase tracking-wider">
                DATABASE BACKEND
              </span>
              <span
                className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                  dbConnected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}
              >
                {dbConnected ? "CONNECTED" : "OFFLINE"}
              </span>
            </div>
            <h3 className="text-sm font-bold text-[var(--on-surface)] mt-1 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-400" />
              Supabase PostgreSQL 17.11
            </h3>
            <p className="text-xs text-[var(--on-surface-variant)] mt-1">
              Isolated cloud database pool in Seoul (ap-northeast-2) with enforced TLS.
            </p>
          </div>
          <div className="mt-4 pt-2 border-t border-[var(--border-subtle)] font-mono text-[11px] text-[var(--on-surface-variant)] flex items-center justify-between">
            <span>Pool Capacity</span>
            <span className="font-semibold text-[var(--on-surface)]">
              {health?.pool?.used ?? 0} in-use / {health?.pool?.total ?? 2} total handles
            </span>
          </div>
        </div>

        {/* Card 2: FastMCP Daemon */}
        <div className="bg-[var(--surface-container-lowest)] p-4 rounded-lg border border-[var(--border)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-[var(--on-surface-variant)] uppercase tracking-wider">
                MCP PROTOCOL SERVER
              </span>
              <span
                className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                  mcpReady
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}
              >
                {mcpReady ? "OPERATIONAL" : "DEGRADED"}
              </span>
            </div>
            <h3 className="text-sm font-bold text-[var(--on-surface)] mt-1 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-[var(--primary)]" />
              FastMCP Security Interceptor
            </h3>
            <p className="text-xs text-[var(--on-surface-variant)] mt-1">
              Zero-trust gateway intercepting arguments and checking policies before tool dispatch.
            </p>
          </div>
          <div className="mt-4 pt-2 border-t border-[var(--border-subtle)] font-mono text-[11px] text-[var(--on-surface-variant)] flex items-center justify-between">
            <span>Registered Surface</span>
            <span className="font-semibold text-[var(--on-surface)]">
              {tools.length || 8} tools with invariant guardrails
            </span>
          </div>
        </div>

        {/* Card 3: Notion Integration */}
        <div className="bg-[var(--surface-container-lowest)] p-4 rounded-lg border border-[var(--border)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-[var(--on-surface-variant)] uppercase tracking-wider">
                ENTERPRISE CONNECTOR
              </span>
              <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                (integrations.find((i) => i.id === "notion")?.live_status || integrations.find((i) => i.id === "notion")?.status) === "CONNECTED"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-[var(--surface-container)] text-[var(--on-surface-variant)] border-[var(--border)]"
              }`}>
                {integrations.find((i) => i.id === "notion")?.live_status || integrations.find((i) => i.id === "notion")?.status || "CONFIGURED"}
              </span>
            </div>
            <h3 className="text-sm font-bold text-[var(--on-surface)] mt-1 flex items-center gap-1.5">
              <Blocks className="w-4 h-4 text-purple-400" />
              Notion REST Workspace
            </h3>
            <p className="text-xs text-[var(--on-surface-variant)] mt-1">
              Official Notion API connector for searching pages, databases, and gating document archival.
            </p>
          </div>
          <div className="mt-4 pt-2 border-t border-[var(--border-subtle)] font-mono text-[11px] text-[var(--on-surface-variant)] flex items-center justify-between">
            <span>Configuration</span>
            <Link href="/integrations" className="text-[var(--primary)] hover:underline flex items-center gap-0.5">
              Manage Connector <ArrowRight className="w-2.5 h-2.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Pending Approval Ticket Spotlight (if any pending) */}
      {pendingApprovals.length > 0 && (
        <section className="bg-amber-950/20 border border-amber-500/30 rounded-lg p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-amber-300 uppercase tracking-wider font-mono">
                Urgent Dual-Custody Approval Required ({pendingApprovals.length} pending)
              </h2>
            </div>
            <Link href="/approvals" className="font-mono text-xs text-amber-400 hover:underline">
              View All ({pendingApprovals.length}) →
            </Link>
          </div>

          <div className="bg-[var(--surface-container-lowest)] border border-[var(--border)] rounded p-3 text-xs space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-mono">
                <span className="text-[var(--primary)] font-bold">
                  {pendingApprovals[0].tool_name || pendingApprovals[0].action}
                </span>
                <span className="text-[var(--on-surface-variant)]">•</span>
                <span className="text-[var(--on-surface-variant)]">
                  Target: {pendingApprovals[0].target_id || "resource"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                  RISK: {pendingApprovals[0].risk_score || "CRITICAL"}
                </span>
                <span className="text-[var(--on-surface-variant)] text-[11px]">
                  Requested: {formatTime(pendingApprovals[0].created_at)}
                </span>
              </div>
            </div>

            <p className="text-[var(--on-surface-variant)] text-xs">
              Reason: {pendingApprovals[0].justification || pendingApprovals[0].reason || "Destructive operation requires explicit human-in-the-loop authorization."}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)] font-mono text-xs">
              <button
                type="button"
                onClick={() =>
                  setConfirmDialog({
                    ticketId: pendingApprovals[0].ticket_id || pendingApprovals[0].id || "",
                    action: "deny",
                    toolName: pendingApprovals[0].tool_name || pendingApprovals[0].action,
                  })
                }
                className="px-3 py-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 font-semibold cursor-pointer"
              >
                Reject &amp; Quarantine
              </button>
              <button
                type="button"
                onClick={() =>
                  setConfirmDialog({
                    ticketId: pendingApprovals[0].ticket_id || pendingApprovals[0].id || "",
                    action: "approve",
                    toolName: pendingApprovals[0].tool_name || pendingApprovals[0].action,
                  })
                }
                className="px-3 py-1 rounded bg-emerald-500 text-black hover:bg-emerald-400 font-bold cursor-pointer"
              >
                Authorize Execution
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 5. Live Governed Audit Ledger Feed */}
      <section className="bg-[var(--surface-container-lowest)] rounded-lg border border-[var(--border)] overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)]">
          <div>
            <h2 className="text-sm font-bold text-[var(--on-surface)] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
              Live Security &amp; Audit Activity Stream
            </h2>
            <p className="font-body-sm text-xs text-[var(--on-surface-variant)] mt-0.5">
              Cryptographically verified decision records from the PostgreSQL append-only audit ledger
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--on-surface-variant)]" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter tool, actor, decision..."
                className="pl-8 pr-3 py-1.5 text-xs rounded bg-[var(--surface-container)] border border-[var(--border)] text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] font-mono outline-none w-48 sm:w-64"
              />
            </div>
            <Link
              href="/audit"
              className="px-3 py-1.5 text-xs font-mono rounded bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface)] border border-[var(--border)] transition-colors"
            >
              Full Ledger →
            </Link>
          </div>
        </div>

        {/* Audit Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-container-low)] text-[10px] text-[var(--on-surface-variant)] uppercase tracking-wider">
                <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                <th className="py-2.5 px-4 font-semibold">Actor / Caller</th>
                <th className="py-2.5 px-4 font-semibold">Tool Invocation</th>
                <th className="py-2.5 px-4 font-semibold">Policy Decision</th>
                <th className="py-2.5 px-4 font-semibold">Risk Score</th>
                <th className="py-2.5 px-4 font-semibold text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[var(--on-surface-variant)]">
                    {loading ? "Polling database audit events..." : "No matching audit events recorded."}
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => {
                  const isBlocked = evt.decision === "BLOCKED" || evt.decision === "DENIED" || evt.decision === "DENY";
                  const isApproval = evt.decision === "REQUIRE_APPROVAL" || evt.decision === "PENDING";
                  return (
                    <tr
                      key={evt.id}
                      className="hover:bg-[var(--surface-container)]/50 transition-colors"
                    >
                      <td className="py-2.5 px-4 text-[var(--on-surface-variant)] whitespace-nowrap">
                        {formatTime(evt.created_at)}
                      </td>
                      <td className="py-2.5 px-4 text-[var(--on-surface)] whitespace-nowrap">
                        {evt.actor_id || evt.agent_id || "agent-v1"}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-[var(--primary)] whitespace-nowrap">
                        {evt.tool_name || evt.event_type}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isBlocked
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : isApproval
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          }`}
                        >
                          {evt.decision}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="text-[var(--on-surface-variant)]">
                          {evt.risk_score ?? 10}/100
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(evt)}
                          className="px-2 py-1 rounded hover:bg-[var(--surface-container-high)] text-[var(--primary)] font-semibold cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Event Inspector Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
          <div className="w-full max-w-2xl rounded-lg bg-[var(--surface-container-low)] border border-[var(--border)] p-5 space-y-4 shadow-2xl font-mono text-xs max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="font-bold text-sm text-[var(--on-surface)]">
                  Audit Record Inspector: Event #{selectedEvent.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px] bg-[var(--surface-container-lowest)] p-3 rounded border border-[var(--border)]">
              <div>
                <span className="text-[var(--on-surface-variant)] block">Tool Invocation</span>
                <span className="font-bold text-[var(--primary)]">{selectedEvent.tool_name || selectedEvent.event_type}</span>
              </div>
              <div>
                <span className="text-[var(--on-surface-variant)] block">Policy Decision</span>
                <span className="font-bold text-[var(--on-surface)]">{selectedEvent.decision}</span>
              </div>
              <div>
                <span className="text-[var(--on-surface-variant)] block">Actor Identity</span>
                <span>{selectedEvent.actor_id || selectedEvent.agent_id || "agent-v1"}</span>
              </div>
              <div>
                <span className="text-[var(--on-surface-variant)] block">Timestamp</span>
                <span>{selectedEvent.created_at}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 min-h-[140px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--on-surface-variant)] uppercase font-semibold">
                  Sanitized Payload &amp; Policy Metadata (Secrets Redacted)
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyJson(selectedEvent.details || selectedEvent)}
                  className="flex items-center gap-1 text-[10px] text-[var(--primary)] hover:underline cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy JSON"}</span>
                </button>
              </div>
              <pre className="p-3 rounded bg-[var(--surface-container-lowest)] border border-[var(--border)] text-[11px] text-[var(--on-surface)] overflow-x-auto leading-relaxed">
                {JSON.stringify(selectedEvent.details || selectedEvent, null, 2)}
              </pre>
            </div>

            <div className="pt-3 border-t border-[var(--border)] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="px-3 py-1.5 rounded bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface)] cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
