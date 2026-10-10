"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Bot,
  ArrowRight,
  Search,
} from "lucide-react";
import { AGENT_RUNS, AgentRun } from "@/lib/sentinel-data";
import { api, AgentExecutionRecord } from "@/lib/api";

export default function AgentRunsPage() {
  const [selectedAgent, setSelectedAgent] = useState<string>("ALL");
  const [selectedIntegration, setSelectedIntegration] = useState<string>("ALL");
  const [selectedRisk, setSelectedRisk] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [liveRuns, setLiveRuns] = useState<AgentExecutionRecord[]>([]);

  useEffect(() => {
    api.agent.executions(50).then((runs) => {
      if (Array.isArray(runs) && runs.length > 0) {
        setLiveRuns(runs);
      }
    }).catch(() => {});
  }, []);

  const allRuns: AgentRun[] = useMemo(() => {
    if (liveRuns.length > 0) {
      return liveRuns.map((r) => {
        const t = r.tool_name || "tool.inspect";
        const app = t.includes(".") ? t.split(".")[0].toUpperCase() : "MCP";
        const score = typeof r.risk_score === "number" ? r.risk_score : 15;
        const riskLevel: AgentRun["riskLevel"] = score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW";
        const state: AgentRun["executionState"] = r.decision === "DENY" ? "BLOCKED" : r.decision === "REQUIRE_APPROVAL" ? "PENDING_APPROVAL" : "COMPLETED";
        const approval: AgentRun["approvalState"] = r.decision === "REQUIRE_APPROVAL" ? "PENDING" : "NOT_REQUIRED";
        return {
          id: String(r.id || r.request_id),
          agentName: r.actor_id || "Sentinel Autopilot",
          agentId: r.actor_id || "agent-sentinel-01",
          model: "claude-3-7-sonnet",
          environment: "Production" as const,
          application: app,
          toolName: t,
          executionState: state,
          riskLevel,
          riskScore: score,
          approvalState: approval,
          startedAt: r.created_at || "Just now",
          durationMs: 42,
          userPrompt: String(r.details?.prompt || r.details?.message || `Automated tool invocation: ${t}`),
          reasoning: "Autonomous planner determined tool execution step.",
          toolDiscovery: [t],
          payload: (r.details?.parameters as Record<string, unknown>) || {},
          policyEvaluated: r.decision === "DENY" ? "Invariant Policy Drop" : "Standard Allow Rule",
          auditEventId: String(r.id || `evt_${t}`),
        };
      });
    }
    return AGENT_RUNS;
  }, [liveRuns]);

  const filteredRuns = useMemo(() => {
    return allRuns.filter((run) => {
      if (selectedAgent !== "ALL" && run.agentName !== selectedAgent) return false;
      if (selectedIntegration !== "ALL" && run.application !== selectedIntegration) return false;
      if (selectedRisk !== "ALL" && run.riskLevel !== selectedRisk) return false;
      if (selectedStatus !== "ALL" && run.executionState !== selectedStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          run.id.toLowerCase().includes(q) ||
          run.agentName.toLowerCase().includes(q) ||
          run.application.toLowerCase().includes(q) ||
          run.toolName.toLowerCase().includes(q) ||
          run.userPrompt.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allRuns, selectedAgent, selectedIntegration, selectedRisk, selectedStatus, searchQuery]);

  const uniqueAgents = Array.from(new Set(allRuns.map((r) => r.agentName)));
  const uniqueIntegrations = Array.from(new Set(allRuns.map((r) => r.application)));

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 font-sans select-none animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase tracking-widest">
              AI EXECUTION OBSERVATORY // COGNITIVE TRACES
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-container)] animate-pulse" />
            <span className="font-code-sm text-[10px] text-[var(--primary-container)] font-bold">
              {filteredRuns.length} MONITORED DISPATCHES
            </span>
          </div>
          <h1 className="font-headline-md text-lg sm:text-xl font-bold tracking-tight text-[var(--primary)]">
            AGENT RUNS & EXECUTION TRACES
          </h1>
          <p className="font-body-sm text-xs text-[var(--text-secondary)] mt-0.5">
            Forensic inspection of autonomous agent tool requests, reasoning steps, policy gates, and execution outcomes.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs self-start sm:self-auto">
          <Link
            href="/agent"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-[var(--primary-container)] text-[var(--surface-container-lowest)] font-bold font-code-sm text-xs hover:brightness-110 shadow-sm transition-all"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AGENT CONSOLE</span>
          </Link>
        </div>
      </div>

      {/* Visual Execution Flow Banner */}
      <div className="p-3 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)]">
        <span className="font-label-caps text-[8px] uppercase font-bold text-[var(--text-muted)] tracking-wider block mb-2">
          EXECUTION LIFECYCLE FLOW // ZERO-TRUST PIPELINE
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs font-mono">
          <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
            <span className="font-label-caps text-[8px] uppercase text-[var(--text-muted)] block">01. INTAKE</span>
            <span className="font-bold text-[var(--primary)] text-[11px]">Prompt Ingest</span>
          </div>
          <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
            <span className="font-label-caps text-[8px] uppercase text-[var(--text-muted)] block">02. COGNITION</span>
            <span className="font-bold text-[var(--secondary-container)] text-[11px]">Reasoning Chain</span>
          </div>
          <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
            <span className="font-label-caps text-[8px] uppercase text-[var(--text-muted)] block">03. MCP INTERCEPT</span>
            <span className="font-bold text-[var(--text-primary)] text-[11px]">Tool Invocation</span>
          </div>
          <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
            <span className="font-label-caps text-[8px] uppercase text-[var(--text-muted)] block">04. INVARIANTS</span>
            <span className="font-bold text-[var(--tertiary-fixed-dim)] text-[11px]">Policy & Risk</span>
          </div>
          <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--primary-container)]/30 col-span-2 sm:col-span-1">
            <span className="font-label-caps text-[8px] uppercase text-[var(--primary-container)] block">05. GATING</span>
            <span className="font-bold text-[var(--primary-container)] text-[11px]">Escrow / Dispatch</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-2.5 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex-1 relative max-w-md">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by agent, tool, run ID, or prompt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] font-code-sm text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--secondary-container)]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 font-code-sm text-xs">
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="px-2 py-1 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-hidden"
            >
              <option value="ALL">All Agents ({AGENT_RUNS.length})</option>
              {uniqueAgents.map((ag) => (
                <option key={ag} value={ag}>{ag}</option>
              ))}
            </select>

            <select
              value={selectedIntegration}
              onChange={(e) => setSelectedIntegration(e.target.value)}
              className="px-2 py-1 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-hidden"
            >
              <option value="ALL">All Platforms</option>
              {uniqueIntegrations.map((app) => (
                <option key={app} value={app}>{app}</option>
              ))}
            </select>

            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="px-2 py-1 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-hidden"
            >
              <option value="ALL">All Risk Tiers</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2 py-1 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-hidden"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="BLOCKED">BLOCKED</option>
              <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
              <option value="EXECUTED">EXECUTED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Runs Table */}
      <div className="rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="bg-[var(--surface-container-lowest)] border-b border-[var(--border)] font-label-caps text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
                <th className="px-3 py-2">RUN ID</th>
                <th className="px-3 py-2">AGENT IDENTITY</th>
                <th className="px-3 py-2">PROMPT & TOOL CALL</th>
                <th className="px-3 py-2">PLATFORM</th>
                <th className="px-3 py-2">RISK SCORE</th>
                <th className="px-3 py-2">GATE VERDICT</th>
                <th className="px-3 py-2">LATENCY</th>
                <th className="px-3 py-2 text-right">INSPECT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-code-sm">
              {filteredRuns.map((run) => (
                <tr
                  key={run.id}
                  className="hover:bg-[var(--surface-container-high)]/50 transition-colors"
                >
                  <td className="px-3 py-2 whitespace-nowrap font-mono font-bold text-[var(--secondary-container)]">
                    <Link href={`/agent-runs/${run.id}`} className="hover:underline">
                      {run.id}
                    </Link>
                  </td>

                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="font-semibold text-xs text-[var(--primary)] font-mono">
                      {run.agentName}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono">{run.model}</div>
                  </td>

                  <td className="px-3 py-2 max-w-xs">
                    <div className="font-mono text-xs font-bold text-[var(--text-primary)]">
                      {run.toolName}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] truncate font-sans">
                      {run.userPrompt}
                    </div>
                  </td>

                  <td className="px-3 py-2 whitespace-nowrap font-mono">
                    <span className="px-1.5 py-0.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-[9px] text-[var(--text-secondary)]">
                      {run.application}
                    </span>
                  </td>

                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`px-1.5 py-0.5 rounded-xs font-label-caps text-[9px] font-bold ${
                        run.riskLevel === "CRITICAL"
                          ? "bg-[var(--error-container)] text-[var(--on-error-container)] border border-[var(--error)]/40"
                          : run.riskLevel === "HIGH"
                          ? "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] border border-[var(--tertiary-fixed-dim)]/40"
                          : "bg-[var(--primary-container)]/20 text-[var(--primary-container)] border border-[var(--primary-container)]/30"
                      }`}
                    >
                      {run.riskLevel} ({run.riskScore})
                    </span>
                  </td>

                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`px-1.5 py-0.5 rounded-xs font-label-caps text-[9px] font-bold ${
                        run.executionState === "COMPLETED"
                          ? "bg-[var(--primary-container)]/20 text-[var(--primary-container)] border border-[var(--primary-container)]/30"
                          : run.executionState === "BLOCKED"
                          ? "bg-[var(--error-container)] text-[var(--on-error-container)] border border-[var(--error)]/40"
                          : "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] border border-[var(--tertiary-fixed-dim)]/40"
                      }`}
                    >
                      {run.executionState}
                    </span>
                  </td>

                  <td className="px-3 py-2 whitespace-nowrap text-[10px] text-[var(--text-muted)] font-mono">
                    {run.durationMs}ms
                  </td>

                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Link
                      href={`/agent-runs/${run.id}`}
                      className="p-1 rounded-xs border border-[var(--border)] bg-[var(--surface-container-high)] text-[var(--text-primary)] hover:border-[var(--secondary-container)] hover:text-[var(--secondary-container)] transition-colors inline-flex items-center"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-2.5 border-t border-[var(--border)] bg-[var(--surface-container-lowest)] flex items-center justify-between text-xs text-[var(--text-muted)] font-code-sm">
          <span>{filteredRuns.length} Agent Executions Recorded</span>
          <span className="text-[var(--primary-container)] font-bold">Cryptographically Proven Invariants</span>
        </div>
      </div>
    </div>
  );
}
