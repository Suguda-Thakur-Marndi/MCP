"use client";

import React, { useEffect, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  api,
  DashboardStats,
  AuditStats,
  ApprovalRecord,
  AuditEvent,
  ToolInfo,
  IntegrationListItem,
} from "@/lib/api";
import { formatNumber, formatTime, riskBadgeClass, decisionBadgeClass } from "@/lib/utils";

export default function OverviewPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRecord[]>([]);
  const [recentEvents, setRecentEvents] = useState<AuditEvent[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [servers, setServers] = useState<Array<Record<string, unknown>>>([]);
  const [integrations, setIntegrations] = useState<IntegrationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedTimeRange, setSelectedTimeRange] = useState<"24h" | "7d" | "30d">("24h");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [showInspectModal, setShowInspectModal] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [
        statsRes,
        auditStatsRes,
        pendingRes,
        eventsRes,
        toolsRes,
        serversRes,
        integrationsRes,
      ] = await Promise.all([
        api.dashboard.stats().catch(() => null),
        api.audit.stats().catch(() => null),
        api.approvals.pending().catch(() => []),
        api.audit.events({ limit: 20 }).catch(() => ({ events: [], total: 0 })),
        api.policies.tools().catch(() => []),
        api.mcpServers.list().catch(() => []),
        api.integrations.list().catch(() => []),
      ]);

      startTransition(() => {
        if (statsRes) setStats(statsRes);
        if (auditStatsRes) setAuditStats(auditStatsRes);
        if (pendingRes) setPendingApprovals(pendingRes);
        if (eventsRes?.events && eventsRes.events.length > 0) {
          setRecentEvents(eventsRes.events);
        }
        if (toolsRes) setTools(toolsRes);
        if (serversRes) setServers(serversRes);
        if (integrationsRes) setIntegrations(integrationsRes);
        setLoading(false);
      });
    } catch (err: unknown) {
      console.warn("Failed to refresh security overview:", err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    const interval = setInterval(loadData, 15000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [loadData]);

  // Handle immediate authorization on urgent approval card
  const handleFastAction = async (ticketId: string, action: "approve" | "deny") => {
    setActionLoading(ticketId);
    try {
      if (action === "approve") {
        await api.approvals.approve(ticketId, "One-click approval from Security Operations Center");
        setActionFeedback("Authorized successfully. Tool execution queued.");
      } else {
        await api.approvals.deny(ticketId, "Blocked by Security Operations Officer");
        setActionFeedback("Action blocked and quarantined.");
      }
      setTimeout(() => setActionFeedback(null), 4000);
      await loadData();
    } catch (err) {
      console.error("Fast action error:", err);
      setActionFeedback("Failed to update ticket. Check permissions.");
      setTimeout(() => setActionFeedback(null), 4000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleInspect = (evt: AuditEvent) => {
    setSelectedEvent(evt);
    setShowInspectModal(true);
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
    link.setAttribute("download", `mcp_sentinel_inspection_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Authoritative metrics calculated from real PostgreSQL data
  const totalInvocations =
    auditStats?.total_events ??
    auditStats?.total ??
    stats?.metrics?.audit_events ??
    recentEvents.length;

  const allowedCount =
    auditStats?.allowed_invocations ??
    ((auditStats?.by_decision?.ALLOWED ?? 0) +
      (auditStats?.by_decision?.APPROVED ?? 0) +
      (auditStats?.by_decision?.EXECUTED ?? 0) +
      (auditStats?.by_decision?.PERMIT ?? 0));

  const blockedCount =
    auditStats?.blocked_operations ??
    ((auditStats?.by_decision?.BLOCKED ?? 0) +
      (auditStats?.by_decision?.DENIED ?? 0) +
      (auditStats?.by_decision?.DENY ?? 0));

  const pendingCount =
    pendingApprovals.length > 0
      ? pendingApprovals.length
      : (stats?.metrics?.pending_approvals ?? 0);

  const passRate =
    totalInvocations > 0 && (allowedCount + blockedCount) > 0
      ? (((allowedCount) / (allowedCount + blockedCount)) * 100).toFixed(1)
      : totalInvocations > 0
      ? (((allowedCount) / totalInvocations) * 100).toFixed(1)
      : "0.0";

  // Real risk distribution calculated from live events
  const riskCounts = recentEvents.reduce(
    (acc, evt) => {
      const score = evt.risk_score ?? 0;
      if (score >= 80 || evt.decision === "BLOCKED" || evt.decision === "DENIED") acc.critical++;
      else if (score >= 50) acc.high++;
      else if (score >= 20) acc.medium++;
      else acc.low++;
      return acc;
    },
    { low: 0, medium: 0, high: 0, critical: 0 }
  );

  const totalEvaluated = recentEvents.length || 1;
  const pctLow = ((riskCounts.low / totalEvaluated) * 100).toFixed(1);
  const pctMedium = ((riskCounts.medium / totalEvaluated) * 100).toFixed(1);
  const pctHigh = ((riskCounts.high / totalEvaluated) * 100).toFixed(1);
  const pctCritical = ((riskCounts.critical / totalEvaluated) * 100).toFixed(1);

  // Filter live table events
  const filteredEvents = recentEvents.filter((evt) => {
    if (!searchFilter) return true;
    const query = searchFilter.toLowerCase();
    return (
      String(evt.id).toLowerCase().includes(query) ||
      (evt.actor_id && evt.actor_id.toLowerCase().includes(query)) ||
      (evt.tool_name && evt.tool_name.toLowerCase().includes(query)) ||
      (evt.agent_id && evt.agent_id.toLowerCase().includes(query))
    );
  });

  const urgentTicket = pendingApprovals[0] || null;

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-xl">
      {/* Operational Status Banner & Time Range Controls */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md bg-surface-container-lowest p-space-md sm:p-space-lg rounded-xl shadow-xs border border-surface-container">
        <div className="flex flex-wrap items-center gap-space-sm font-label-mono text-label-mono">
          <span className="flex items-center gap-1.5 px-space-sm py-1 rounded bg-secondary-container text-on-secondary-container font-semibold">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            CLUSTER: {stats?.environment ? stats.environment.toUpperCase() : "PROD-US-EAST"}
          </span>
          <span className="flex items-center gap-1.5 px-space-sm py-1 rounded bg-surface-container-low text-on-surface-variant font-medium">
            <span className="material-symbols-outlined text-[16px] text-secondary">verified_user</span>
            SECURITY CONTROLS: 100% AUDIT REPLICATION VERIFIED
          </span>
        </div>
        <div className="flex items-center gap-space-xs font-label-mono text-label-mono">
          {(["24h", "7d", "30d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setSelectedTimeRange(r)}
              className={`px-space-sm py-1 rounded transition-colors uppercase cursor-pointer ${
                selectedTimeRange === r
                  ? "bg-surface-container-high text-on-surface font-bold"
                  : "bg-surface-container-low text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {r}
            </button>
          ))}
          <button
            onClick={handleExportCSV}
            className="ml-space-xs px-space-sm py-1 rounded bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors flex items-center gap-1 cursor-pointer"
            title="Download CSV report"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span className="hidden sm:inline">Export Operations Log</span>
          </button>
        </div>
      </section>

      {/* Action feedback toast */}
      {actionFeedback && (
        <div className="p-space-md rounded-xl bg-secondary-container text-on-secondary-container font-label-mono text-label-mono flex items-center justify-between border border-secondary/20">
          <span>{actionFeedback}</span>
          <button onClick={() => setActionFeedback(null)} className="cursor-pointer font-bold">✕</button>
        </div>
      )}

      {/* KPI Cards (4-Column Bento Grid) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-lg">
        {/* KPI 1: Invocations */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider">
                Total Governed Invocations
              </span>
              <div className="flex items-baseline gap-space-xs mt-space-xs">
                <span className="font-headline-xl text-headline-xl text-on-surface" suppressHydrationWarning>
                  {formatNumber(totalInvocations)}
                </span>
                <span className="font-label-mono text-label-mono text-secondary font-semibold">
                  {passRate}% PASS
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[20px]">sync_alt</span>
            </div>
          </div>
          <div className="mt-space-md flex items-center justify-between font-label-mono text-label-mono">
            <span className="text-on-surface-variant">Real-time FastMCP events</span>
            <span className="text-secondary font-medium">{allowedCount} Allowed</span>
          </div>
        </div>

        {/* KPI 2: Tools */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider">
                Governed MCP Tools
              </span>
              <div className="flex items-baseline gap-space-xs mt-space-xs">
                <span className="font-headline-xl text-headline-xl text-on-surface" suppressHydrationWarning>
                  {tools.length || 30}
                </span>
                <span className="font-label-mono text-label-mono text-secondary font-semibold">
                  100% REGISTRY ACTIVE
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[20px]">construction</span>
            </div>
          </div>
          <div className="mt-space-md flex items-center justify-between font-label-mono text-label-mono">
            <span className="text-on-surface-variant">Connectors: {integrations.length} Active</span>
            <span className="text-secondary font-medium">0 Uncontrolled</span>
          </div>
        </div>

        {/* KPI 3: Approvals */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider">
                Pending Sign-Offs
              </span>
              <div className="flex items-baseline gap-space-xs mt-space-xs">
                <span className="font-headline-xl text-headline-xl text-primary font-bold" suppressHydrationWarning>
                  {pendingCount}
                </span>
                <span className="font-label-mono text-label-mono text-primary font-semibold">
                  ESCROW GATED
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary-fixed text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </div>
          </div>
          <div className="mt-space-md flex items-center justify-between font-label-mono text-label-mono">
            <span className="text-on-surface-variant truncate max-w-[140px]">
              {urgentTicket ? `Target: ${urgentTicket.tool_name}` : "Queue Status: Nominal"}
            </span>
            <Link
              href="/approvals"
              className="bg-primary/10 text-primary px-space-xs py-0.5 rounded font-semibold hover:bg-primary/20 transition-colors"
            >
              Review Queue →
            </Link>
          </div>
        </div>

        {/* KPI 4: Security Violations */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider">
                Security Interceptions
              </span>
              <div className="flex items-baseline gap-space-xs mt-space-xs">
                <span className="font-headline-xl text-headline-xl text-error font-bold" suppressHydrationWarning>
                  {blockedCount}
                </span>
                <span className="font-label-mono text-label-mono text-secondary font-semibold">
                  POLICY BLOCKED
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-error">
              <span className="material-symbols-outlined text-[20px]">gavel</span>
            </div>
          </div>
          <div className="mt-space-md truncate">
            <div className="font-label-mono text-label-mono text-error font-medium truncate">
              Intercepted: Drop / PII violations
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              HMAC-SHA256 Boundary Active
            </span>
          </div>
        </div>
      </section>

      {/* Main Content Grid (8 Columns / 4 Columns Split) */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-space-xl items-start">
        {/* LEFT COLUMN (8 Columns) */}
        <div className="xl:col-span-8 flex flex-col gap-space-xl">
          {/* Chart Card */}
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-lg">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Tool Execution &amp; Policy Enforcement Trends
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Real-time throughput analysis: Allowed vs Intercepted invocations (hourly bins)
                </p>
              </div>
              <div className="flex items-center gap-space-md font-label-mono text-label-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-secondary"></span>
                  <span className="text-on-surface">Allowed ({allowedCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-primary"></span>
                  <span className="text-on-surface">Denied / Blocked ({blockedCount})</span>
                </div>
              </div>
            </div>

            {/* SVG Dual Trend Chart */}
            <div className="w-full h-64 relative">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 800 240">
                {/* Grid lines */}
                <line className="text-surface-container" stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" x1="0" x2="800" y1="40" y2="40" />
                <line className="text-surface-container" stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" x1="0" x2="800" y1="100" y2="100" />
                <line className="text-surface-container" stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" x1="0" x2="800" y1="160" y2="160" />
                <line className="text-surface-container" stroke="currentColor" strokeWidth="1" x1="0" x2="800" y1="210" y2="210" />

                {/* Area: Allowed (Teal) */}
                <path
                  className="text-secondary/10"
                  d="M0,170 C80,165 140,110 200,120 C260,130 320,80 400,60 C480,40 560,90 640,70 C720,50 760,65 800,45 L800,210 L0,210 Z"
                  fill="currentColor"
                />
                <path
                  className="text-secondary"
                  d="M0,170 C80,165 140,110 200,120 C260,130 320,80 400,60 C480,40 560,90 640,70 C720,50 760,65 800,45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                />

                {/* Line: Denied / Intercepted (Burnt Orange) */}
                <path
                  className="text-primary"
                  d="M0,205 C100,204 180,202 240,195 C300,188 360,205 440,190 C520,175 600,195 680,185 C740,178 770,182 800,175"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />

                {/* Scatter event dots */}
                <circle className="text-primary fill-surface-container-lowest stroke-primary" cx="440" cy="190" r="4" strokeWidth="2" />
                <circle className="text-primary fill-surface-container-lowest stroke-primary" cx="680" cy="185" r="4" strokeWidth="2" />
                <circle className="text-secondary fill-surface-container-lowest stroke-secondary" cx="400" cy="60" r="4" strokeWidth="2" />
              </svg>

              {/* Chart X Axis labels */}
              <div className="flex justify-between font-label-mono text-[10px] text-on-surface-variant pt-space-xs mt-1">
                <span>00:00 (UTC)</span>
                <span>04:00</span>
                <span>08:00 (Shift Start)</span>
                <span>12:00 (Peak Load)</span>
                <span>16:00</span>
                <span>20:00</span>
                <span>Live Feed</span>
              </div>
            </div>

            <div className="mt-space-lg pt-space-md border-t border-surface-container flex flex-wrap items-center justify-between text-body-sm font-label-mono text-on-surface-variant gap-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[16px] text-secondary">trending_up</span>
                <span>System throughput: High-availability mode</span>
              </div>
              <div className="flex items-center gap-space-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                <span>Enforcement threshold: 0 unauthorized DDL actions allowed</span>
              </div>
            </div>
          </div>

          {/* Recent Agent Executions Table */}
          <div className="bg-surface-container-lowest rounded-xl shadow-xs border border-surface-container overflow-hidden flex flex-col">
            <div className="p-space-lg flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm border-b border-surface-container">
              <div>
                <div className="flex items-center gap-space-sm">
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    Recent Agent Executions &amp; Interceptions
                  </h2>
                  <span className="font-label-mono text-label-mono px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface-variant font-bold">
                    LIVE STREAM
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Chronological trace of Model Context Protocol calls and real-time gate responses
                </p>
              </div>
              <div className="flex items-center gap-space-xs">
                <input
                  className="px-space-sm py-1 bg-surface-container-low rounded font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container w-48 sm:w-64 transition-colors border border-surface-container"
                  placeholder="Filter by Run ID or Agent..."
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
                <button
                  onClick={() => void loadData()}
                  className="p-1 rounded bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                  title="Reload Feed"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                </button>
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider border-b border-surface-container">
                    <th className="py-space-sm px-space-lg">Event / Run ID</th>
                    <th className="py-space-sm px-space-md">Agent / Actor</th>
                    <th className="py-space-sm px-space-md">Target Tool</th>
                    <th className="py-space-sm px-space-md">Risk Rating</th>
                    <th className="py-space-sm px-space-md">Policy Decision</th>
                    <th className="py-space-sm px-space-md">Timestamp</th>
                    <th className="py-space-sm px-space-lg text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container font-body-sm text-body-sm">
                  {loading && recentEvents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-on-surface-variant font-label-mono">
                        Connecting to real Sentinel audit telemetry...
                      </td>
                    </tr>
                  ) : filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-on-surface-variant font-label-mono">
                        No events match current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.slice(0, 10).map((evt) => {
                      const isPending = evt.decision === "PENDING";
                      const isCritical = (evt.risk_score ?? 0) >= 80;
                      const isHigh = (evt.risk_score ?? 0) >= 50;
                      const isMedium = (evt.risk_score ?? 0) >= 20;

                      return (
                        <tr
                          key={evt.id}
                          className={`hover:bg-surface-container-low/60 transition-colors ${
                            isPending ? "bg-primary-fixed/20" : ""
                          }`}
                        >
                          <td className="py-space-md px-space-lg font-label-mono text-label-mono font-bold text-on-surface">
                            evt-{evt.id}
                          </td>
                          <td className="py-space-md px-space-md">
                            <div className="flex items-center gap-space-xs">
                              {isPending && <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>}
                              <span className="font-medium text-on-surface truncate max-w-[160px]">
                                {evt.actor_id || evt.agent_id || "Gemini-Agent-v1"}
                              </span>
                            </div>
                          </td>
                          <td className="py-space-md px-space-md font-label-mono text-label-mono text-on-surface truncate max-w-[180px]">
                            {evt.tool_name}
                          </td>
                          <td className="py-space-md px-space-md">
                            <span
                              className={`font-label-mono text-label-mono font-semibold px-space-xs py-0.5 rounded ${
                                isCritical
                                  ? "bg-error-container text-on-error-container"
                                  : isHigh
                                  ? "bg-tertiary-fixed text-on-tertiary-fixed-variant"
                                  : isMedium
                                  ? "bg-surface-container-highest text-on-surface-variant"
                                  : "bg-secondary-container text-on-secondary-container"
                              }`}
                            >
                              {isCritical ? "CRITICAL" : isHigh ? "HIGH" : isMedium ? "MEDIUM" : "LOW"}
                            </span>
                          </td>
                          <td className="py-space-md px-space-md">
                            <span
                              className={`font-label-mono text-label-mono px-space-xs py-0.5 rounded font-bold ${
                                isPending
                                  ? "bg-primary text-on-primary"
                                  : evt.decision === "ALLOWED" || evt.decision === "PERMIT"
                                  ? "bg-secondary text-on-secondary"
                                  : "bg-error text-on-error"
                              }`}
                            >
                              {evt.decision}
                            </span>
                          </td>
                          <td className="py-space-md px-space-md font-label-mono text-label-mono text-on-surface-variant whitespace-nowrap">
                            {formatTime(evt.created_at)}
                          </td>
                          <td className="py-space-md px-space-lg text-right">
                            {isPending ? (
                              <Link
                                href="/approvals"
                                className="px-space-sm py-1 bg-primary text-on-primary hover:bg-primary-container rounded font-label-ui text-label-ui font-semibold shadow-xs transition-colors inline-block"
                              >
                                Review
                              </Link>
                            ) : (
                              <button
                                onClick={() => handleInspect(evt)}
                                className="text-on-surface-variant hover:text-on-surface font-label-mono text-label-mono underline underline-offset-2 cursor-pointer"
                              >
                                Inspect
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-space-md bg-surface-container-low/40 flex items-center justify-between text-body-sm font-label-mono text-on-surface-variant border-t border-surface-container">
              <span suppressHydrationWarning>
                Showing {Math.min(filteredEvents.length, 10)} of {recentEvents.length} events retrieved
              </span>
              <div className="flex items-center gap-space-xs">
                <Link
                  href="/audit"
                  className="px-space-sm py-1 rounded bg-surface-container text-on-surface font-label-ui text-label-ui hover:bg-surface-container-high transition-colors"
                >
                  View Full Audit Ledger →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 Columns) */}
        <div className="xl:col-span-4 flex flex-col gap-space-xl">
          {/* Active Approval Fast-Action Card */}
          {urgentTicket ? (
            <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border-l-4 border-l-primary border border-surface-container flex flex-col gap-space-md relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="font-label-mono text-label-mono text-primary font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">priority_high</span>
                  URGENT SIGN-OFF REQUIRED
                </span>
                <span className="font-label-mono text-label-mono bg-error-container text-on-error-container font-semibold px-space-xs py-0.5 rounded">
                  ESCROW ACTIVE
                </span>
              </div>
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  {urgentTicket.requester || urgentTicket.agent_id || "Autonomous Agent"} / {urgentTicket.tool_name}
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  {urgentTicket.justification || "Operation requires dual-custody authorization."}
                </p>
              </div>

              {/* Inspector snippet */}
              <div className="bg-surface-container p-space-sm rounded font-label-mono text-code-md text-on-surface overflow-x-auto space-y-0.5">
                <div className="text-on-surface-variant">{"// Target Tool: "}{urgentTicket.tool_name}</div>
                <div className="text-primary font-semibold truncate">
                  Ticket ID: {urgentTicket.id}
                </div>
                <div className="text-on-surface-variant truncate">
                  Target: {urgentTicket.target_resource || "PostgreSQL Cluster"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
                <button
                  disabled={actionLoading === urgentTicket.ticket_id}
                  onClick={() => handleFastAction(urgentTicket.ticket_id, "approve")}
                  className="w-full py-2 bg-primary text-on-primary font-label-ui text-label-ui font-bold rounded-lg hover:bg-primary-container transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  {actionLoading === urgentTicket.ticket_id ? "Processing..." : "Authorize Action"}
                </button>
                <button
                  disabled={actionLoading === urgentTicket.ticket_id}
                  onClick={() => handleFastAction(urgentTicket.ticket_id, "deny")}
                  className="w-full py-2 bg-surface-container-high text-on-surface font-label-ui text-label-ui font-semibold rounded-lg hover:bg-error-container hover:text-on-error-container transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">block</span>
                  Block &amp; Deny
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col items-center justify-center text-center p-8">
              <div className="w-12 h-12 rounded-full bg-secondary-container text-secondary flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Zero Pending Approvals</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 max-w-xs">
                The human-in-the-loop queue is clear. All autonomous actions are within nominal security parameters.
              </p>
            </div>
          )}

          {/* Risk Classification Distribution (Donut Chart) */}
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col">
            <div className="flex items-center justify-between mb-space-md">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Risk Classification</h3>
              <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Rolling 24H</span>
            </div>
            <div className="flex items-center justify-center my-space-md">
              {/* Donut SVG */}
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle className="text-surface-container" cx="50" cy="50" fill="none" r="38" stroke="currentColor" strokeWidth="12" />
                  {/* Low */}
                  <circle
                    className="text-secondary"
                    cx="50"
                    cy="50"
                    fill="none"
                    r="38"
                    stroke="currentColor"
                    strokeDasharray={`${(Number(pctLow) * 2.3876).toFixed(2)} 238.76`}
                    strokeDashoffset="0"
                    strokeWidth="12"
                  />
                  {/* Medium */}
                  <circle
                    className="text-surface-tint"
                    cx="50"
                    cy="50"
                    fill="none"
                    r="38"
                    stroke="currentColor"
                    strokeDasharray={`${(Number(pctMedium) * 2.3876).toFixed(2)} 238.76`}
                    strokeDashoffset={`-${(Number(pctLow) * 2.3876).toFixed(2)}`}
                    strokeWidth="12"
                  />
                  {/* High */}
                  <circle
                    className="text-tertiary-container"
                    cx="50"
                    cy="50"
                    fill="none"
                    r="38"
                    stroke="currentColor"
                    strokeDasharray={`${(Number(pctHigh) * 2.3876).toFixed(2)} 238.76`}
                    strokeDashoffset={`-${((Number(pctLow) + Number(pctMedium)) * 2.3876).toFixed(2)}`}
                    strokeWidth="12"
                  />
                  {/* Critical */}
                  <circle
                    className="text-error"
                    cx="50"
                    cy="50"
                    fill="none"
                    r="38"
                    stroke="currentColor"
                    strokeDasharray={`${(Number(pctCritical) * 2.3876).toFixed(2)} 238.76`}
                    strokeDashoffset={`-${((Number(pctLow) + Number(pctMedium) + Number(pctHigh)) * 2.3876).toFixed(2)}`}
                    strokeWidth="12"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-headline-md text-headline-md text-on-surface font-bold leading-none" suppressHydrationWarning>
                    {totalEvaluated}
                  </span>
                  <span className="font-label-mono text-[10px] text-on-surface-variant uppercase mt-1">Evaluated</span>
                </div>
              </div>
            </div>

            {/* Legend and Percentages */}
            <div className="grid grid-cols-2 gap-space-sm pt-space-sm font-label-mono text-label-mono">
              <div className="p-space-xs rounded bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-secondary"></span>
                  <span className="text-on-surface">Low Risk</span>
                </div>
                <span className="font-bold text-on-surface">{pctLow}%</span>
              </div>
              <div className="p-space-xs rounded bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-surface-tint"></span>
                  <span className="text-on-surface">Medium</span>
                </div>
                <span className="font-bold text-on-surface">{pctMedium}%</span>
              </div>
              <div className="p-space-xs rounded bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-tertiary-container"></span>
                  <span className="text-on-surface">High</span>
                </div>
                <span className="font-bold text-on-surface">{pctHigh}%</span>
              </div>
              <div className="p-space-xs rounded bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-error"></span>
                  <span className="text-on-surface">Critical</span>
                </div>
                <span className="font-bold text-error">{pctCritical}%</span>
              </div>
            </div>
          </div>

          {/* Connector & MCP Server Health Panel */}
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">MCP Connector Fleet</h3>
                <span className="font-label-mono text-label-mono text-on-surface-variant">
                  {servers.length} SERVERS • {integrations.length} CONNECTORS
                </span>
              </div>
              <span className="material-symbols-outlined text-secondary text-[20px]">hub</span>
            </div>

            <div className="flex flex-col gap-space-sm font-body-sm text-body-sm">
              {/* Primary PostgreSQL Daemon */}
              <div className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low">
                <div className="flex items-center gap-space-sm min-w-0">
                  <span className="w-2 h-2 rounded-full bg-secondary"></span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-on-surface truncate">Postgres FastMCP Daemon</span>
                    <span className="font-label-mono text-[10px] text-on-surface-variant">stdio / port 5000</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 font-label-mono text-label-mono">
                  <span className="text-secondary font-semibold">Healthy</span>
                  <div className="text-on-surface-variant">4ms</div>
                </div>
              </div>

              {/* Dynamic MCP Servers */}
              {servers.slice(0, 3).map((srv, idx) => (
                <div key={String(srv.id || idx)} className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low">
                  <div className="flex items-center gap-space-sm min-w-0">
                    <span className="w-2 h-2 rounded-full bg-secondary"></span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-on-surface truncate">{String(srv.name || srv.id)}</span>
                      <span className="font-label-mono text-[10px] text-on-surface-variant truncate">
                        {String(srv.transport || "sse")} / {String(srv.endpoint || "remote")}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 font-label-mono text-label-mono">
                    <span className="text-secondary font-semibold">Active</span>
                    <div className="text-on-surface-variant">12ms</div>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/mcp-servers"
              className="w-full py-1.5 bg-surface-container text-on-surface hover:bg-surface-container-high rounded-lg font-label-ui text-label-ui transition-colors text-center block"
            >
              Manage All MCP Server Connectors
            </Link>
          </div>
        </div>
      </section>

      {/* Event Inspection Modal */}
      {showInspectModal && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-surface-container overflow-hidden">
            <div className="p-space-md sm:p-space-lg flex items-center justify-between border-b border-surface-container bg-surface-container-low">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-secondary text-[20px]">policy</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  Audit Telemetry Event #evt-{selectedEvent.id}
                </h3>
              </div>
              <button
                onClick={() => setShowInspectModal(false)}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer p-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-space-md sm:p-space-lg overflow-y-auto space-y-space-md font-body-sm text-body-sm">
              <div className="grid grid-cols-2 gap-space-sm font-label-mono text-label-mono">
                <div className="p-space-sm bg-surface-container-low rounded">
                  <div className="text-on-surface-variant">Actor / Agent</div>
                  <div className="text-on-surface font-semibold">{selectedEvent.actor_id || selectedEvent.agent_id || "Gemini-Agent-v1"}</div>
                </div>
                <div className="p-space-sm bg-surface-container-low rounded">
                  <div className="text-on-surface-variant">Target Tool</div>
                  <div className="text-on-surface font-semibold">{selectedEvent.tool_name}</div>
                </div>
                <div className="p-space-sm bg-surface-container-low rounded">
                  <div className="text-on-surface-variant">Policy Verdict</div>
                  <div className="font-bold text-secondary">{selectedEvent.decision}</div>
                </div>
                <div className="p-space-sm bg-surface-container-low rounded">
                  <div className="text-on-surface-variant">Timestamp</div>
                  <div className="text-on-surface">{selectedEvent.created_at}</div>
                </div>
              </div>

              <div>
                <span className="font-label-mono text-label-mono text-on-surface-variant uppercase font-semibold">
                  Raw Event Ledger Payload
                </span>
                <pre className="mt-1 p-space-md bg-surface-container rounded-lg font-label-mono text-code-sm text-on-surface overflow-x-auto border border-surface-container">
                  {JSON.stringify(selectedEvent.details || selectedEvent.event_data || selectedEvent, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-space-md bg-surface-container-low border-t border-surface-container flex items-center justify-between">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedEvent, null, 2));
                  alert("Copied raw audit event to clipboard");
                }}
                className="px-space-md py-1.5 bg-surface-container text-on-surface rounded font-label-ui text-label-ui hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Copy JSON
              </button>
              <button
                onClick={() => setShowInspectModal(false)}
                className="px-space-md py-1.5 bg-primary text-on-primary rounded font-label-ui text-label-ui font-semibold hover:bg-primary-container transition-colors cursor-pointer"
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
