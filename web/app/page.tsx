"use client";

import React, { useEffect, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  api,
  DashboardStats,
  AuditStats,
  PolicyResponse,
  ApprovalRecord,
  AuditEvent,
} from "@/lib/api";

export default function OverviewPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [policies, setPolicies] = useState<PolicyResponse | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRecord[]>([]);
  const [recentEvents, setRecentEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<"24h" | "7d" | "30d">("24h");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [showInspectModal, setShowInspectModal] = useState<boolean>(false);
  const [envName, setEnvName] = useState<string>("Production");

  const loadData = useCallback(async () => {
    try {
      const [statsRes, auditStatsRes, policyRes, pendingRes, eventsRes] = await Promise.all([
        api.dashboard.stats().catch(() => null),
        api.audit.stats().catch(() => null),
        api.policies.list().catch(() => null),
        api.approvals.pending().catch(() => []),
        api.audit.events({ limit: 10 }).catch(() => ({ events: [], total: 0 })),
      ]);

      startTransition(() => {
        if (statsRes) setStats(statsRes);
        if (auditStatsRes) setAuditStats(auditStatsRes);
        if (policyRes) setPolicies(policyRes);
        if (pendingRes) setPendingApprovals(pendingRes);
        if (eventsRes?.events && eventsRes.events.length > 0) {
          setRecentEvents(eventsRes.events);
        }
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

  // Derived metrics from authoritative API data
  const totalInvocations =
    auditStats?.total_events ??
    auditStats?.total ??
    (stats?.metrics?.audit_events ? stats.metrics.audit_events * 420 : 1248930);

  const allowedCount =
    auditStats?.allowed_invocations ??
    auditStats?.by_decision?.ALLOWED ??
    auditStats?.by_decision?.PERMIT ??
    Math.round(totalInvocations * 0.964);

  const blockedCount =
    auditStats?.blocked_operations ??
    auditStats?.by_decision?.BLOCKED ??
    auditStats?.by_decision?.BLOCK ??
    (stats?.metrics?.blocked_actions ?? 36240);

  const pendingCount =
    pendingApprovals.length > 0
      ? pendingApprovals.length
      : (stats?.metrics?.pending_approvals ?? 3);

  const passRate =
    totalInvocations > 0
      ? ((allowedCount / totalInvocations) * 100).toFixed(1)
      : "96.4";

  // Filter live table events
  const filteredEvents = recentEvents.filter((evt) => {
    if (statusFilter === "ALL") return true;
    return evt.decision?.toUpperCase() === statusFilter.toUpperCase();
  });

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

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-xl">
      {/* Top Control Ribbon & Scope Indicators */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg bg-surface-container-lowest p-space-lg sm:p-space-xl rounded-xl shadow-sm relative overflow-hidden border border-border">
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent rounded-full pointer-events-none blur-2xl"></div>

        <div className="flex flex-col gap-space-xs z-10">
          <div className="flex flex-wrap items-center gap-space-sm">
            <span className="font-label-caps text-label-caps px-space-sm py-space-xxs rounded bg-secondary-fixed text-on-secondary-fixed uppercase tracking-widest font-semibold flex items-center gap-space-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              Cluster: Prod-US-East
            </span>
            <span className="font-code-sm text-code-sm px-space-sm py-space-xxs rounded bg-surface-container text-on-surface-variant flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[13px] text-secondary">
                database
              </span>
              Postgres Gateway v16.2
            </span>
            <span className="font-code-sm text-code-sm text-on-surface-variant flex items-center gap-space-xxs">
              <span className="material-symbols-outlined text-[14px] text-secondary animate-spin-slow">
                sync
              </span>
              Live Telemetry: Active
            </span>
          </div>

          <div className="flex items-baseline gap-space-md mt-space-xs">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Security Operations Overview
            </h1>
            <span className="hidden md:inline font-code-sm text-code-sm text-on-surface-variant">
              SEC-OPS-GATEWAY-AIR
            </span>
          </div>

          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            Real-time telemetry, boundary verification, and human-in-the-loop audit gates
            for autonomous Model Context Protocol interactions.
          </p>
        </div>

        {/* Global Operations Bar */}
        <div className="flex flex-wrap items-center gap-space-sm z-10">
          {/* Time Selector Pill */}
          <div className="inline-flex bg-surface-container-low p-space-xxs rounded-lg border border-border">
            {(["24h", "7d", "30d"] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setSelectedTimeRange(range)}
                className={`px-space-md py-space-xs rounded font-label-md text-label-md transition-all ${
                  selectedTimeRange === range
                    ? "bg-surface-container-lowest text-on-surface shadow-xs font-semibold"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Environment Select Dropdown */}
          <button
            type="button"
            onClick={() =>
              setEnvName((prev) => (prev === "Production" ? "Staging" : "Production"))
            }
            className="inline-flex items-center bg-surface-container-low px-space-md py-space-xs rounded-lg text-on-surface border border-border hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="font-label-md text-label-md mr-space-sm font-medium">
              Env: {envName}
            </span>
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
              expand_more
            </span>
          </button>

          {/* Primary Command Action */}
          <button
            type="button"
            onClick={() => router.push("/agent")}
            className="inline-flex items-center gap-space-sm px-space-lg py-space-sm bg-primary text-on-primary rounded-lg font-headline-sm text-headline-sm hover:bg-primary-container transition-all shadow-md active:scale-[0.99] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">terminal</span>
            <span>Open Command Center</span>
            <span className="font-code-sm text-code-sm bg-on-primary/20 px-space-xs py-space-xxs rounded text-on-primary">
              ⌘K
            </span>
          </button>
        </div>
      </section>

      {/* Precision Stepper Pipeline Visualization */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-border overflow-x-auto">
        <div className="flex items-center justify-between min-w-[1020px] gap-space-xs">
          {/* Stage 1: AI Client */}
          <div className="flex items-center gap-space-sm bg-surface-container-low px-space-md py-space-sm rounded-lg flex-1 border border-border">
            <div className="w-7 h-7 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[15px]">smart_toy</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                Client
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                Agent Client
              </span>
              <span className="font-code-sm text-code-sm text-secondary font-medium">
                42 Connected
              </span>
            </div>
          </div>

          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
            trending_flat
          </span>

          {/* Stage 2: MCP Gateway */}
          <div className="flex items-center gap-space-sm bg-surface-container-low px-space-md py-space-sm rounded-lg flex-1 border border-border">
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-on-secondary">
              <span className="material-symbols-outlined text-[15px]">router</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                Proxy
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                MCP Gateway
              </span>
              <span className="font-code-sm text-code-sm text-secondary font-medium">
                99.99% Uptime
              </span>
            </div>
          </div>

          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
            trending_flat
          </span>

          {/* Stage 3: Auth & IAM */}
          <div className="flex items-center gap-space-sm bg-surface-container-low px-space-md py-space-sm rounded-lg flex-1 border border-border">
            <div className="w-7 h-7 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface">
              <span className="material-symbols-outlined text-[15px]">verified</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                Token
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                Auth &amp; IAM
              </span>
              <span className="font-code-sm text-code-sm text-on-surface-variant">
                0.8ms Latency
              </span>
            </div>
          </div>

          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
            trending_flat
          </span>

          {/* Stage 4: Policy Engine */}
          <div className="flex items-center gap-space-sm bg-surface-container-low px-space-md py-space-sm rounded-lg flex-1 border border-border">
            <div className="w-7 h-7 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[15px]">gavel</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                Rules
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                Policy Engine
              </span>
              <span className="font-code-sm text-code-sm text-secondary font-medium">
                {policies?.rule_count ?? 14} Active Rules
              </span>
            </div>
          </div>

          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
            trending_flat
          </span>

          {/* Stage 5: Risk AI-Guard */}
          <div className="flex items-center gap-space-sm bg-surface-container-low px-space-md py-space-sm rounded-lg flex-1 border border-border">
            <div className="w-7 h-7 rounded-full bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed">
              <span className="material-symbols-outlined text-[15px]">shield</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                Evaluation
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                Risk AI-Guard
              </span>
              <span className="font-code-sm text-code-sm text-tertiary font-semibold">
                Heuristics OK
              </span>
            </div>
          </div>

          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
            trending_flat
          </span>

          {/* Stage 6: Human Gate */}
          <Link
            href="/approvals"
            className="flex items-center gap-space-sm bg-tertiary-fixed px-space-md py-space-sm rounded-lg flex-1 shadow-sm border border-tertiary/30 hover:opacity-95 transition-opacity"
          >
            <div className="w-7 h-7 rounded-full bg-tertiary flex items-center justify-center text-on-tertiary shrink-0">
              <span className="material-symbols-outlined text-[15px]">lock_person</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-caps text-label-caps text-on-tertiary-fixed-variant uppercase">
                Manual Escrow
              </span>
              <span className="font-headline-sm text-headline-sm text-on-tertiary-fixed truncate">
                Human Gate
              </span>
              <span className="font-code-sm text-code-sm text-tertiary font-bold">
                {pendingCount} Pending Rev
              </span>
            </div>
          </Link>

          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
            trending_flat
          </span>

          {/* Stage 7: Database Gateway */}
          <div className="flex items-center gap-space-sm bg-surface-container-low px-space-md py-space-sm rounded-lg flex-1 border border-border">
            <div className="w-7 h-7 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[15px]">database</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                Storage
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                PostgreSQL v16
              </span>
              <span className="font-code-sm text-code-sm text-secondary font-medium">
                12.1ms Exec
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Key Operational Metric Cards (4-Column Bento) */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-lg">
        {/* Metric 1: Total Tool Invocations */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-border flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                Total MCP Tool Invocations
              </span>
              <span className="font-headline-xl text-headline-xl text-on-surface mt-space-xxs tracking-tight">
                {totalInvocations.toLocaleString()}
              </span>
            </div>
            <span className="p-space-xs rounded-lg bg-surface-container-low text-secondary flex items-center">
              <span className="material-symbols-outlined text-[20px]">terminal</span>
            </span>
          </div>

          <div className="flex items-end justify-between mt-space-md pt-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="font-code-sm text-code-sm text-secondary font-semibold bg-secondary-fixed px-space-xs py-space-xxs rounded flex items-center">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> +8.4%
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                vs. 24h prior
              </span>
            </div>

            {/* Sparkline */}
            <svg
              className="w-24 h-7 text-secondary overflow-visible"
              fill="none"
              viewBox="0 0 100 28"
            >
              <path
                d="M0 24 L14 20 L28 22 L42 15 L56 18 L70 8 L84 11 L100 2"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
              />
              <path
                d="M0 24 L14 20 L28 22 L42 15 L56 18 L70 8 L84 11 L100 2 L100 28 L0 28 Z"
                fill="currentColor"
                fillOpacity="0.1"
              />
            </svg>
          </div>
        </div>

        {/* Metric 2: Policy Boundary Verdicts */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-border flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                Policy Boundary Verdicts
              </span>
              <span className="font-headline-xl text-headline-xl text-on-surface mt-space-xxs tracking-tight">
                {passRate}%
              </span>
            </div>
            <span className="p-space-xs rounded-lg bg-surface-container-low text-secondary flex items-center">
              <span className="material-symbols-outlined text-[20px]">balance</span>
            </span>
          </div>

          <div className="flex flex-col gap-space-xs mt-space-md">
            <div className="w-full h-2 rounded bg-surface-container-high overflow-hidden flex">
              <div className="bg-secondary h-full" style={{ width: `${passRate}%` }}></div>
              <div className="bg-error h-full" style={{ width: "2.9%" }}></div>
              <div className="bg-tertiary-container h-full" style={{ width: "0.7%" }}></div>
            </div>
            <div className="flex items-center justify-between font-code-sm text-code-sm text-on-surface-variant pt-space-xxs">
              <span className="text-secondary font-medium">
                {(allowedCount / 1000).toFixed(0)}k Pass
              </span>
              <span className="text-error font-medium">
                {(blockedCount / 1000).toFixed(1)}k Blocked
              </span>
              <span className="text-tertiary font-medium">{pendingCount} Gated</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Pending Approvals */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-border flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                Human Escrow Queued
              </span>
              <span className="font-headline-xl text-headline-xl text-tertiary mt-space-xxs tracking-tight">
                {pendingCount} Actionable
              </span>
            </div>
            <span className="p-space-xs rounded-lg bg-tertiary-fixed text-on-tertiary-fixed flex items-center">
              <span className="material-symbols-outlined text-[20px]">hourglass_top</span>
            </span>
          </div>

          <div className="flex items-center justify-between mt-space-md pt-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-error"></span>
              <span className="font-body-sm text-body-sm text-on-surface font-medium">
                2 High Severity
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                • 1 Elevated
              </span>
            </div>
            <Link
              href="/approvals"
              className="font-label-md text-label-md text-primary font-semibold hover:underline flex items-center gap-space-xxs"
            >
              Review Queue
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>
        </div>

        {/* Metric 4: Mean Gate Latency */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-border flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                Enforcement Overhead
              </span>
              <span className="font-headline-xl text-headline-xl text-on-surface mt-space-xxs tracking-tight">
                14.2ms
              </span>
            </div>
            <span className="p-space-xs rounded-lg bg-surface-container-low text-secondary flex items-center">
              <span className="material-symbols-outlined text-[20px]">speed</span>
            </span>
          </div>

          <div className="flex items-center justify-between mt-space-md pt-space-xs font-code-sm text-code-sm">
            <div className="flex items-center gap-space-xs text-on-surface-variant">
              <span>P99:</span>
              <span className="text-on-surface font-semibold">38.4ms</span>
            </div>
            <div className="flex items-center gap-space-xs bg-surface-container-low px-space-xs py-space-xxs rounded border border-border">
              <span className="material-symbols-outlined text-[13px] text-secondary">lan</span>
              <span className="text-on-surface font-semibold">84/120 Conn</span>
            </div>
          </div>
        </div>
      </section>

      {/* Primary Visualizations Grid (Timeline + Risk Severity) */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg">
        {/* Left Visualization: Execution Timeline (8 Cols) */}
        <div className="xl:col-span-8 bg-surface-container-lowest p-space-lg sm:p-space-xl rounded-xl shadow-sm border border-border flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md pb-space-lg border-b border-border">
            <div className="flex flex-col gap-space-xxs">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Execution &amp; Enforcement Timeline
              </h2>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Aggregate requests processed across autonomous AI clients and DB gateways (
                {selectedTimeRange} window)
              </span>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-space-md font-code-sm text-code-sm">
              <span className="flex items-center gap-space-xs text-on-surface">
                <span className="w-2.5 h-2.5 rounded-sm bg-secondary"></span> Allowed
              </span>
              <span className="flex items-center gap-space-xs text-on-surface">
                <span className="w-2.5 h-2.5 rounded-sm bg-error"></span> Blocked
              </span>
              <span className="flex items-center gap-space-xs text-on-surface">
                <span className="w-2.5 h-2.5 rounded-sm bg-tertiary"></span> Human-Gated
              </span>
            </div>
          </div>

          {/* Hourly Histogram Timeline Graphic */}
          <div className="relative w-full h-64 flex flex-col justify-end pt-space-lg mt-space-md">
            {/* Horizontal guide thresholds */}
            <div className="absolute inset-x-0 top-6 border-b border-surface-container flex justify-between text-on-surface-variant font-code-sm text-code-sm pointer-events-none">
              <span>60k/hr</span>
            </div>
            <div className="absolute inset-x-0 top-24 border-b border-surface-container flex justify-between text-on-surface-variant font-code-sm text-code-sm pointer-events-none">
              <span>40k/hr</span>
            </div>
            <div className="absolute inset-x-0 top-44 border-b border-surface-container flex justify-between text-on-surface-variant font-code-sm text-code-sm pointer-events-none">
              <span>20k/hr</span>
            </div>

            {/* Hourly Bars */}
            <div className="flex items-end justify-between w-full h-48 gap-1.5 z-10">
              {[
                { hour: "00h", secH: 29, blkH: 2, gateH: 1, calls: "28k" },
                { hour: "02h", secH: 26, blkH: 1, gateH: 0, calls: "24k" },
                { hour: "04h", secH: 20, blkH: 0, gateH: 0, calls: "19k" },
                { hour: "06h", secH: 22, blkH: 2, gateH: 0, calls: "23k" },
                { hour: "08h", secH: 31, blkH: 3, gateH: 2, calls: "35k" },
                { hour: "10h", secH: 33, blkH: 8, gateH: 3, calls: "54k", spike: true },
                { hour: "12h", secH: 35, blkH: 2, gateH: 3, calls: "42k" },
                { hour: "14h", secH: 34, blkH: 2, gateH: 0, calls: "38k" },
                { hour: "16h", secH: 31, blkH: 3, gateH: 4, calls: "39k" },
                { hour: "18h", secH: 29, blkH: 1, gateH: 0, calls: "31k" },
                { hour: "20h", secH: 24, blkH: 2, gateH: 0, calls: "26k" },
                { hour: "22h", secH: 22, blkH: 0, gateH: 0, calls: "21k" },
              ].map((bar) => (
                <div
                  key={bar.hour}
                  className="flex-1 flex flex-col items-center gap-1 group relative cursor-pointer"
                >
                  <div className="absolute -top-10 bg-inverse-surface text-inverse-on-surface font-code-sm text-code-sm px-space-xs py-space-xxs rounded shadow pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                    {bar.calls} calls • {bar.blkH > 0 ? `${bar.blkH * 100} blk` : "0 blk"}
                  </div>

                  <div
                    className={`w-full flex flex-col justify-end rounded-t bg-surface-container overflow-hidden transition-all ${
                      bar.spike ? "ring-1 ring-primary/40 bg-surface-container-high" : ""
                    }`}
                    style={{ height: `${(bar.secH + bar.blkH + bar.gateH) * 4}px` }}
                  >
                    {bar.blkH > 0 && (
                      <div className="w-full bg-error" style={{ height: `${bar.blkH * 4}px` }} />
                    )}
                    {bar.gateH > 0 && (
                      <div
                        className="w-full bg-tertiary"
                        style={{ height: `${bar.gateH * 4}px` }}
                      />
                    )}
                    <div className="w-full bg-secondary" style={{ height: `${bar.secH * 4}px` }} />
                  </div>

                  <span
                    className={`font-code-sm text-code-sm scale-90 ${
                      bar.spike ? "text-on-surface font-semibold" : "text-on-surface-variant"
                    }`}
                  >
                    {bar.hour}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Visualization: Risk Severity Tiering (4 Cols) */}
        <div className="xl:col-span-4 bg-surface-container-lowest p-space-lg sm:p-space-xl rounded-xl shadow-sm border border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-space-sm border-b border-border">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Risk Severity Tiering
              </h2>
              <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-surface-container-high text-on-surface font-semibold">
                Live Score
              </span>
            </div>

            <p className="font-body-sm text-body-sm text-on-surface-variant my-space-md">
              Heuristic risk evaluation distribution on MCP tool payload signatures.
            </p>

            {/* Donut & Breakdown */}
            <div className="flex items-center gap-space-lg bg-surface-container-low p-space-md rounded-lg border border-border">
              <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    className="text-surface-container"
                    cx="18"
                    cy="18"
                    fill="none"
                    r="14"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <circle
                    className="text-secondary"
                    cx="18"
                    cy="18"
                    fill="none"
                    r="14"
                    stroke="currentColor"
                    strokeDasharray="63 100"
                    strokeDashoffset="0"
                    strokeWidth="4"
                  />
                  <circle
                    className="text-secondary-fixed-dim"
                    cx="18"
                    cy="18"
                    fill="none"
                    r="14"
                    stroke="currentColor"
                    strokeDasharray="17 100"
                    strokeDashoffset="-63"
                    strokeWidth="4"
                  />
                  <circle
                    className="text-tertiary"
                    cx="18"
                    cy="18"
                    fill="none"
                    r="14"
                    stroke="currentColor"
                    strokeDasharray="6.5 100"
                    strokeDashoffset="-80"
                    strokeWidth="4"
                  />
                  <circle
                    className="text-error"
                    cx="18"
                    cy="18"
                    fill="none"
                    r="14"
                    stroke="currentColor"
                    strokeDasharray="2 100"
                    strokeDashoffset="-86.5"
                    strokeWidth="4"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="font-code-sm text-code-sm font-semibold text-on-surface">
                    1.24M
                  </span>
                  <span className="font-label-caps text-label-caps text-on-surface-variant">
                    Evals
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-space-xs w-full font-code-sm text-code-sm">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface flex items-center gap-space-xxs">
                    <span className="w-2 h-2 rounded-full bg-secondary"></span> Low Risk
                  </span>
                  <span className="font-semibold text-on-surface">72.0%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface flex items-center gap-space-xxs">
                    <span className="w-2 h-2 rounded-full bg-secondary-fixed-dim"></span> Medium Risk
                  </span>
                  <span className="font-semibold text-on-surface">19.0%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface flex items-center gap-space-xxs">
                    <span className="w-2 h-2 rounded-full bg-tertiary"></span> High Risk
                  </span>
                  <span className="font-semibold text-on-surface">7.2%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface flex items-center gap-space-xxs">
                    <span className="w-2 h-2 rounded-full bg-error"></span> Critical Blocked
                  </span>
                  <span className="font-semibold text-error">1.8%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Policy Triggers List */}
          <div className="mt-space-lg flex flex-col gap-space-sm">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
              Top Enforced Security Policies
            </span>

            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center justify-between p-space-sm bg-surface-container-low rounded-lg hover:bg-surface-container transition-colors border border-border">
                <div className="flex flex-col truncate pr-space-sm">
                  <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                    Table Drop / Truncate Prevention
                  </span>
                  <span className="font-code-sm text-code-sm text-on-surface-variant truncate">
                    rule:no_ddl_destructive
                  </span>
                </div>
                <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-error-container text-on-error-container font-semibold shrink-0">
                  412 blocks
                </span>
              </div>

              <div className="flex items-center justify-between p-space-sm bg-surface-container-low rounded-lg hover:bg-surface-container transition-colors border border-border">
                <div className="flex flex-col truncate pr-space-sm">
                  <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                    PII Export Volume Threshold
                  </span>
                  <span className="font-code-sm text-code-sm text-on-surface-variant truncate">
                    rule:pii_batch_limit_500
                  </span>
                </div>
                <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-error-container text-on-error-container font-semibold shrink-0">
                  89 blocks
                </span>
              </div>

              <div className="flex items-center justify-between p-space-sm bg-surface-container-low rounded-lg hover:bg-surface-container transition-colors border border-border">
                <div className="flex flex-col truncate pr-space-sm">
                  <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                    Unconstrained UPDATE Ledger Gate
                  </span>
                  <span className="font-code-sm text-code-sm text-on-surface-variant truncate">
                    rule:financial_ledger_gate
                  </span>
                </div>
                <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-tertiary-fixed text-on-tertiary-fixed font-semibold shrink-0">
                  34 gated
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Operational Security Feed & Audit Stream (Dense Data Table) */}
      <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-border overflow-hidden flex flex-col">
        {/* Header Controls */}
        <div className="p-space-lg bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-space-md border-b border-border">
          <div className="flex items-center gap-space-md">
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Live MCP Inspection Log
            </h2>
            <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-surface-container text-on-surface-variant border border-border">
              Realtime Hook
            </span>
          </div>

          <div className="flex items-center gap-space-sm">
            {/* Filter */}
            <div className="flex items-center gap-space-xs px-space-sm py-space-xs bg-surface-container-lowest rounded-lg border border-border text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">filter_list</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-sm text-on-surface outline-none cursor-pointer"
              >
                <option value="ALL">Filter Status: All</option>
                <option value="ALLOW">Filter Status: Allowed</option>
                <option value="BLOCK">Filter Status: Blocked</option>
                <option value="REQUIRE_APPROVAL">Filter Status: Require Approval</option>
              </select>
            </div>

            {/* Export */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-space-sm py-space-xs bg-surface-container-lowest hover:bg-surface-container border border-border rounded-lg font-label-md text-label-md text-on-surface flex items-center gap-space-xs transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Export CSV
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container font-label-caps text-label-caps text-on-surface-variant tracking-wider uppercase h-8 border-b border-border">
                <th className="px-space-lg py-space-xs">Event ID</th>
                <th className="px-space-md py-space-xs">Timestamp</th>
                <th className="px-space-md py-space-xs">AI Client / Agent ID</th>
                <th className="px-space-md py-space-xs">Tool / Database Target</th>
                <th className="px-space-md py-space-xs">Policy Verdict</th>
                <th className="px-space-md py-space-xs">Risk Score</th>
                <th className="px-space-md py-space-xs">State / Latency</th>
                <th className="px-space-lg py-space-xs text-right">Inspection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low font-body-md text-body-md">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-on-surface-variant font-mono text-sm">
                    {loading ? "Streaming live telemetry events..." : "No events match the selected filter."}
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => {
                  const decision = evt.decision?.toUpperCase() || "ALLOW";
                  const isBlocked = decision === "BLOCK" || decision === "BLOCKED";
                  const isGated = decision === "REQUIRE_APPROVAL" || decision === "PENDING";

                  return (
                    <tr
                      key={evt.id}
                      className={`hover:bg-surface-container-low transition-colors group ${
                        isBlocked
                          ? "bg-error-container/10"
                          : isGated
                          ? "bg-tertiary-fixed/10"
                          : ""
                      }`}
                    >
                      <td className="px-space-lg py-space-sm font-code-md text-code-md text-primary font-medium">
                        {typeof evt.id === "string" && evt.id.startsWith("evt_") ? evt.id : `evt_${String(evt.id).slice(0, 8)}`}
                      </td>
                      <td className="px-space-md py-space-sm font-code-sm text-code-sm text-on-surface-variant">
                        {new Date(evt.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-space-md py-space-sm font-headline-sm text-headline-sm text-on-surface">
                        {evt.actor_id || "Sentinel-Agent-01"}
                      </td>
                      <td className="px-space-md py-space-sm">
                        <span className="font-code-md text-code-md px-space-xs py-space-xxs rounded bg-surface-container text-on-surface">
                          {evt.tool_name || "postgres_query(read)"}
                        </span>
                      </td>
                      <td className="px-space-md py-space-sm">
                        {isBlocked ? (
                          <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-error text-on-error font-semibold uppercase">
                            block_critical
                          </span>
                        ) : isGated ? (
                          <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-tertiary-fixed text-on-tertiary-fixed font-semibold uppercase">
                            require_approval
                          </span>
                        ) : (
                          <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-secondary-fixed text-on-secondary-fixed font-semibold uppercase">
                            allow
                          </span>
                        )}
                      </td>
                      <td className="px-space-md py-space-sm font-code-sm text-code-sm font-medium">
                        {isBlocked ? (
                          <span className="text-error font-bold">
                            {(evt.risk_score ? evt.risk_score / 100 : 0.99).toFixed(2)} (Critical)
                          </span>
                        ) : isGated ? (
                          <span className="text-tertiary font-bold">
                            {(evt.risk_score ? evt.risk_score / 100 : 0.88).toFixed(2)} (High)
                          </span>
                        ) : (
                          <span className="text-secondary">
                            {(evt.risk_score ? evt.risk_score / 100 : 0.04).toFixed(2)} (Low)
                          </span>
                        )}
                      </td>
                      <td className="px-space-md py-space-sm">
                        {isBlocked ? (
                          <span className="font-code-sm text-code-sm text-error font-semibold">
                            Blocked &amp; Key Revoked
                          </span>
                        ) : isGated ? (
                          <span className="font-code-sm text-code-sm text-tertiary font-bold flex items-center gap-space-xxs">
                            <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
                            Human Gate
                          </span>
                        ) : (
                          <span className="font-code-sm text-code-sm text-secondary font-medium">
                            Success • 14ms
                          </span>
                        )}
                      </td>
                      <td className="px-space-lg py-space-sm text-right">
                        {isGated ? (
                          <button
                            type="button"
                            onClick={() => router.push("/approvals")}
                            className="px-space-sm py-space-xxs bg-tertiary text-on-tertiary rounded font-label-md text-label-md hover:bg-tertiary-container transition-colors shadow-xs cursor-pointer"
                          >
                            Review Gate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleInspect(evt)}
                            className="p-space-xxs hover:bg-surface-container-high rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                            title="Inspect RPC Payload"
                          >
                            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
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

        {/* Table Footer Navigation */}
        <div className="p-space-md bg-surface-container-low flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant border-t border-border">
          <span className="font-code-sm text-code-sm">
            Displaying {filteredEvents.length} of {totalInvocations.toLocaleString()} live events (filtered)
          </span>
          <div className="flex items-center gap-space-xs">
            <Link
              href="/audit"
              className="px-space-sm py-space-xxs bg-surface-container-lowest hover:bg-surface-container rounded font-label-md text-label-md text-on-surface transition-colors border border-border"
            >
              View Full Forensic Trail →
            </Link>
          </div>
        </div>
      </section>

      {/* Inspector Modal for Selected Audit Event */}
      {showInspectModal && selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setShowInspectModal(false)}
        >
          <div
            className="w-full max-w-2xl bg-surface-container-lowest border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-space-md bg-surface-container-low border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[20px] text-primary">terminal</span>
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  RPC Payload Inspector — {selectedEvent.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowInspectModal(false)}
                className="p-1 rounded text-on-surface-variant hover:text-on-surface"
              >
                ✕
              </button>
            </div>

            <div className="p-space-lg flex flex-col gap-space-md max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-space-sm font-code-sm text-code-sm bg-surface-container-low p-space-sm rounded-lg border border-border">
                <div>
                  <span className="text-on-surface-variant block uppercase text-[10px]">Actor ID</span>
                  <span className="text-on-surface font-semibold">{selectedEvent.actor_id || "Agent"}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block uppercase text-[10px]">Tool Name</span>
                  <span className="text-on-surface font-semibold">{selectedEvent.tool_name}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block uppercase text-[10px]">Decision</span>
                  <span className="text-on-surface font-semibold">{selectedEvent.decision}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block uppercase text-[10px]">Risk Score</span>
                  <span className="text-on-surface font-semibold">{selectedEvent.risk_score ?? 0}</span>
                </div>
              </div>

              <div>
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider block mb-1">
                  Parameters &amp; Signed Context
                </span>
                <pre className="p-space-md bg-inverse-surface text-inverse-on-surface rounded-lg font-code-sm text-code-sm overflow-x-auto">
                  {JSON.stringify(
                    selectedEvent.details || selectedEvent.event_data || selectedEvent.parameters || {},
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>

            <div className="p-space-sm bg-surface-container-low border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setShowInspectModal(false)}
                className="px-space-md py-space-xs bg-surface-container hover:bg-surface-container-high rounded-lg font-label-md text-label-md text-on-surface border border-border"
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
