"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Shield,
  Activity,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Layers,
  Wrench,
  Lock,
  ArrowRight,
  CheckCircle2,
  Sliders,
} from "lucide-react";
import { RISK_FACTORS, INTEGRATIONS } from "@/lib/sentinel-data";

export default function RiskCenterPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<"24h" | "7d" | "30d">("24h");

  const highRiskTools = [
    { name: "github.delete_repository", app: "GitHub", score: 98, level: "CRITICAL", policy: "Production Repository Destruction Defense", blocksCount: 14 },
    { name: "drive.delete_file", app: "Google Drive", score: 94, level: "CRITICAL", policy: "Production Data Exfiltration Quarantine", blocksCount: 19 },
    { name: "mcp.delete_customer", app: "Custom MCP", score: 88, level: "HIGH", policy: "Sensitive Record Mutation Gate", blocksCount: 8 },
    { name: "jira.delete_project", app: "Jira", score: 99, level: "CRITICAL", policy: "Infrastructure Destructive Intercept", blocksCount: 2 },
    { name: "drive.share_file", app: "Google Drive", score: 82, level: "HIGH", policy: "Cross-Boundary Transmission Guard", blocksCount: 31 },
  ];

  const highRiskIntegrations = [
    { name: "GitHub", id: "github", icon: "🐙", risk: "CRITICAL", baseScore: 92, blockedRate: "28%", activeTools: 5 },
    { name: "Google Drive", id: "google-drive", icon: "📁", risk: "HIGH", baseScore: 78, blockedRate: "19%", activeTools: 5 },
    { name: "Jira", id: "jira", icon: "📐", risk: "HIGH", baseScore: 74, blockedRate: "12%", activeTools: 4 },
    { name: "Custom MCP Gateway", id: "custom-mcp", icon: "⚡", risk: "HIGH", baseScore: 70, blockedRate: "15%", activeTools: 8 },
  ];

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

        <div className="flex items-center gap-1 font-mono text-xs self-start sm:self-auto">
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

      {/* Live Risk Distribution Section */}
      <div className="p-3 sm:p-4 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
          <span className="font-label-caps text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-bold">
            LIVE RISK DISTRIBUTION ({selectedTimeframe.toUpperCase()} WINDOW)
          </span>
          <span className="font-code-sm text-[10px] text-[var(--primary-container)] font-bold font-mono">
            COMPOSITE MEAN: 24.2 / 100 [NOMINAL PASS]
          </span>
        </div>

        {/* Visual Segmented Distribution Bar */}
        <div className="space-y-2 font-mono text-xs">
          <div className="w-full h-2 rounded-xs bg-[var(--surface-container-lowest)] overflow-hidden flex border border-[var(--border)]">
            <div className="h-full bg-[var(--primary-container)]" style={{ width: "64%" }} title="Low Risk: 64%" />
            <div className="h-full bg-[var(--secondary-container)]" style={{ width: "21%" }} title="Medium Risk: 21%" />
            <div className="h-full bg-[var(--tertiary-fixed-dim)]" style={{ width: "11%" }} title="High Risk: 11%" />
            <div className="h-full bg-[var(--error)]" style={{ width: "4%" }} title="Critical Risk: 4%" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
            <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--primary-container)]/30">
              <span className="font-label-caps text-[8px] uppercase font-bold text-[var(--primary-container)] block">LOW (0 - 29)</span>
              <span className="font-telemetry-num text-lg font-bold text-[var(--primary-container)] block">64%</span>
              <span className="font-code-sm text-[9px] text-[var(--text-muted)]">Safe Read Queries</span>
            </div>

            <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--secondary-container)]/30">
              <span className="font-label-caps text-[8px] uppercase font-bold text-[var(--secondary-container)] block">MEDIUM (30 - 59)</span>
              <span className="font-telemetry-num text-lg font-bold text-[var(--secondary-container)] block">21%</span>
              <span className="font-code-sm text-[9px] text-[var(--text-muted)]">Audited Updates</span>
            </div>

            <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--tertiary-fixed-dim)]/30">
              <span className="font-label-caps text-[8px] uppercase font-bold text-[var(--tertiary-fixed-dim)] block">HIGH (60 - 79)</span>
              <span className="font-telemetry-num text-lg font-bold text-[var(--tertiary-fixed-dim)] block">11%</span>
              <span className="font-code-sm text-[9px] text-[var(--text-muted)]">Dual-Custody Gated</span>
            </div>

            <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--error)]/40">
              <span className="font-label-caps text-[8px] uppercase font-bold text-[var(--error)] block">CRITICAL (80 - 100)</span>
              <span className="font-telemetry-num text-lg font-bold text-[var(--error)] block">4%</span>
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
            <span className="font-code-sm text-[9px] text-[var(--text-muted)] font-mono">Ranked by Blast Radius</span>
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            {highRiskTools.map((tool) => (
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
                  <span className="font-code-sm text-[9px] text-[var(--error)] font-bold hidden sm:inline">
                    {tool.blocksCount} BLOCKED
                  </span>
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
            <span className="font-code-sm text-[9px] text-[var(--text-muted)] font-mono">Application Threat Surface</span>
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            {highRiskIntegrations.map((app) => (
              <div
                key={app.name}
                className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] flex items-center justify-between gap-2 hover:border-[var(--border-interactive)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{app.icon}</span>
                  <div>
                    <span className="font-bold text-xs text-[var(--primary)] block font-mono">
                      {app.name}
                    </span>
                    <span className="font-code-sm text-[10px] text-[var(--text-muted)]">
                      {app.activeTools} callable tools · Block rate: {app.blockedRate}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded-xs font-label-caps text-[9px] font-bold ${
                      app.risk === "CRITICAL"
                        ? "bg-[var(--error-container)] text-[var(--on-error-container)] border border-[var(--error)]/40"
                        : "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] border border-[var(--tertiary-fixed-dim)]/40"
                    }`}
                  >
                    {app.risk} ({app.baseScore})
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
