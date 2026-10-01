"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Bot,
  ChevronLeft,
  Shield,
  Layers,
  Clock,
  Terminal,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AGENT_RUNS, AgentRun } from "@/lib/sentinel-data";
import { RiskBadge, DecisionBadge } from "@/components/ui/Badges";
import { prettyJson } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AgentRunDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const runId = resolvedParams.id;

  const run: AgentRun | undefined = AGENT_RUNS.find((r) => r.id === runId) || AGENT_RUNS[0];

  const [expandedSection, setExpandedSection] = useState<string | null>("payload");
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const steps = [
    {
      num: 1,
      title: "USER REQUEST",
      status: "COMPLETED",
      summary: `Prompt submitted: "${run.userPrompt}"`,
      detail: run.userPrompt,
      time: "0ms",
    },
    {
      num: 2,
      title: "AGENT REASONING",
      status: "COMPLETED",
      summary: `Cognitive deliberation via ${run.model}`,
      detail: run.reasoning,
      time: "+320ms",
    },
    {
      num: 3,
      title: "TOOL DISCOVERY",
      status: "COMPLETED",
      summary: `Identified candidate tools: ${run.toolDiscovery.join(", ")}`,
      detail: run.toolDiscovery,
      time: "+410ms",
    },
    {
      num: 4,
      title: "TOOL REQUEST",
      status: "COMPLETED",
      summary: `Target dispatch: ${run.application} → ${run.toolName}`,
      detail: run.payload,
      time: "+520ms",
    },
    {
      num: 5,
      title: "POLICY EVALUATION",
      status: run.executionState === "BLOCKED" ? "BLOCKED" : "COMPLETED",
      summary: `Evaluated against ${run.policyEvaluated}`,
      detail: {
        enforcedPolicy: run.policyEvaluated,
        precedence: "DENY > MFA > APPROVAL > ALLOW",
        verdict: run.executionState === "BLOCKED" ? "VIOLATION_DETECTED" : "AUTHORIZED_OR_GATED",
      },
      time: "+590ms",
    },
    {
      num: 6,
      title: "RISK SCORE",
      status: "COMPLETED",
      summary: `Multi-factor composite score: ${run.riskScore} / 100 (${run.riskLevel})`,
      detail: {
        score: run.riskScore,
        level: run.riskLevel,
        threshold: 75,
        destructive: run.toolName.includes("delete") || run.toolName.includes("drop"),
      },
      time: "+640ms",
    },
    {
      num: 7,
      title: "APPROVAL",
      status: run.approvalState === "PENDING" ? "PENDING" : run.approvalState === "REJECTED" ? "BLOCKED" : "COMPLETED",
      summary: `Dual-custody status: ${run.approvalState}`,
      detail: {
        approvalState: run.approvalState,
        signature: "HMAC-SHA256: e8b941...7a20",
        requiredSignatures: run.riskLevel === "CRITICAL" ? 2 : 1,
      },
      time: "+710ms",
    },
    {
      num: 8,
      title: "EXECUTION",
      status: run.executionState === "COMPLETED" ? "COMPLETED" : run.executionState === "BLOCKED" ? "BLOCKED" : "WAITING",
      summary: run.executionState === "COMPLETED" ? "Dispatched through MCP Gateway" : run.executionState === "BLOCKED" ? "Execution halted by SecurityGate" : "Suspended awaiting human sign-off",
      detail: run.executionResult || { status: run.executionState },
      time: `+${run.durationMs}ms`,
    },
    {
      num: 9,
      title: "RESULT",
      status: run.executionState === "COMPLETED" ? "COMPLETED" : "RECORDED",
      summary: run.executionResult ? "Payload returned from external software" : "State change prevented",
      detail: run.executionResult || { message: "No destructive state changes applied" },
      time: `+${run.durationMs + 40}ms`,
    },
    {
      num: 10,
      title: "AUDIT",
      status: "COMPLETED",
      summary: `Sealed to immutable PostgreSQL ledger (ID: ${run.auditEventId})`,
      detail: {
        eventId: run.auditEventId,
        hashSeal: "sha256: 4fa910...b921",
        verifiedIntegrity: true,
      },
      time: `+${run.durationMs + 65}ms`,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="pb-5 border-b border-[var(--border)] flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] mb-1">
            <Link href="/agent-runs" className="hover:text-[var(--text-primary)] flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" />
              <span>AGENT RUNS</span>
            </Link>
            <span>/</span>
            <span className="font-bold text-[var(--text-primary)]">{run.id}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            <span>Execution Timeline</span>
            <span className="font-mono-tnum text-sm px-2 py-0.5 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--accent)]">
              {run.id}
            </span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Step-by-step invariant trace through the Sentinel 10-stage security pipeline.
          </p>
        </div>

        {/* Quick Nav Links */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tnum">
          <Link
            href="/policies"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--text-muted)]"
          >
            <span>View Policy</span>
            <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
          </Link>
          <Link
            href="/approvals"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--text-muted)]"
          >
            <span>View Approval</span>
            <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
          </Link>
          <Link
            href="/audit"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--text-muted)]"
          >
            <span>View Audit Event</span>
            <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
          </Link>
        </div>
      </div>

      {/* Identity Summary Deck */}
      <div className="p-4 sm:p-5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono-tnum">
          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Agent Identity</span>
            <span className="font-bold text-[var(--text-primary)] block truncate">{run.agentName}</span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Reasoning Model</span>
            <span className="font-semibold text-[var(--text-primary)] block truncate">{run.model}</span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Environment</span>
            <span className="font-semibold text-[var(--text-primary)] block">{run.environment}</span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Target Software</span>
            <span className="font-semibold text-[var(--accent)] block">{run.application}</span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Total Duration</span>
            <span className="font-semibold text-[var(--text-primary)] block">{run.durationMs}ms</span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Risk Score</span>
            <RiskBadge level={run.riskLevel} score={run.riskScore} />
          </div>
        </div>
      </div>

      {/* 10-Step Execution Timeline */}
      <div className="rounded-xs border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-6 shadow-2xs space-y-6">
        <div className="pb-3 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Deterministic Pipeline Execution Trace
          </h2>
          <span className="text-[10px] font-mono-tnum text-[var(--text-muted)]">
            Verified HMAC Single-Use Token
          </span>
        </div>

        <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border)]">
          {steps.map((step) => {
            const isBlocked = step.status === "BLOCKED";
            const isPending = step.status === "PENDING";
            const isWaiting = step.status === "WAITING";

            return (
              <div key={step.num} className="relative group">
                {/* Node icon */}
                <div
                  className={`absolute -left-6 top-0 w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-mono-tnum font-bold transition-all ${
                    isBlocked
                      ? "bg-[var(--risk-critical-bg)] border-[var(--risk-critical)] text-[var(--risk-critical)]"
                      : isPending
                      ? "bg-[var(--risk-high-bg)] border-[var(--risk-high)] text-[var(--risk-high)]"
                      : isWaiting
                      ? "bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-muted)]"
                      : "bg-[var(--risk-low-bg)] border-[var(--risk-low)] text-[var(--risk-low)]"
                  }`}
                >
                  {isBlocked ? "✕" : isPending ? "⏳" : step.num}
                </div>

                {/* Step content */}
                <div className="ml-2 p-3 sm:p-4 rounded-xs bg-[var(--bg-secondary)]/50 border border-[var(--border)] space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono-tnum font-bold uppercase tracking-wider text-[var(--accent)]">
                        STEP 0{step.num}
                      </span>
                      <h3 className="text-xs font-bold text-[var(--text-primary)] font-mono-tnum">
                        {step.title}
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono-tnum text-[var(--text-muted)]">
                      {step.time}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)]">
                    {step.summary}
                  </p>

                  {/* Expandable Technical Detail */}
                  <div className="pt-2 border-t border-[var(--border-subtle)]">
                    <details className="group/detail text-xs font-mono-tnum">
                      <summary className="cursor-pointer text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] select-none">
                        Inspect Technical Structure
                      </summary>
                      <pre className="mt-2 p-2.5 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] text-[11px] overflow-x-auto text-[var(--text-primary)]">
                        {prettyJson(step.detail)}
                      </pre>
                    </details>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inspect Payload Drawer / Box */}
      <div className="p-4 sm:p-5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Tool Invocation Payload Schema
            </h3>
          </div>
          <button
            onClick={() => handleCopy(JSON.stringify(run.payload, null, 2))}
            className="inline-flex items-center gap-1 text-[11px] font-mono-tnum text-[var(--accent)] hover:underline"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[var(--risk-low)]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy Payload"}</span>
          </button>
        </div>

        <pre className="p-3 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] font-mono-tnum text-xs text-[var(--text-primary)] overflow-x-auto">
          {prettyJson(run.payload)}
        </pre>
      </div>
    </div>
  );
}
