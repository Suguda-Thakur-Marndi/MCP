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
} from "lucide-react";
import { RISK_FACTORS, INTEGRATIONS } from "@/lib/sentinel-data";
import { RiskBadge } from "@/components/ui/Badges";

export default function RiskCenterPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<"24h" | "7d" | "30d">("24h");

  const highRiskTools = [
    { name: "github.delete_repository", app: "GitHub", score: 98, level: "CRITICAL", policy: "Repository Protection Policy", blocksCount: 14 },
    { name: "drive.delete_file", app: "Google Drive", score: 94, level: "CRITICAL", policy: "Production Data Protection", blocksCount: 19 },
    { name: "mcp.delete_customer", app: "Custom MCP", score: 88, level: "HIGH", policy: "Production Data Protection", blocksCount: 8 },
    { name: "jira.delete_project", app: "Jira", score: 99, level: "CRITICAL", policy: "Production Data Protection", blocksCount: 2 },
    { name: "drive.share_file", app: "Google Drive", score: 82, level: "HIGH", policy: "Personal Data Policy", blocksCount: 31 },
  ];

  const highRiskIntegrations = [
    { name: "GitHub", logo: "🐙", risk: "CRITICAL", baseScore: 92, blockedRate: "28%", activeTools: 5 },
    { name: "Google Drive", logo: "📁", risk: "HIGH", baseScore: 78, blockedRate: "19%", activeTools: 5 },
    { name: "Jira", logo: "📐", risk: "HIGH", baseScore: 74, blockedRate: "12%", activeTools: 4 },
    { name: "Custom MCP", logo: "⚡", risk: "HIGH", baseScore: 70, blockedRate: "15%", activeTools: 8 },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="pb-5 border-b border-[var(--border)] flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] mb-1">
            <span className="font-bold text-[var(--text-primary)]">MCP SENTINEL</span>
            <span>/</span>
            <span className="text-[var(--accent)] font-semibold">SECURITY</span>
            <span>/</span>
            <span className="text-[var(--text-secondary)]">RISK ENGINE</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Risk Analysis Center
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
            Multi-factor scoring matrix, threat surface boundaries, and risk distribution across all active AI agent dispatches.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono-tnum text-xs">
          {["24h", "7d", "30d"].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTimeframe(t as "24h" | "7d" | "30d")}
              className={`px-3 py-1.5 rounded-xs border transition-colors ${
                selectedTimeframe === t
                  ? "bg-[var(--accent)] text-white border-[var(--accent)] font-bold"
                  : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Top Editorial Ratios: Risk Score Distribution */}
      <div className="p-4 sm:p-5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <span className="text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] font-bold">
            Live Risk Distribution ({selectedTimeframe} window)
          </span>
          <span className="text-[10px] font-mono-tnum text-[var(--risk-low)] font-semibold">
            Composite Mean: 24.2 / 100 (Nominal)
          </span>
        </div>

        {/* Visual Segmented Distribution Bar */}
        <div className="space-y-2 font-mono-tnum text-xs">
          <div className="w-full h-3 rounded-xs bg-[var(--bg-secondary)] overflow-hidden flex">
            <div className="h-full bg-[var(--risk-low)]" style={{ width: "64%" }} title="Low Risk: 64%" />
            <div className="h-full bg-[var(--risk-medium)]" style={{ width: "21%" }} title="Medium Risk: 21%" />
            <div className="h-full bg-[var(--risk-high)]" style={{ width: "11%" }} title="High Risk: 11%" />
            <div className="h-full bg-[var(--risk-critical)]" style={{ width: "4%" }} title="Critical Risk: 4%" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            <div className="p-2.5 rounded-xs bg-[var(--risk-low-bg)] border border-[var(--risk-low-border)]">
              <span className="text-[10px] uppercase font-bold text-[var(--risk-low)] block">LOW (0 - 29)</span>
              <span className="text-base font-bold text-[var(--risk-low)] block">64%</span>
              <span className="text-[10px] text-[var(--text-muted)]">Safe Read Queries</span>
            </div>
            <div className="p-2.5 rounded-xs bg-[var(--risk-medium-bg)] border border-[var(--risk-medium-border)]">
              <span className="text-[10px] uppercase font-bold text-[var(--risk-medium)] block">MEDIUM (30 - 59)</span>
              <span className="text-base font-bold text-[var(--risk-medium)] block">21%</span>
              <span className="text-[10px] text-[var(--text-muted)]">Audited Updates</span>
            </div>
            <div className="p-2.5 rounded-xs bg-[var(--risk-high-bg)] border border-[var(--risk-high-border)]">
              <span className="text-[10px] uppercase font-bold text-[var(--risk-high)] block">HIGH (60 - 79)</span>
              <span className="text-base font-bold text-[var(--risk-high)] block">11%</span>
              <span className="text-[10px] text-[var(--text-muted)]">Dual-Custody Gated</span>
            </div>
            <div className="p-2.5 rounded-xs bg-[var(--risk-critical-bg)] border border-[var(--risk-critical-border)]">
              <span className="text-[10px] uppercase font-bold text-[var(--risk-critical)] block">CRITICAL (80 - 100)</span>
              <span className="text-base font-bold text-[var(--risk-critical)] block">4%</span>
              <span className="text-[10px] text-[var(--text-muted)]">Purge / Destruction</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6-Factor Risk Breakdown Architecture */}
      <div className="rounded-xs border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="pb-3 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] block">
              Algorithmic Evaluation
            </span>
            <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[var(--accent)]" />
              6-Factor Invariant Risk Assessment Matrix
            </h2>
          </div>
          <span className="text-[10px] font-mono-tnum text-[var(--text-muted)]">
            Score = &sum;(Weight &times; FactorScore)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-mono-tnum text-xs">
          {RISK_FACTORS.map((factor) => (
            <div
              key={factor.name}
              className="p-3.5 rounded-xs bg-[var(--bg-secondary)]/50 border border-[var(--border)] space-y-2 hover:border-[var(--text-muted)] transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--text-primary)] text-xs">{factor.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] font-bold text-[var(--accent)]">
                  Weight: {factor.weight * 100}%
                </span>
              </div>
              <p className="text-[11px] font-sans text-[var(--text-secondary)] leading-relaxed">
                {factor.description}
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)] text-[10px]">
                <span className="text-[var(--text-muted)]">Calculated Score:</span>
                <span className="font-bold text-[var(--text-primary)]">{factor.score} / 100</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Grid: High-Risk Tools & High-Risk Integrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* High-Risk Tools */}
        <div className="p-4 sm:p-5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-[var(--accent)]" />
              High-Risk Tools Inventory
            </h3>
            <span className="text-[10px] font-mono-tnum text-[var(--text-muted)]">Ranked by Blast Radius</span>
          </div>

          <div className="space-y-2 font-mono-tnum text-xs">
            {highRiskTools.map((tool) => (
              <div
                key={tool.name}
                className="p-3 rounded-xs bg-[var(--bg-secondary)]/40 border border-[var(--border-subtle)] flex items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-bold text-[var(--accent)]">{tool.name}</code>
                    <span className="px-1.5 py-0.2 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] text-[9px] text-[var(--text-muted)]">
                      {tool.app}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] block mt-0.5 font-sans">
                    {tool.policy}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-right">
                  <RiskBadge level={tool.level as "HIGH" | "CRITICAL"} score={tool.score} />
                  <span className="text-[10px] text-[var(--risk-critical)] font-bold hidden sm:inline">
                    {tool.blocksCount} blocked
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* High-Risk Integrations */}
        <div className="p-4 sm:p-5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
              High-Risk Software Boundaries
            </h3>
            <span className="text-[10px] font-mono-tnum text-[var(--text-muted)]">Application Threat Surface</span>
          </div>

          <div className="space-y-2 font-mono-tnum text-xs">
            {highRiskIntegrations.map((app) => (
              <div
                key={app.name}
                className="p-3 rounded-xs bg-[var(--bg-secondary)]/40 border border-[var(--border-subtle)] flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{app.logo}</span>
                  <div>
                    <span className="font-bold text-xs text-[var(--text-primary)] block font-sans">
                      {app.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {app.activeTools} callable tools · Block rate: {app.blockedRate}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <RiskBadge level={app.risk as "HIGH" | "CRITICAL"} score={app.baseScore} />
                  <Link
                    href={`/integrations/${app.name.toLowerCase().replace(" ", "-")}`}
                    className="p-1 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--accent)]"
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
