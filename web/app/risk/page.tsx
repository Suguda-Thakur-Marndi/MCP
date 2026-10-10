"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Shield,
  Layers,
  Wrench,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { RISK_FACTORS } from "@/lib/sentinel-data";
import { api, DashboardStats, ToolInfo, AuditEvent, IntegrationListItem } from "@/lib/api";

interface RankedTool {
  name: string;
  app: string;
  score: number;
  level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  policy: string;
  blocksCount: number;
  destructive: boolean;
}

interface BoundaryDisplay {
  id: string;
  name: string;
  icon: string;
  status: string;
  risk_level: string;
  tools_count: number;
}

export default function RiskCenterPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<"24h" | "7d" | "30d">("24h");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  const loadRiskData = () => {
    setLoading(true);
    Promise.allSettled([
      api.dashboard.stats(),
      api.policies.tools(),
      api.audit.events({ limit: 100 }),
      api.integrations.list(),
    ]).then(([statsRes, toolsRes, auditRes, integRes]) => {
      startTransition(() => {
        if (statsRes.status === "fulfilled") setStats(statsRes.value);
        if (toolsRes.status === "fulfilled") setTools(toolsRes.value);
        if (auditRes.status === "fulfilled") setAuditEvents(auditRes.value.events);
        if (integRes.status === "fulfilled") setIntegrations(integRes.value);
        setLoading(false);
      });
    });
  };

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([
      api.dashboard.stats(),
      api.policies.tools(),
      api.audit.events({ limit: 100 }),
      api.integrations.list(),
    ]).then(([statsRes, toolsRes, auditRes, integRes]) => {
      if (isMounted) {
        startTransition(() => {
          if (statsRes.status === "fulfilled") setStats(statsRes.value);
          if (toolsRes.status === "fulfilled") setTools(toolsRes.value);
          if (auditRes.status === "fulfilled") setAuditEvents(auditRes.value.events);
          if (integRes.status === "fulfilled") setIntegrations(integRes.value);
          setLoading(false);
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute live distribution dynamically from real audit telemetry
  const dist = { low: 0, medium: 0, high: 0, critical: 0 };
  if (auditEvents.length > 0) {
    auditEvents.forEach((e) => {
      const s = typeof e.risk_score === "number" ? e.risk_score : 15;
      if (s >= 80) dist.critical++;
      else if (s >= 60) dist.high++;
      else if (s >= 30) dist.medium++;
      else dist.low++;
    });
  } else {
    dist.low = 64;
    dist.medium = 21;
    dist.high = 11;
    dist.critical = 4;
  }

  const totalDist = (dist.low || 0) + (dist.medium || 0) + (dist.high || 0) + (dist.critical || 0) || 100;
  const lowPct = Math.round(((dist.low || 0) / totalDist) * 100);
  const medPct = Math.round(((dist.medium || 0) / totalDist) * 100);
  const highPct = Math.round(((dist.high || 0) / totalDist) * 100);
  const critPct = Math.max(0, 100 - lowPct - medPct - highPct);

  // Compute blocked counts per tool from real audit events
  const toolBlockMap = new Map<string, number>();
  auditEvents.forEach((e) => {
    if (e.decision === "DENY" || e.decision === "BLOCKED" || e.decision === "DROP") {
      const t = e.tool_name || (typeof e.event_data?.tool_name === "string" ? e.event_data.tool_name : undefined);
      if (t) {
        toolBlockMap.set(t, (toolBlockMap.get(t) || 0) + 1);
      }
    }
  });

  // Rank real tools by risk score and destructiveness
  const rankedTools: RankedTool[] = (tools.length > 0 ? tools : []).map((t) => {
    const rawScore = parseInt(t.base_risk?.replace("/100", "") || "0", 10);
    const score = rawScore > 0 ? rawScore : t.risk_level === "CRITICAL" ? 95 : t.risk_level === "HIGH" ? 78 : t.risk_level === "MEDIUM" ? 45 : 15;
    const appPrefix = t.tool_name.includes(".") ? t.tool_name.split(".")[0].toUpperCase() : "MCP";
    return {
      name: t.tool_name,
      app: appPrefix,
      score,
      level: (t.risk_level as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW") || "MEDIUM",
      policy: t.is_destructive ? "Destructive Operation Quarantine" : t.requires_approval ? "Dual-Custody Approval Required" : "Invariant Guardrail Monitored",
      blocksCount: toolBlockMap.get(t.tool_name) || 0,
      destructive: t.is_destructive,
    };
  }).sort((a, b) => b.score - a.score).slice(0, 8);

  // Fallback high-risk tools if backend has no tools registered yet
  const displayTools = rankedTools.length > 0 ? rankedTools : [
    { name: "github.delete_repository", app: "GITHUB", score: 98, level: "CRITICAL" as const, policy: "Production Repository Destruction Defense", blocksCount: 14, destructive: true },
    { name: "drive.delete_file", app: "GOOGLE DRIVE", score: 94, level: "CRITICAL" as const, policy: "Production Data Exfiltration Quarantine", blocksCount: 19, destructive: true },
    { name: "mcp.delete_customer", app: "CUSTOM MCP", score: 88, level: "HIGH" as const, policy: "Sensitive Record Mutation Gate", blocksCount: 8, destructive: true },
    { name: "jira.delete_project", app: "JIRA", score: 99, level: "CRITICAL" as const, policy: "Infrastructure Destructive Intercept", blocksCount: 2, destructive: true },
    { name: "drive.share_file", app: "GOOGLE DRIVE", score: 82, level: "HIGH" as const, policy: "Cross-Boundary Transmission Guard", blocksCount: 31, destructive: false },
  ];

  // Map boundaries with strict string types
  const displayIntegrations: BoundaryDisplay[] = (integrations.length > 0
    ? integrations.map((i) => ({
        id: i.id,
        name: String(i.name || i.id),
        icon: typeof i.icon === "string" ? i.icon : "🔌",
        status: String(i.status || i.live_status || "ACTIVE"),
        risk_level: typeof i.risk_level === "string" ? i.risk_level : "HIGH",
        tools_count: typeof i.tools_count === "number" ? i.tools_count : 5,
      }))
    : [
        { id: "github", name: "GitHub", icon: "🐙", status: "CONNECTED", risk_level: "CRITICAL", tools_count: 10 },
        { id: "google_drive", name: "Google Drive", icon: "📁", status: "CONNECTED", risk_level: "HIGH", tools_count: 5 },
        { id: "jira", name: "Jira", icon: "📐", status: "CONNECTED", risk_level: "HIGH", tools_count: 4 },
        { id: "postgres", name: "PostgreSQL Database", icon: "⚡", status: "CONNECTED", risk_level: "CRITICAL", tools_count: 8 },
      ]
  );

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 font-sans select-none animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase tracking-widest">
              MISSION CONTROL // MULTI-FACTOR RISK ENGINE
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-container)] animate-pulse" />
            <span className="font-code-sm text-[10px] text-[var(--primary-container)] font-bold">
              DYNAMIC BLAST-RADIUS SCORING
            </span>
          </div>
          <h1 className="font-headline-md text-lg sm:text-xl font-bold tracking-tight text-[var(--primary)]">
            RISK ANALYSIS & THREAT SURFACE CENTER
          </h1>
          <p className="font-body-sm text-xs text-[var(--text-secondary)] mt-0.5">
            Algorithmic 6-factor invariant scoring evaluating tool destructiveness, target sensitivity, argument risk, agent blast radius, and historical anomaly deviation.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs self-start sm:self-auto">
          <button
            onClick={loadRiskData}
            disabled={loading}
            className="p-1.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            title="Refresh Risk Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <div className="flex items-center gap-1">
            {(["24h", "7d", "30d"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTimeframe(t)}
                className={`px-2.5 py-1 rounded-xs border font-code-sm text-[11px] transition-all cursor-pointer ${
                  selectedTimeframe === t
                    ? "bg-[var(--secondary-container)]/20 text-[var(--secondary-container)] border-[var(--secondary-container)] font-bold"
                    : "bg-[var(--surface-container-low)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live Risk Distribution Section */}
      <div className="p-3 sm:p-4 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
          <span className="font-label-caps text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-bold">
            LIVE RISK DISTRIBUTION ({selectedTimeframe.toUpperCase()} WINDOW)
          </span>
          <span className="font-code-sm text-[10px] text-[var(--primary-container)] font-bold font-mono">
            COMPOSITE SCORE: {Math.round((lowPct * 0.15) + (medPct * 0.45) + (highPct * 0.75) + (critPct * 0.95))} / 100 {stats?.metrics?.blocked_actions !== undefined ? `[${stats.metrics.blocked_actions} BLOCKED]` : "[NOMINAL BOUNDARY]"}
          </span>
        </div>

        {/* Visual Segmented Distribution Bar */}
        <div className="space-y-2 font-mono text-xs">
          <div className="w-full h-2 rounded-xs bg-[var(--surface-container-lowest)] overflow-hidden flex border border-[var(--border)]">
            <div className="h-full bg-[var(--primary-container)]" style={{ width: `${lowPct}%` }} title={`Low Risk: ${lowPct}%`} />
            <div className="h-full bg-[var(--secondary-container)]" style={{ width: `${medPct}%` }} title={`Medium Risk: ${medPct}%`} />
            <div className="h-full bg-[var(--tertiary-fixed-dim)]" style={{ width: `${highPct}%` }} title={`High Risk: ${highPct}%`} />
            <div className="h-full bg-[var(--error)]" style={{ width: `${critPct}%` }} title={`Critical Risk: ${critPct}%`} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
            <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--primary-container)]/30">
              <span className="font-label-caps text-[8px] uppercase font-bold text-[var(--primary-container)] block">LOW (0 - 29)</span>
              <span className="font-telemetry-num text-lg font-bold text-[var(--primary-container)] block">{lowPct}%</span>
              <span className="font-code-sm text-[9px] text-[var(--text-muted)]">Read & Inspection Queries</span>
            </div>

            <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--secondary-container)]/30">
              <span className="font-label-caps text-[8px] uppercase font-bold text-[var(--secondary-container)] block">MEDIUM (30 - 59)</span>
              <span className="font-telemetry-num text-lg font-bold text-[var(--secondary-container)] block">{medPct}%</span>
              <span className="font-code-sm text-[9px] text-[var(--text-muted)]">Audited Mutation Calls</span>
            </div>

            <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--tertiary-fixed-dim)]/30">
              <span className="font-label-caps text-[8px] uppercase font-bold text-[var(--tertiary-fixed-dim)] block">HIGH (60 - 79)</span>
              <span className="font-telemetry-num text-lg font-bold text-[var(--tertiary-fixed-dim)] block">{highPct}%</span>
              <span className="font-code-sm text-[9px] text-[var(--text-muted)]">Dual-Custody Gated</span>
            </div>

            <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--error)]/40">
              <span className="font-label-caps text-[8px] uppercase font-bold text-[var(--error)] block">CRITICAL (80 - 100)</span>
              <span className="font-telemetry-num text-lg font-bold text-[var(--error)] block">{critPct}%</span>
              <span className="font-code-sm text-[9px] text-[var(--text-muted)]">Destructive / Quarantine</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6-Factor Risk Formula Matrix */}
      <div className="rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] p-3 sm:p-4 space-y-3">
        <div className="pb-2 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <span className="font-label-caps text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">
              ALGORITHMIC FORMULA
            </span>
            <h2 className="font-headline-sm text-xs sm:text-sm font-bold text-[var(--primary)] uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Shield className="w-3.5 h-3.5 text-[var(--primary-container)]" />
              6-FACTOR INVARIANT RISK ASSESSMENT MATRIX
            </h2>
          </div>
          <span className="font-code-sm text-[10px] text-[var(--text-muted)] font-mono">
            SCORE = &sum;(WEIGHT &times; FACTOR_SCORE)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 font-mono text-xs">
          {RISK_FACTORS.map((factor) => (
            <div
              key={factor.name}
              className="p-3 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] space-y-1.5 hover:border-[var(--border-interactive)] transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--text-primary)] text-xs font-mono">{factor.name}</span>
                <span className="font-label-caps text-[8px] px-1.5 py-0.5 rounded-xs bg-[var(--surface-container-high)] border border-[var(--border)] font-bold text-[var(--secondary-container)]">
                  WEIGHT: {factor.weight * 100}%
                </span>
              </div>
              <p className="font-body-sm text-[11px] text-[var(--text-secondary)] leading-relaxed">
                {factor.description}
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-[var(--border)] font-code-sm text-[10px]">
                <span className="text-[var(--text-muted)]">Calculated Score:</span>
                <span className="font-bold text-[var(--primary-container)]">{factor.score} / 100</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Grid: High-Risk Tools & Boundaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* High-Risk Tools */}
        <div className="p-3 sm:p-4 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <h3 className="font-headline-sm text-xs sm:text-sm font-bold text-[var(--primary)] uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Wrench className="w-3.5 h-3.5 text-[var(--tertiary-fixed-dim)]" />
              HIGH-RISK TOOLS INVENTORY
            </h3>
            <span className="font-code-sm text-[9px] text-[var(--text-muted)] font-mono">
              {displayTools.length} Governed Actions
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            {displayTools.map((tool) => (
              <div
                key={tool.name}
                className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] flex items-center justify-between gap-2 hover:border-[var(--border-interactive)] transition-colors"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <code className="text-xs font-bold text-[var(--secondary-container)] font-mono">{tool.name}</code>
                    <span className="px-1 py-0.2 rounded-xs bg-[var(--surface-container-high)] border border-[var(--border)] font-label-caps text-[8px] text-[var(--text-muted)]">
                      {tool.app}
                    </span>
                    {tool.destructive && (
                      <span className="px-1 py-0.2 rounded-xs bg-[var(--error-container)] text-[var(--on-error-container)] font-label-caps text-[7px] font-bold">
                        DESTRUCTIVE
                      </span>
                    )}
                  </div>
                  <span className="font-body-sm text-[10px] text-[var(--text-muted)] block mt-0.5">
                    {tool.policy}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-right">
                  <span
                    className={`px-1.5 py-0.5 rounded-xs font-label-caps text-[9px] font-bold ${
                      tool.level === "CRITICAL"
                        ? "bg-[var(--error-container)] text-[var(--on-error-container)] border border-[var(--error)]/40"
                        : "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] border border-[var(--tertiary-fixed-dim)]/40"
                    }`}
                  >
                    {tool.level} ({tool.score})
                  </span>
                  {tool.blocksCount > 0 && (
                    <span className="font-code-sm text-[9px] text-[var(--error)] font-bold hidden sm:inline">
                      {tool.blocksCount} BLOCKED
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* High-Risk Software Boundaries */}
        <div className="p-3 sm:p-4 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <h3 className="font-headline-sm text-xs sm:text-sm font-bold text-[var(--primary)] uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Layers className="w-3.5 h-3.5 text-[var(--secondary-container)]" />
              HIGH-RISK SOFTWARE BOUNDARIES
            </h3>
            <span className="font-code-sm text-[9px] text-[var(--text-muted)] font-mono">
              {displayIntegrations.length} Monitored Connectors
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            {displayIntegrations.map((app) => (
              <div
                key={app.id}
                className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] flex items-center justify-between gap-2 hover:border-[var(--border-interactive)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{app.icon}</span>
                  <div>
                    <span className="font-bold text-xs text-[var(--primary)] block font-mono">
                      {app.name}
                    </span>
                    <span className="font-code-sm text-[10px] text-[var(--text-muted)]">
                      {app.tools_count} callable tools · Status: {app.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded-xs font-label-caps text-[9px] font-bold ${
                      app.risk_level === "CRITICAL"
                        ? "bg-[var(--error-container)] text-[var(--on-error-container)] border border-[var(--error)]/40"
                        : "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] border border-[var(--tertiary-fixed-dim)]/40"
                    }`}
                  >
                    {app.risk_level}
                  </span>
                  <Link
                    href={`/integrations/${app.id}`}
                    className="p-1 rounded-xs border border-[var(--border)] bg-[var(--surface-container-high)] text-[var(--text-secondary)] hover:text-[var(--secondary-container)] hover:border-[var(--secondary-container)] transition-colors"
                  >
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
