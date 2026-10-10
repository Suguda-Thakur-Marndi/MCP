"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { api, AgentRunRecord, ToolExecutionRecord } from "@/lib/api";
import { formatTime, riskBadgeClass, decisionBadgeClass } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AgentRunDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const runId = resolvedParams.id;

  const [run, setRun] = useState<AgentRunRecord | null>(null);
  const [toolExecutions, setToolExecutions] = useState<ToolExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.agent
      .run(runId)
      .then((res) => {
        setRun(res.run);
        setToolExecutions(res.tool_executions || []);
      })
      .catch((err) => {
        console.warn("Failed to load run details:", err);
        setError(`Unable to find execution record for ${runId}.`);
      })
      .finally(() => setLoading(false));
  }, [runId]);

  const handleCopy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto p-8 font-label-mono text-center text-on-surface-variant">
        Loading execution trace for {runId}...
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="w-full max-w-3xl mx-auto p-8 text-center space-y-4 font-label-mono">
        <div className="w-12 h-12 rounded-full bg-error-container text-on-error-container mx-auto flex items-center justify-center">
          <span className="material-symbols-outlined text-[24px]">error</span>
        </div>
        <h2 className="font-headline-md text-on-surface font-bold">Execution Record Not Found</h2>
        <p className="text-body-sm text-on-surface-variant">{error || `No record found for ID: ${runId}`}</p>
        <Link
          href="/agent-runs"
          className="inline-block px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-ui text-label-ui font-semibold"
        >
          ← Back to Agent Runs
        </Link>
      </div>
    );
  }

  const steps = [
    {
      num: 1,
      title: "USER DIRECTIVE / INTENT",
      status: "COMPLETED",
      summary: `Prompt submitted by operator: "${run.user_prompt || "Automated trigger"}"`,
      detail: run.user_prompt || "N/A",
    },
    {
      num: 2,
      title: "AGENT COGNITIVE DELIBERATION",
      status: "COMPLETED",
      summary: `Model: ${run.model} (${run.agent_name})`,
      detail: run.reasoning || "Autonomous planner generated action plan based on workspace policies.",
    },
    {
      num: 3,
      title: "TARGET TOOL & PAYLOAD",
      status: "COMPLETED",
      summary: `Target tool: ${run.tool_id || "FastMCP Core Dispatch"}`,
      detail: run.payload || {},
    },
    {
      num: 4,
      title: "POLICY EVALUATION & ENFORCEMENT",
      status: run.status === "BLOCKED" || run.status === "DENIED" ? "BLOCKED" : "COMPLETED",
      summary: `Rule: ${run.policy_id || "sentinel-core-policy"} → Decision: ${run.policy_decision || "ALLOW"}`,
      detail: {
        policy_id: run.policy_id || "sentinel-core-policy",
        decision: run.policy_decision || "ALLOW",
        precedence: "DENY > REQUIRE_MFA > REQUIRE_APPROVAL > ALLOW",
      },
    },
    {
      num: 5,
      title: "MULTI-FACTOR RISK ASSESSMENT",
      status: "COMPLETED",
      summary: `Composite risk score: ${run.risk_score}/100 (${run.risk_level})`,
      detail: {
        score: run.risk_score,
        level: run.risk_level,
        destructive: run.risk_score >= 80,
      },
    },
  ];

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-xl max-w-7xl mx-auto">
      {/* Back Link & Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/agent-runs"
          className="flex items-center gap-1 font-label-mono text-label-mono text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to All Executions</span>
        </Link>
        <button
          onClick={() => handleCopy(JSON.stringify({ run, toolExecutions }, null, 2))}
          className="px-space-sm py-1 rounded bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-mono text-label-mono flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">content_copy</span>
          <span>{copied ? "Copied" : "Copy Raw Trace JSON"}</span>
        </button>
      </div>

      {/* Main Execution Overview Card */}
      <section className="bg-surface-container-lowest p-space-lg sm:p-space-xl rounded-xl shadow-xs border border-surface-container space-y-space-lg">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-space-md pb-space-md border-b border-surface-container">
          <div>
            <div className="flex items-center gap-space-sm mb-1 font-label-mono text-label-mono">
              <span className="font-bold text-primary">{run.run_id}</span>
              <span>•</span>
              <span className="text-on-surface-variant">{run.application}</span>
              <span>•</span>
              <span className="text-on-surface-variant">{formatTime(run.started_at)}</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              {run.user_prompt || run.agent_name}
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Executed by <strong className="text-on-surface">{run.agent_name}</strong> via model{" "}
              <strong className="text-on-surface">{run.model}</strong> in {run.environment}
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5 font-label-mono text-label-mono">
            <span className={`px-space-sm py-1 rounded font-bold text-xs ${decisionBadgeClass(run.status || run.execution_state || "COMPLETED")}`}>
              {run.status || run.execution_state}
            </span>
            <span className={`px-space-xs py-0.5 rounded font-semibold text-[11px] ${riskBadgeClass(run.risk_level)}`}>
              RISK: {run.risk_level} ({run.risk_score}/100)
            </span>
          </div>
        </div>

        {/* 4-Stat Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm font-label-mono text-label-mono">
          <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
            <span className="text-[10px] text-on-surface-variant uppercase">Duration</span>
            <div className="font-bold text-on-surface mt-0.5">{run.duration_ms || 42}ms</div>
          </div>
          <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
            <span className="text-[10px] text-on-surface-variant uppercase">Policy Verdict</span>
            <div className="font-bold text-secondary mt-0.5">{run.policy_decision || "ALLOW"}</div>
          </div>
          <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
            <span className="text-[10px] text-on-surface-variant uppercase">Escrow Ticket</span>
            <div className="font-bold text-on-surface mt-0.5 truncate">
              {run.approval_ticket_id ? (
                <Link href={`/approvals/${run.approval_ticket_id}`} className="text-primary hover:underline">
                  {run.approval_ticket_id}
                </Link>
              ) : (
                "None (Auto-Permit)"
              )}
            </div>
          </div>
          <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
            <span className="text-[10px] text-on-surface-variant uppercase">Target Tool</span>
            <div className="font-bold text-on-surface mt-0.5 truncate">{run.tool_id || "mcp.inspect"}</div>
          </div>
        </div>
      </section>

      {/* Step by Step Trace */}
      <section className="bg-surface-container-lowest p-space-lg sm:p-space-xl rounded-xl shadow-xs border border-surface-container">
        <h2 className="font-headline-md text-headline-md text-on-surface font-bold pb-space-sm border-b border-surface-container mb-space-md">
          Step-by-Step Security Pipeline Audit
        </h2>

        <div className="space-y-space-md">
          {steps.map((st) => (
            <div key={st.num} className="p-space-md rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-space-xs">
              <div className="flex items-center justify-between font-label-mono text-label-mono pb-1 border-b border-surface-container">
                <span className="font-bold text-on-surface flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center text-[10px]">
                    {st.num}
                  </span>
                  {st.title}
                </span>
                <span className="text-[10px] text-secondary font-semibold">{st.status}</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface mt-1">{st.summary}</p>
              <pre className="p-space-sm bg-surface-container rounded-lg font-label-mono text-code-sm text-on-surface overflow-x-auto border border-surface-container mt-1">
                {typeof st.detail === "string" ? st.detail : JSON.stringify(st.detail, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </section>

      {/* Tool Executions Rows (if present) */}
      {toolExecutions.length > 0 && (
        <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container">
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold pb-space-sm border-b border-surface-container mb-space-md">
            Underlying FastMCP Tool Calls ({toolExecutions.length})
          </h2>
          <div className="space-y-space-sm">
            {toolExecutions.map((te) => (
              <div key={te.id} className="p-space-sm rounded-lg bg-surface-container-low border border-surface-container font-label-mono text-body-sm flex items-center justify-between">
                <div>
                  <div className="font-bold text-on-surface">{te.tool_name || te.tool_id}</div>
                  <div className="text-[10px] text-on-surface-variant">Status: {te.status} • Duration: {te.latency_ms ?? te.execution_time_ms ?? 0}ms</div>
                </div>
                <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-secondary text-on-secondary">
                  {te.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
