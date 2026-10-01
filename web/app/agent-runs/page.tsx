"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Bot,
  Filter,
  Eye,
  ArrowRight,
  Shield,
  Clock,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Hourglass,
  ChevronRight,
  Terminal,
} from "lucide-react";
import { AGENT_RUNS, AgentRun } from "@/lib/sentinel-data";
import { RiskBadge } from "@/components/ui/Badges";

export default function AgentRunsPage() {
  const [selectedAgent, setSelectedAgent] = useState<string>("ALL");
  const [selectedIntegration, setSelectedIntegration] = useState<string>("ALL");
  const [selectedRisk, setSelectedRisk] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredRuns = useMemo(() => {
    return AGENT_RUNS.filter((run) => {
      if (selectedAgent !== "ALL" && run.agentName !== selectedAgent) return false;
      if (selectedIntegration !== "ALL" && run.application !== selectedIntegration) return false;
      if (selectedRisk !== "ALL" && run.riskLevel !== selectedRisk) return false;
      if (selectedStatus !== "ALL" && run.executionState !== selectedStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          run.id.toLowerCase().includes(q) ||
          run.agentName.toLowerCase().includes(q) ||
          run.application.toLowerCase().includes(q) ||
          run.toolName.toLowerCase().includes(q) ||
          run.userPrompt.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [selectedAgent, selectedIntegration, selectedRisk, selectedStatus, searchQuery]);

  const uniqueAgents = Array.from(new Set(AGENT_RUNS.map((r) => r.agentName)));
  const uniqueIntegrations = Array.from(new Set(AGENT_RUNS.map((r) => r.application)));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="pb-5 border-b border-[var(--border)] flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] mb-1">
            <span className="font-bold text-[var(--text-primary)]">MCP SENTINEL</span>
            <span>/</span>
            <span className="text-[var(--accent)] font-semibold">OPERATIONS</span>
            <span>/</span>
            <span className="text-[var(--text-secondary)]">AI OBSERVATORY</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Agent Runs Observatory
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
            Real-time inspection of active AI agent reasoning, tool requests, security policy evaluations, and execution states.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/agent"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-95 shadow-2xs"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Open Guarded Agent</span>
          </Link>
        </div>
      </div>

      {/* Visual Execution Flow Banner */}
      <div className="p-4 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs">
        <span className="text-[10px] font-mono-tnum uppercase font-bold text-[var(--text-muted)] tracking-wider block mb-2">
          Execution Lifecycle Flow
        </span>
        <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono-tnum">
          <div className="p-2 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)]">
            <span className="text-[9px] uppercase text-[var(--text-muted)] block">01. INTAKE</span>
            <span className="font-bold text-[var(--text-primary)] text-[11px]">Agent Prompt</span>
          </div>
          <div className="p-2 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)]">
            <span className="text-[9px] uppercase text-[var(--text-muted)] block">02. COGNITION</span>
            <span className="font-bold text-[var(--text-primary)] text-[11px]">Reasoning Trace</span>
          </div>
          <div className="p-2 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)]">
            <span className="text-[9px] uppercase text-[var(--text-muted)] block">03. CANDIDATE</span>
            <span className="font-bold text-[var(--accent)] text-[11px]">Tool Request</span>
          </div>
          <div className="p-2 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)]">
            <span className="text-[9px] uppercase text-[var(--text-muted)] block">04. GATEWAY</span>
            <span className="font-bold text-[var(--text-primary)] text-[11px]">Security Decision</span>
          </div>
          <div className="p-2 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)]">
            <span className="text-[9px] uppercase text-[var(--text-muted)] block">05. DISPATCH</span>
            <span className="font-bold text-[var(--risk-low)] text-[11px]">Execution / Audit</span>
          </div>
        </div>
      </div>

      {/* Filter Deck */}
      <div className="p-4 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by run ID, prompt, tool, or agent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)]/50 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] font-mono-tnum"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tnum">
            {/* Agent filter */}
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="px-2.5 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-primary)] focus:outline-none"
            >
              <option value="ALL">All Agents</option>
              {uniqueAgents.map((ag) => (
                <option key={ag} value={ag}>{ag}</option>
              ))}
            </select>

            {/* Integration filter */}
            <select
              value={selectedIntegration}
              onChange={(e) => setSelectedIntegration(e.target.value)}
              className="px-2.5 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-primary)] focus:outline-none"
            >
              <option value="ALL">All Integrations</option>
              {uniqueIntegrations.map((app) => (
                <option key={app} value={app}>{app}</option>
              ))}
            </select>

            {/* Risk filter */}
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="px-2.5 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-primary)] focus:outline-none"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>

            {/* Status filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-primary)] focus:outline-none"
            >
              <option value="ALL">All States</option>
              <option value="COMPLETED">Completed</option>
              <option value="BLOCKED">Blocked</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
            </select>
          </div>
        </div>
      </div>

      {/* Observatory Execution Cards / Rows */}
      <div className="space-y-3">
        {filteredRuns.length === 0 ? (
          <div className="p-12 text-center rounded-xs border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-muted)] font-mono-tnum">
            No agent executions matching current filter criteria.
          </div>
        ) : (
          filteredRuns.map((run) => (
            <div
              key={run.id}
              className="p-4 sm:p-5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs hover:border-[var(--text-muted)] transition-all space-y-3"
            >
              {/* Row Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--border-subtle)] gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] font-bold text-xs flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-[var(--text-primary)]">{run.agentName}</h3>
                      <span className="px-1.5 py-0.2 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] font-mono-tnum text-[10px] text-[var(--text-muted)]">
                        {run.model}
                      </span>
                      <span className="px-1.5 py-0.2 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] font-mono-tnum text-[10px] text-[var(--text-muted)]">
                        {run.environment}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono-tnum text-[var(--text-muted)]">
                      Run ID: {run.id} · Started: {new Date(run.startedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <RiskBadge level={run.riskLevel} score={run.riskScore} />

                  <span
                    className={`px-2 py-0.5 rounded-xs text-[10px] font-mono-tnum font-bold ${
                      run.executionState === "COMPLETED"
                        ? "bg-[var(--risk-low-bg)] text-[var(--risk-low)] border border-[var(--risk-low-border)]"
                        : run.executionState === "BLOCKED"
                        ? "bg-[var(--risk-critical-bg)] text-[var(--risk-critical)] border border-[var(--risk-critical-border)]"
                        : "bg-[var(--risk-high-bg)] text-[var(--risk-high)] border border-[var(--risk-high-border)]"
                    }`}
                  >
                    {run.executionState}
                  </span>

                  <Link
                    href={`/agent-runs/${run.id}`}
                    className="p-1 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors ml-1"
                    title="Inspect detailed 11-step execution timeline"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Cascade: Agent Prompt → Reasoning → Tool Request → Security Decision */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono-tnum pt-1">
                {/* 1. Prompt */}
                <div className="p-2.5 rounded-xs bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] block">User Request</span>
                  <p className="text-[11px] font-sans text-[var(--text-primary)] line-clamp-2 leading-relaxed">
                    &ldquo;{run.userPrompt}&rdquo;
                  </p>
                </div>

                {/* 2. Reasoning */}
                <div className="p-2.5 rounded-xs bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] block">Agent Reasoning</span>
                  <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                    {run.reasoning}
                  </p>
                </div>

                {/* 3. Tool Candidate */}
                <div className="p-2.5 rounded-xs bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] block">Tool Requested</span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] text-[10px] font-bold text-[var(--text-primary)]">
                      {run.application}
                    </span>
                    <code className="text-[11px] text-[var(--accent)] font-bold truncate">
                      {run.toolName}
                    </code>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] block">Duration: {run.durationMs}ms</span>
                </div>

                {/* 4. Security Decision */}
                <div className="p-2.5 rounded-xs bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] block">Policy Evaluation</span>
                  <span className="text-[11px] text-[var(--text-primary)] font-semibold truncate block">
                    {run.policyEvaluated}
                  </span>
                  <div className="flex items-center justify-between text-[10px] pt-0.5">
                    <span className="text-[var(--text-muted)]">Approval:</span>
                    <span className="font-semibold text-[var(--text-primary)]">{run.approvalState}</span>
                  </div>
                </div>
              </div>

              {/* Micro Action Bar */}
              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] font-mono-tnum text-[var(--text-muted)]">
                <span>Discovered Tools: {run.toolDiscovery.join(", ")}</span>
                <Link
                  href={`/agent-runs/${run.id}`}
                  className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline"
                >
                  <span>Inspect Timeline & Payload</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
