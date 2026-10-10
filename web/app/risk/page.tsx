"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Shield,
  Layers,
  Wrench,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Info,
} from "lucide-react";
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

interface RiskFactorDefinition {
  name: string;
  factorKey: string;
  weightPct: number;
  description: string;
  evalCriteria: string;
  scoreRange: string;
}

const DETERMINISTIC_RISK_FACTORS: RiskFactorDefinition[] = [
  {
    name: "Tool Base Risk Profile",
    factorKey: "tool_base_risk",
    weightPct: 25,
    description: "Inherent vulnerability and privileged capability baseline assigned to the registered MCP tool signature.",
    evalCriteria: "Trusted registry profile & protocol capability level",
    scoreRange: "0 - 30 pts",
  },
  {
    name: "Destructive Operation Factor",
    factorKey: "destructive_factor",
    weightPct: 25,
    description: "Penalty added when invoking irrecoverable mutations (DROP, DELETE, TRUNCATE, file purge, revoke).",
    evalCriteria: "AST syntax inspection & verb classification",
    scoreRange: "+25 to +40 pts",
  },
  {
    name: "Target Data Sensitivity",
    factorKey: "data_sensitivity_factor",
    weightPct: 20,
    description: "Classification penalty based on access to RESTRICTED, CONFIDENTIAL, or PII database schemas and tables.",
    evalCriteria: "Information barrier tags & schema classification",
    scoreRange: "+15 to +30 pts",
  },
  {
    name: "Runtime Environment Boundary",
    factorKey: "environment_factor",
    weightPct: 15,
    description: "Operational blast radius multiplier distinguishing PRODUCTION infrastructure from isolated STAGING or DEV.",
    evalCriteria: "Runtime environment tag & deployment target",
    scoreRange: "+10 to +25 pts",
  },
  {
    name: "Scale & Blast Radius",
    factorKey: "scale_factor",
    weightPct: 10,
    description: "Volume penalty triggered by batch parameters, bulk mutations, or query operations exceeding safe limits.",
    evalCriteria: "Estimated affected rows and argument scope",
    scoreRange: "+10 to +30 pts",
  },
  {
    name: "External Side Effects",
    factorKey: "external_side_effect_factor",
    weightPct: 5,
    description: "Third-party network exfiltration, webhook broadcasts, outbound API transmission, or cloud state alterations.",
    evalCriteria: "Egress detection & multi-software connector traversal",
    scoreRange: "+10 to +25 pts",
  },
];

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
  const totalAuditEvents = auditEvents.length;
  if (totalAuditEvents > 0) {
    auditEvents.forEach((e) => {
      const s = typeof e.risk_score === "number" ? e.risk_score : 15;
      if (s >= 80) dist.critical++;
      else if (s >= 60) dist.high++;
      else if (s >= 30) dist.medium++;
      else dist.low++;
    });
  }

  const totalDist = (dist.low || 0) + (dist.medium || 0) + (dist.high || 0) + (dist.critical || 0);
  const lowPct = totalDist > 0 ? Math.round(((dist.low || 0) / totalDist) * 100) : 0;
  const medPct = totalDist > 0 ? Math.round(((dist.medium || 0) / totalDist) * 100) : 0;
  const highPct = totalDist > 0 ? Math.round(((dist.high || 0) / totalDist) * 100) : 0;
  const critPct = totalDist > 0 ? Math.max(0, 100 - lowPct - medPct - highPct) : 0;

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
  const rankedTools: RankedTool[] = tools.map((t) => {
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

  const displayIntegrations: BoundaryDisplay[] = integrations.map((i) => ({
    id: i.id,
    name: String(i.name || i.id),
    icon: typeof i.icon === "string" ? i.icon : "🔌",
    status: String(i.status || i.live_status || "ACTIVE"),
    risk_level: typeof i.risk_level === "string" ? i.risk_level : "HIGH",
    tools_count: typeof i.tools_count === "number" ? i.tools_count : 0,
  }));

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
            {totalDist > 0
              ? `COMPOSITE SCORE: ${Math.round((lowPct * 0.15) + (medPct * 0.45) + (highPct * 0.75) + (critPct * 0.95))} / 100 [${totalAuditEvents} EVENTS]`
              : "[NO TELEMETRY RECORDED IN WINDOW]"}
          </span>
        </div>

        {/* Visual Segmented Distribution Bar */}
        <div className="space-y-2 font-mono text-xs">
          {totalDist > 0 ? (
            <div className="w-full h-2 rounded-xs bg-[var(--surface-container-lowest)] overflow-hidden flex border border-[var(--border)]">
              <div className="h-full bg-[var(--primary-container)]" style={{ width: `${lowPct}%` }} title={`Low Risk: ${lowPct}%`} />
              <div className="h-full bg-[var(--secondary-container)]" style={{ width: `${medPct}%` }} title={`Medium Risk: ${medPct}%`} />
              <div className="h-full bg-[var(--tertiary-fixed-dim)]" style={{ width: `${highPct}%` }} title={`High Risk: ${highPct}%`} />
              <div className="h-full bg-[var(--error)]" style={{ width: `${critPct}%` }} title={`Critical Risk: ${critPct}%`} />
            </div>
          ) : (
            <div className="w-full h-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] flex items-center justify-center">
              <span className="text-[8px] text-[var(--text-muted)]">No audit events available for distribution breakdown</span>
            </div>
          )}

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
            RAW_SCORE = &sum;(FACTOR_VAL) &rarr; CLAMP(0, 100)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 font-mono text-xs">
          {DETERMINISTIC_RISK_FACTORS.map((factor) => (
            <div
              key={factor.factorKey}
              className="p-3 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] space-y-1.5 hover:border-[var(--border-interactive)] transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--text-primary)] text-xs font-mono">{factor.name}</span>
                <span className="font-label-caps text-[8px] px-1.5 py-0.5 rounded-xs bg-[var(--surface-container-high)] border border-[var(--border)] font-bold text-[var(--secondary-container)]">
                  WEIGHT: {factor.weightPct}%
                </span>
              </div>
              <p className="font-body-sm text-[11px] text-[var(--text-secondary)] leading-relaxed">
                {factor.description}
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-[var(--border)] font-code-sm text-[10px]">
                <span className="text-[var(--text-muted)]">Factor Key:</span>
                <code className="text-[var(--secondary-container)] font-mono">{factor.factorKey}</code>
              </div>
              <div className="flex items-center justify-between font-code-sm text-[10px]">
                <span className="text-[var(--text-muted)]">Contribution:</span>
                <span className="font-bold text-[var(--primary-container)]">{factor.scoreRange}</span>
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
              {rankedTools.length} Governed Actions
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-[var(--text-muted)] text-xs font-mono">
              Loading tool risk inventory...
            </div>
          ) : rankedTools.length === 0 ? (
            <div className="py-8 px-4 text-center border border-dashed border-[var(--border)] rounded-xs bg-[var(--surface-container-lowest)] space-y-2">
              <Info className="w-5 h-5 mx-auto text-[var(--text-muted)]" />
              <p className="text-xs text-[var(--text-secondary)] font-mono">
                No MCP tools currently registered in the security registry.
              </p>
              <Link
                href="/tools"
                className="inline-block px-3 py-1 rounded-xs border border-[var(--secondary-container)] text-[var(--secondary-container)] text-xs font-mono hover:bg-[var(--secondary-container)]/10"
              >
                Inspect Tool Catalog &rarr;
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5 font-mono text-xs">
              {rankedTools.map((tool) => (
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
          )}
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

          {loading ? (
            <div className="py-8 text-center text-[var(--text-muted)] text-xs font-mono">
              Loading boundary integrations...
            </div>
          ) : displayIntegrations.length === 0 ? (
            <div className="py-8 px-4 text-center border border-dashed border-[var(--border)] rounded-xs bg-[var(--surface-container-lowest)] space-y-2">
              <AlertTriangle className="w-5 h-5 mx-auto text-[var(--text-muted)]" />
              <p className="text-xs text-[var(--text-secondary)] font-mono">
                No external software boundaries configured.
              </p>
              <Link
                href="/integrations"
                className="inline-block px-3 py-1 rounded-xs border border-[var(--secondary-container)] text-[var(--secondary-container)] text-xs font-mono hover:bg-[var(--secondary-container)]/10"
              >
                Configure Integrations &rarr;
              </Link>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
