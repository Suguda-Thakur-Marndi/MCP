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
      title: "APPROVAL GATING",
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
      title: "DISPATCH EXECUTION",
      status: run.executionState === "COMPLETED" ? "COMPLETED" : run.executionState === "BLOCKED" ? "BLOCKED" : "WAITING",
      summary: run.executionState === "COMPLETED" ? "Dispatched through MCP Gateway" : run.executionState === "BLOCKED" ? "Execution halted by SecurityGate" : "Suspended awaiting human sign-off",
      detail: run.executionResult || { status: run.executionState },
      time: `+${run.durationMs}ms`,
    },
    {
      num: 9,
      title: "RESULT VALIDATION",
      status: run.executionState === "COMPLETED" ? "COMPLETED" : "RECORDED",
      summary: run.executionResult ? "Payload returned from external software" : "State change prevented",
      detail: run.executionResult || { message: "No destructive state changes applied" },
      time: `+${run.durationMs + 40}ms`,
    },
    {
      num: 10,
      title: "FORENSIC AUDIT SEAL",
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
    <div className="p-3 sm:p-5 max-w-5xl mx-auto space-y-4 font-sans select-none animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-code-sm uppercase tracking-wider text-[var(--text-muted)] mb-1">
            <Link href="/agent-runs" className="hover:text-[var(--text-primary)] flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" />
              <span>AGENT RUNS</span>
            </Link>
            <span>/</span>
            <span className="font-bold text-[var(--primary)] font-mono">{run.id}</span>
          </div>

          <h1 className="font-headline-md text-lg sm:text-xl font-bold tracking-tight text-[var(--primary)] flex items-center gap-2">
            <span>EXECUTION TIMELINE</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded-xs bg-[var(--surface-container-high)] border border-[var(--border)] text-[var(--secondary-container)]">
              {run.id}
            </span>
          </h1>
          <p className="font-body-sm text-xs text-[var(--text-secondary)] mt-0.5">
            Step-by-step invariant trace through the Sentinel 10-stage security pipeline.
          </p>
        </div>

        {/* Quick Nav Links */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-code-sm self-start sm:self-auto">
          <Link
            href="/policies"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-high)] hover:border-[var(--secondary-container)] text-[var(--text-primary)]"
          >
            <span>View Policy</span>
            <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
          </Link>
          <Link
            href="/approvals"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-high)] hover:border-[var(--secondary-container)] text-[var(--text-primary)]"
          >
            <span>View Approval</span>
            <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
          </Link>
          <Link
            href="/audit"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-high)] hover:border-[var(--secondary-container)] text-[var(--text-primary)]"
          >
            <span>View Audit Event</span>
            <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
          </Link>
        </div>
      </div>

      {/* Identity Summary Deck */}
      <div className="p-3.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)]">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
          <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
            <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">AGENT IDENTITY</span>
            <span className="font-bold text-[var(--primary)] block truncate">{run.agentName}</span>
          </div>
          <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
            <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">REASONING MODEL</span>
            <span className="font-semibold text-[var(--text-primary)] block truncate">{run.model}</span>
          </div>
          <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
            <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">ENVIRONMENT</span>
            <span className="font-semibold text-[var(--text-primary)] block">{run.environment}</span>
          </div>
          <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
            <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">TARGET SOFTWARE</span>
            <span className="font-semibold text-[var(--secondary-container)] block">{run.application}</span>
          </div>
          <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
            <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">TOTAL DURATION</span>
            <span className="font-semibold text-[var(--text-primary)] block">{run.durationMs}ms</span>
          </div>
          <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
            <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">RISK SCORE</span>
            <span
              className={`font-bold block ${
                run.riskLevel === "CRITICAL"
                  ? "text-[var(--error)]"
                  : run.riskLevel === "HIGH"
                  ? "text-[var(--tertiary-fixed-dim)]"
                  : "text-[var(--primary-container)]"
              }`}
            >
              {run.riskLevel} ({run.riskScore})
            </span>
          </div>
        </div>
      </div>

      {/* 10-Step Execution Timeline */}
      <div className="rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] p-3.5 sm:p-5 space-y-4">
        <div className="pb-2 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-label-caps text-[9px] font-bold text-[var(--primary)] uppercase tracking-wider">
            DETERMINISTIC PIPELINE EXECUTION TRACE
          </h2>
          <span className="font-code-sm text-[10px] text-[var(--primary-container)] font-mono font-bold">
            VERIFIED HMAC SHA-256 TOKEN
          </span>
        </div>

        <div className="relative pl-6 space-y-4 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border)]">
          {steps.map((step) => {
            const isBlocked = step.status === "BLOCKED";
            const isPending = step.status === "PENDING";
            const isWaiting = step.status === "WAITING";

            return (
              <div key={step.num} className="relative group">
                {/* Node icon */}
                <div
                  className={`absolute -left-6 top-0 w-6 h-6 rounded-xs border flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                    isBlocked
                      ? "bg-[var(--error-container)] border-[var(--error)] text-[var(--on-error-container)]"
                      : isPending
                      ? "bg-[var(--tertiary-container)] border-[var(--tertiary-fixed-dim)] text-[var(--on-tertiary-container)]"
                      : isWaiting
                      ? "bg-[var(--surface-container-high)] border-[var(--border)] text-[var(--text-muted)]"
                      : "bg-[var(--primary-container)]/20 border-[var(--primary-container)] text-[var(--primary-container)]"
                  }`}
                >
                  {isBlocked ? "✕" : isPending ? "⏳" : step.num}
                </div>

                {/* Step content */}
                <div className="ml-2 p-3 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] space-y-1.5 hover:border-[var(--border-interactive)] transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-mono">
                    <div className="flex items-center gap-2">
                      <span className="font-label-caps text-[9px] font-bold uppercase tracking-wider text-[var(--secondary-container)]">
                        STAGE 0{step.num}
                      </span>
                      <h3 className="text-xs font-bold text-[var(--primary)]">
                        {step.title}
                      </h3>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {step.time}
                    </span>
                  </div>

                  <p className="font-body-sm text-xs text-[var(--text-secondary)]">
                    {step.summary}
                  </p>

                  {/* Expandable Technical Detail */}
                  <div className="pt-1.5 border-t border-[var(--border)]">
                    <details className="group/detail text-xs font-code-sm">
                      <summary className="cursor-pointer text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] select-none">
                        Inspect Technical Structure
                      </summary>
                      <pre className="mt-1.5 p-2 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] text-[10px] font-mono overflow-x-auto text-[var(--text-primary)]">
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
      <div className="p-3.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] space-y-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-[var(--secondary-container)]" />
            <h3 className="font-label-caps text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              TOOL INVOCATION PAYLOAD SCHEMA
            </h3>
          </div>
          <button
            onClick={() => handleCopy(JSON.stringify(run.payload, null, 2))}
            className="flex items-center gap-1 font-code-sm text-[10px] text-[var(--secondary-container)] hover:underline font-mono cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[var(--primary-container)]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy Payload"}</span>
          </button>
        </div>

        <pre className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] font-mono text-[10px] text-[var(--text-primary)] overflow-x-auto">
          {prettyJson(run.payload)}
        </pre>
      </div>
    </div>
  );
}
