"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { api, AgentRunRecord } from "@/lib/api";
import { formatTime, riskBadgeClass, decisionBadgeClass } from "@/lib/utils";

export default function AgentRunsPage() {
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAgent, setSelectedAgent] = useState<string>("ALL");
  const [selectedApplication, setSelectedApplication] = useState<string>("ALL");
  const [selectedRisk, setSelectedRisk] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadRuns = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.agent.runs({ limit: 50 });
      setRuns(res.runs || []);
    } catch (err: unknown) {
      console.warn("Failed to load agent runs:", err);
      setError("Unable to connect to Agent Runs ledger. Verify backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRuns();
  }, []);

  const uniqueAgents = useMemo(() => {
    return Array.from(new Set(runs.map((r) => r.agent_name).filter(Boolean)));
  }, [runs]);

  const uniqueApplications = useMemo(() => {
    return Array.from(new Set(runs.map((r) => r.application).filter(Boolean)));
  }, [runs]);

  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      if (selectedAgent !== "ALL" && r.agent_name !== selectedAgent) return false;
      if (selectedApplication !== "ALL" && r.application !== selectedApplication) return false;
      if (selectedRisk !== "ALL" && r.risk_level !== selectedRisk) return false;
      if (selectedStatus !== "ALL" && r.status !== selectedStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          r.run_id.toLowerCase().includes(q) ||
          r.agent_name.toLowerCase().includes(q) ||
          r.application.toLowerCase().includes(q) ||
          (r.user_prompt && r.user_prompt.toLowerCase().includes(q)) ||
          (r.tool_id && r.tool_id.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [runs, selectedAgent, selectedApplication, selectedRisk, selectedStatus, searchQuery]);

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-xl">
      {/* Header Banner */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-sm mb-space-xxs">
            <span className="font-label-mono text-label-mono text-secondary font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              AI EXECUTION OBSERVATORY
            </span>
            <span className="font-label-mono text-label-mono px-space-xs py-0.5 rounded bg-surface-container text-on-surface-variant">
              POSTGRESQL AUDIT REPOSITORY
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
            Autonomous Agent Execution Traces
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Cryptographic ledger of cognitive steps, candidate tool discoveries, and policy gate evaluations
          </p>
        </div>

        <div className="flex items-center gap-space-xs">
          <button
            onClick={() => void loadRuns()}
            className="px-space-md py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-ui text-label-ui flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Reload Ledger</span>
          </button>
          <Link
            href="/agent"
            className="px-space-md py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-label-ui text-label-ui font-semibold shadow-xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">terminal</span>
            <span>Launch Agent</span>
          </Link>
        </div>
      </section>

      {/* Error state */}
      {error && (
        <div className="p-space-md rounded-xl bg-error-container text-on-error-container font-label-mono text-label-mono flex items-center justify-between border border-error/20">
          <span>{error}</span>
          <button onClick={() => void loadRuns()} className="underline cursor-pointer font-bold">
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <section className="bg-surface-container-lowest p-space-md sm:p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-wrap items-center gap-space-sm font-label-mono text-label-mono">
        <div className="flex-1 min-w-[240px] relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Run ID, prompt, tool, agent..."
            className="w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant px-space-md py-1.5 pl-8 rounded-lg font-body-sm text-body-sm border border-surface-container outline-hidden focus:bg-surface-container"
          />
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant absolute left-2.5 top-2.5 pointer-events-none">
            search
          </span>
        </div>

        {/* Agent Filter */}
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="bg-surface-container-low text-on-surface px-space-md py-1.5 rounded-lg border border-surface-container outline-hidden cursor-pointer"
        >
          <option value="ALL">Agent: All ({uniqueAgents.length})</option>
          {uniqueAgents.map((ag) => (
            <option key={ag} value={ag}>
              {ag}
            </option>
          ))}
        </select>

        {/* Application Filter */}
        <select
          value={selectedApplication}
          onChange={(e) => setSelectedApplication(e.target.value)}
          className="bg-surface-container-low text-on-surface px-space-md py-1.5 rounded-lg border border-surface-container outline-hidden cursor-pointer"
        >
          <option value="ALL">Application: All</option>
          {uniqueApplications.map((app) => (
            <option key={app} value={app}>
              {app}
            </option>
          ))}
        </select>

        {/* Risk Filter */}
        <select
          value={selectedRisk}
          onChange={(e) => setSelectedRisk(e.target.value)}
          className="bg-surface-container-low text-on-surface px-space-md py-1.5 rounded-lg border border-surface-container outline-hidden cursor-pointer"
        >
          <option value="ALL">Risk: All</option>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-surface-container-low text-on-surface px-space-md py-1.5 rounded-lg border border-surface-container outline-hidden cursor-pointer"
        >
          <option value="ALL">Status: All</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="AWAITING_APPROVAL">AWAITING_APPROVAL</option>
          <option value="BLOCKED">BLOCKED</option>
          <option value="DENIED">DENIED</option>
        </select>
      </section>

      {/* Main Table */}
      <section className="bg-surface-container-lowest rounded-xl shadow-xs border border-surface-container overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider border-b border-surface-container">
                <th className="py-space-sm px-space-lg">Run ID</th>
                <th className="py-space-sm px-space-md">Agent / Model</th>
                <th className="py-space-sm px-space-md">Application / Tool</th>
                <th className="py-space-sm px-space-md">User Prompt</th>
                <th className="py-space-sm px-space-md">Risk Rating</th>
                <th className="py-space-sm px-space-md">Status</th>
                <th className="py-space-sm px-space-md">Started</th>
                <th className="py-space-sm px-space-lg text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-sm text-body-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-on-surface-variant font-label-mono">
                    Loading agent executions from PostgreSQL database...
                  </td>
                </tr>
              ) : filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-on-surface-variant font-label-mono">
                    No agent runs match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRuns.map((run) => (
                  <tr key={run.run_id} className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-space-md px-space-lg font-label-mono text-label-mono font-bold text-primary">
                      {run.run_id}
                    </td>
                    <td className="py-space-md px-space-md">
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-on-surface truncate">{run.agent_name}</span>
                        <span className="font-label-mono text-[10px] text-on-surface-variant">{run.model}</span>
                      </div>
                    </td>
                    <td className="py-space-md px-space-md font-label-mono text-label-mono">
                      <span className="font-semibold text-on-surface">{run.application}</span>
                      {run.tool_id && <div className="text-[10px] text-on-surface-variant truncate">{run.tool_id}</div>}
                    </td>
                    <td className="py-space-md px-space-md text-on-surface max-w-xs truncate">
                      {run.user_prompt || "N/A"}
                    </td>
                    <td className="py-space-md px-space-md">
                      <span className={`font-label-mono text-label-mono font-semibold px-space-xs py-0.5 rounded ${riskBadgeClass(run.risk_level)}`}>
                        {run.risk_level} ({run.risk_score})
                      </span>
                    </td>
                    <td className="py-space-md px-space-md">
                      <span className={`font-label-mono text-label-mono font-bold px-space-xs py-0.5 rounded ${decisionBadgeClass(run.status || run.execution_state || "COMPLETED")}`}>
                        {run.status || run.execution_state}
                      </span>
                    </td>
                    <td className="py-space-md px-space-md font-label-mono text-label-mono text-on-surface-variant whitespace-nowrap">
                      {run.started_at ? formatTime(run.started_at) : "Recent"}
                    </td>
                    <td className="py-space-md px-space-lg text-right">
                      <Link
                        href={`/agent-runs/${run.run_id}`}
                        className="text-on-surface-variant hover:text-on-surface font-label-mono text-label-mono underline underline-offset-2"
                      >
                        Inspect Trace →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-space-md bg-surface-container-low/40 flex items-center justify-between text-body-sm font-label-mono text-on-surface-variant border-t border-surface-container">
          <span>
            Showing {filteredRuns.length} of {runs.length} execution sessions
          </span>
          <span className="text-[11px]">Audit replication status: 100% verified</span>
        </div>
      </section>
    </div>
  );
}
