"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Copy,
  Check,
  FileCheck,
  Layers,
  Bot,
  Wrench,
  Clock,
  ArrowRight,
  Database,
  ExternalLink,
} from "lucide-react";
import { RiskBadge, DecisionBadge } from "@/components/ui/Badges";
import { prettyJson } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ApprovalDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const ticketId = resolvedParams.id;

  const [decisionState, setDecisionState] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Mock / Synthesized target approval data matching ticket
  const isPurge = ticketId.toLowerCase().includes("purge") || ticketId.toLowerCase().includes("repo");
  const toolName = isPurge ? "github.delete_repository" : "mcp.delete_customer";
  const application = isPurge ? "GitHub Enterprise" : "Custom MCP (PostgreSQL)";
  const agent = isPurge ? "DevOps Sentinel Agent" : "Customer CRM Autonomous Agent";
  const requestedBy = isPurge ? "devops-lead@sentinel.corp" : "crm-support@sentinel.corp";
  const riskScore = isPurge ? 98 : 88;
  const riskLevel = isPurge ? "CRITICAL" : "HIGH";
  const resource = isPurge ? "repo: mcp-sentinel-corp/sentinel-prod-backend-v1" : "customer_id: 10842 (Enterprise Tier)";
  const policyName = isPurge ? "Repository Protection Policy (pol_repo_guard)" : "Production Data Protection (pol_prod_data)";

  const consequenceText = isPurge
    ? "Approving this action will permanently execute github.delete_repository. All source code, Git revision history, open pull requests, and CI/CD secrets for 'sentinel-prod-backend-v1' will be irreversibly erased from GitHub Enterprise."
    : "Approving this action will permanently execute delete_customer against production database instance 'mcp_sentinel_db'. All customer personal data, historical order associations, and contact addresses for customer ID 10842 will be permanently purged in accordance with GDPR Right to Erasure.";

  const handleApprove = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setDecisionState("APPROVED");
      setIsProcessing(false);
    }, 600);
  };

  const handleReject = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setDecisionState("REJECTED");
      setIsProcessing(false);
    }, 600);
  };

  const handleCopy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="pb-5 border-b border-[var(--border)] flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] mb-1">
            <Link href="/approvals" className="hover:text-[var(--text-primary)] flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" />
              <span>APPROVAL QUEUE</span>
            </Link>
            <span>/</span>
            <span className="font-bold text-[var(--text-primary)]">{ticketId}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[var(--risk-high)]" />
            <span>Dual-Custody Security Decision</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Review requested tool execution consequences and cryptographic parameter binding before authorization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/approvals"
            className="px-3 py-1.5 rounded-xs text-xs font-medium border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-2xs"
          >
            Back to Queue
          </Link>
        </div>
      </div>

      {/* PROMINENT "SECURITY DECISION" SECTION */}
      <div className={`p-5 rounded-xs border shadow-2xs space-y-4 ${
        riskLevel === "CRITICAL"
          ? "bg-[var(--risk-critical-bg)]/40 border-[var(--risk-critical-border)]"
          : "bg-[var(--risk-high-bg)]/30 border-[var(--risk-high-border)]"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--border-subtle)] gap-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              AUTHORITATIVE SECURITY DECISION
            </h2>
          </div>
          <span className="px-2 py-0.5 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] font-mono-tnum text-[11px] font-bold text-[var(--text-primary)]">
            TICKET: {ticketId}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono-tnum text-xs">
          <div className="p-3 rounded-xs bg-[var(--bg-card)] border border-[var(--border)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Risk Score</span>
            <span className="text-lg font-bold text-[var(--risk-critical)] block">{riskScore} / 100</span>
          </div>
          <div className="p-3 rounded-xs bg-[var(--bg-card)] border border-[var(--border)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Risk Level</span>
            <span className="text-lg font-bold text-[var(--risk-high)] block">{riskLevel}</span>
          </div>
          <div className="p-3 rounded-xs bg-[var(--bg-card)] border border-[var(--border)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Required Approval</span>
            <span className="text-lg font-bold text-[var(--risk-critical)] block">YES</span>
          </div>
          <div className="p-3 rounded-xs bg-[var(--bg-card)] border border-[var(--border)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Precedence Lock</span>
            <span className="text-lg font-bold text-[var(--accent)] block">DENY &gt; MFA</span>
          </div>
        </div>

        <div className="p-3 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] space-y-1 font-mono-tnum text-xs">
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--text-muted)]">Active Enforcing Policy:</span>
            <span className="font-bold text-[var(--text-primary)]">{policyName}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--text-muted)]">Target Resource Scope:</span>
            <span className="font-bold text-[var(--accent)]">{resource}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--text-muted)]">Parameter Integrity Seal:</span>
            <span className="text-[var(--risk-low)] font-semibold">SHA-256 HMAC Sealed</span>
          </div>
        </div>
      </div>

      {/* "WHAT WILL HAPPEN IF APPROVED?" SECTION */}
      <div className="p-5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)]">
          <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
            What will happen if approved?
          </h3>
        </div>

        <p className="text-xs text-[var(--text-primary)] leading-relaxed bg-[var(--bg-secondary)] p-3 rounded-xs border border-[var(--border)]">
          {consequenceText}
        </p>

        <div className="text-[11px] font-mono-tnum text-[var(--text-muted)] space-y-1 pt-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--risk-low)] flex-shrink-0" />
            <span>Single-use authorization token generated with 1-hour expiration timestamp.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--risk-low)] flex-shrink-0" />
            <span>Dispatch payload verified against frozen parameter hash before delivery.</span>
          </div>
        </div>
      </div>

      {/* Structured Details: Request, Policy, Risk, Resource, Impact, Agent, App, Tool */}
      <div className="p-5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-4">
        <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider pb-2 border-b border-[var(--border-subtle)]">
          Contextual Invariant Specification
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-tnum">
          <div className="space-y-2">
            <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Requesting Agent:</span>
              <span className="font-semibold text-[var(--text-primary)]">{agent}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Connected Application:</span>
              <span className="font-semibold text-[var(--accent)]">{application}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Tool Candidate:</span>
              <code className="text-[var(--accent)] font-bold">{toolName}</code>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Requested By:</span>
              <span className="text-[var(--text-primary)]">{requestedBy}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Execution Boundary:</span>
              <span className="font-semibold text-[var(--risk-critical)]">PRODUCTION</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Action Classification:</span>
              <span className="font-semibold text-[var(--risk-critical)]">DESTRUCTIVE (PURGE)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Reversibility:</span>
              <span className="font-semibold text-[var(--risk-critical)]">IRREVERSIBLE</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Current State:</span>
              <span className="font-bold text-[var(--text-primary)]">{decisionState}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Decision Actions Deck */}
      <div className="p-5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-4">
        <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider pb-2 border-b border-[var(--border-subtle)]">
          Operator Decision & Notes
        </h3>

        {decisionState === "PENDING" ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Decision Audit Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Document verification steps, ticket references, or justification..."
                className="w-full p-2.5 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
              <button
                onClick={handleReject}
                disabled={isProcessing}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xs text-xs font-semibold border border-[var(--risk-critical-border)] bg-[var(--risk-critical-bg)] text-[var(--risk-critical)] hover:opacity-90 transition-all disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject & Block Execution</span>
              </button>

              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xs text-xs font-semibold bg-[var(--risk-low)] text-white hover:opacity-95 transition-all shadow-2xs disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve & Sign Single-Use Token</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between font-mono-tnum text-xs">
            <div className="flex items-center gap-2">
              {decisionState === "APPROVED" ? (
                <CheckCircle2 className="w-5 h-5 text-[var(--risk-low)]" />
              ) : (
                <XCircle className="w-5 h-5 text-[var(--risk-critical)]" />
              )}
              <div>
                <span className="font-bold text-[var(--text-primary)] block">
                  Action has been {decisionState}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  Cryptographic decision recorded to immutable audit log.
                </span>
              </div>
            </div>
            <Link
              href="/audit"
              className="text-xs font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1"
            >
              <span>Inspect Audit Trail</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
