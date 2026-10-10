"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { api, ApprovalRecord } from "@/lib/api";
import { formatTime, riskBadgeClass, decisionBadgeClass } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ApprovalDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const ticketId = resolvedParams.id;

  const [ticket, setTicket] = useState<ApprovalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const loadTicket = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.approvals.get(ticketId);
      setTicket(data);
    } catch (err: unknown) {
      console.warn("Failed to load approval ticket:", err);
      setError(`Ticket "${ticketId}" could not be retrieved from the Sentinel database.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTicket();
  }, [ticketId]);

  const handleDecision = async (decision: "approve" | "deny") => {
    if (!ticket) return;
    setIsProcessing(true);
    setActionFeedback(null);
    try {
      const idToAct = ticket.ticket_id || ticket.id || ticketId;
      let res: ApprovalRecord;
      if (decision === "approve") {
        res = await api.approvals.approve(idToAct, decisionNotes || "Authorized via Dual-Custody Detail View");
        setActionFeedback("Ticket approved. Execution authorized.");
      } else {
        res = await api.approvals.deny(idToAct, decisionNotes || "Denied via Dual-Custody Detail View");
        setActionFeedback("Ticket denied and quarantined.");
      }
      setTicket(res);
      setDecisionNotes("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Action failed.";
      setActionFeedback(`Error: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-12 text-center font-label-mono text-on-surface-variant">
        Loading escrow sign-off record for {ticketId}...
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="w-full max-w-3xl mx-auto p-8 text-center space-y-4 font-label-mono">
        <div className="w-12 h-12 rounded-full bg-error-container text-on-error-container mx-auto flex items-center justify-center">
          <span className="material-symbols-outlined text-[24px]">error</span>
        </div>
        <h2 className="font-headline-md text-on-surface font-bold">Escrow Ticket Not Found</h2>
        <p className="text-body-sm text-on-surface-variant">{error || `No ticket found for ID: ${ticketId}`}</p>
        <Link
          href="/approvals"
          className="inline-block px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-ui text-label-ui font-semibold"
        >
          ← Back to Approval Queue
        </Link>
      </div>
    );
  }

  const isPending = ticket.status === "PENDING";

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-xl max-w-5xl mx-auto">
      {/* Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/approvals"
          className="flex items-center gap-1 font-label-mono text-label-mono text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Approvals Queue</span>
        </Link>
        <span className="font-label-mono text-label-mono px-space-xs py-0.5 rounded bg-surface-container text-on-surface-variant">
          Ticket: {ticket.ticket_id || ticket.id}
        </span>
      </div>

      {/* Action Feedback */}
      {actionFeedback && (
        <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container font-label-mono text-label-mono text-on-surface flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
            <span>{actionFeedback}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="cursor-pointer font-bold text-on-surface-variant hover:text-on-surface">
            ✕
          </button>
        </div>
      )}

      {/* Main Security Decision Card */}
      <section className="bg-surface-container-lowest p-space-lg sm:p-space-xl rounded-xl shadow-xs border border-surface-container space-y-space-lg">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-space-md pb-space-md border-b border-surface-container">
          <div>
            <div className="flex items-center gap-space-xs font-label-mono text-[11px] text-on-surface-variant mb-1">
              <span className="font-bold text-primary">{ticket.ticket_id || ticket.id}</span>
              <span>•</span>
              <span>{formatTime(ticket.created_at)}</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              Dual-Custody Decision: {ticket.tool_name}
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Requested by <strong className="text-on-surface">{ticket.requester_id || ticket.agent_id || "Agent"}</strong> in {ticket.environment}
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5 font-label-mono text-label-mono">
            <span className={`px-space-sm py-1 rounded font-bold text-xs ${decisionBadgeClass(ticket.status)}`}>
              {ticket.status}
            </span>
            <span className={`px-space-xs py-0.5 rounded font-semibold text-[11px] ${riskBadgeClass(ticket.risk_level)}`}>
              RISK: {ticket.risk_level} ({ticket.risk_score}/100)
            </span>
          </div>
        </div>

        {/* Security Consequence Box */}
        <div className="p-space-md bg-error-container/20 rounded-xl border border-error/30 flex items-start gap-space-sm">
          <span className="material-symbols-outlined text-error text-[22px] shrink-0 mt-0.5">warning</span>
          <div className="space-y-1">
            <div className="font-label-mono text-label-mono font-bold text-error uppercase tracking-wider">
              Irreversible Operational Impact Warning
            </div>
            <p className="font-body-sm text-body-sm text-on-surface">
              Approving this operation permanently executes <code className="font-bold font-label-mono">{ticket.tool_name}</code> with target parameters. Dual-custody authorization requires explicit review of the bound payload.
            </p>
          </div>
        </div>

        {/* 4-Stat Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm font-label-mono text-label-mono">
          <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
            <span className="text-[10px] text-on-surface-variant uppercase">Policy Governing</span>
            <div className="font-bold text-on-surface mt-0.5 truncate">{ticket.policy_id}</div>
          </div>
          <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
            <span className="text-[10px] text-on-surface-variant uppercase">Target Resource</span>
            <div className="font-bold text-secondary mt-0.5 truncate">{ticket.target_id || "Postgres Cluster"}</div>
          </div>
          <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
            <span className="text-[10px] text-on-surface-variant uppercase">Expires At</span>
            <div className="font-bold text-on-surface mt-0.5">{formatTime(ticket.expires_at)}</div>
          </div>
          <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
            <span className="text-[10px] text-on-surface-variant uppercase">Request ID</span>
            <div className="font-bold text-on-surface mt-0.5 truncate">{ticket.request_id || "N/A"}</div>
          </div>
        </div>

        {/* Bound Parameters & Signature */}
        <div>
          <span className="font-label-mono text-[10px] text-on-surface-variant uppercase font-semibold">
            Cryptographically Bound Parameters
          </span>
          <pre className="mt-1 p-space-md bg-surface-container rounded-lg font-label-mono text-code-sm text-on-surface overflow-x-auto border border-surface-container">
            {JSON.stringify(ticket.parameters || {}, null, 2)}
          </pre>
          {ticket.parameter_hash && (
            <div className="mt-2 font-label-mono text-[11px] text-on-surface-variant">
              <strong>Parameter Hash (SHA-256):</strong> <code>{ticket.parameter_hash}</code>
            </div>
          )}
          {ticket.signature && (
            <div className="font-label-mono text-[11px] text-on-surface-variant">
              <strong>HMAC-SHA256 Signature:</strong> <code>{ticket.signature}</code>
            </div>
          )}
        </div>

        {/* Sign-Off Console */}
        {isPending ? (
          <div className="pt-space-md border-t border-surface-container space-y-space-sm">
            <label className="font-label-mono text-[10px] text-on-surface-variant uppercase font-semibold">
              Officer Review Notes / Justification
            </label>
            <textarea
              rows={3}
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              placeholder="State rationale for authorizing or rejecting this tool dispatch..."
              className="w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant p-space-sm rounded-lg font-body-sm text-body-sm border border-surface-container outline-hidden focus:bg-surface-container"
            />
            <div className="flex items-center gap-space-sm pt-2">
              <button
                onClick={() => void handleDecision("approve")}
                disabled={isProcessing}
                className="px-space-lg py-2.5 bg-primary text-on-primary font-label-ui text-label-ui font-bold rounded-lg hover:bg-primary-container transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
                <span>Authorize &amp; Execute Action</span>
              </button>
              <button
                onClick={() => void handleDecision("deny")}
                disabled={isProcessing}
                className="px-space-lg py-2.5 bg-surface-container-high text-on-surface font-label-ui text-label-ui font-semibold rounded-lg hover:bg-error-container hover:text-on-error-container transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">block</span>
                <span>Deny &amp; Quarantine</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-space-md border-t border-surface-container font-label-mono text-label-mono text-on-surface-variant">
            Decision completed: <strong className="text-on-surface">{ticket.status}</strong>
            {ticket.decision_notes && <div className="mt-1">Notes: &ldquo;{ticket.decision_notes}&rdquo;</div>}
          </div>
        )}
      </section>
    </div>
  );
}
