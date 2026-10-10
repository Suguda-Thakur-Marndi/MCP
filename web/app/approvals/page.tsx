"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { api, ApprovalRecord, CurrentUser } from "@/lib/api";
import { formatTime, riskBadgeClass, decisionBadgeClass } from "@/lib/utils";

export default function ApprovalsPage() {
  const [, startTransition] = useTransition();

  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"PENDING" | "APPROVED" | "DENIED" | "ALL">("PENDING");
  const [selectedTicket, setSelectedTicket] = useState<ApprovalRecord | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  // Decision controls
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Authoritative counts from backend
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    denied: 0,
    all: 0,
  });

  const loadData = useCallback(async (tab: "PENDING" | "APPROVED" | "DENIED" | "ALL", showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      let records: ApprovalRecord[] = [];
      if (tab === "PENDING") {
        records = await api.approvals.pending();
      } else if (tab === "ALL") {
        records = await api.approvals.list({ limit: 100 });
      } else {
        const hist = await api.approvals.list({ limit: 100 });
        records = hist.filter((r) => r.status.toUpperCase() === tab);
      }

      // Also get overall totals
      const [pendingList, allList] = await Promise.all([
        api.approvals.pending().catch(() => []),
        api.approvals.list({ limit: 100 }).catch(() => []),
      ]);

      const approvedCount = allList.filter((r) => r.status.toUpperCase() === "APPROVED").length;
      const deniedCount = allList.filter((r) => r.status.toUpperCase() === "DENIED").length;

      startTransition(() => {
        setApprovals(records);
        setCounts({
          pending: pendingList.length,
          approved: approvedCount,
          denied: deniedCount,
          all: allList.length,
        });
        setError(null);
        if (records.length > 0) {
          setSelectedTicket((prev) => {
            if (prev) {
              const matched = records.find((r) => r.id === prev.id || r.ticket_id === prev.ticket_id);
              if (matched) return matched;
            }
            return records[0];
          });
        } else {
          setSelectedTicket(null);
        }
        setLoading(false);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load approval queue";
      startTransition(() => {
        setError(msg);
        setLoading(false);
      });
    }
  }, []);

  useEffect(() => {
    api.auth.me().then(setCurrentUser).catch(() => {});
    void loadData(filterTab, true);
  }, [filterTab, loadData]);

  const handleDecision = async (action: "approve" | "deny") => {
    if (!selectedTicket) return;
    setActionLoading(true);
    setActionFeedback(null);
    try {
      const idToAct = selectedTicket.ticket_id || selectedTicket.id || "";
      if (!idToAct) return;
      if (action === "approve") {
        await api.approvals.approve(idToAct, reviewNotes || "Authorized via Dual-Custody Approval Console");
        setActionFeedback(`Ticket ${idToAct} approved. Operation unlocked.`);
      } else {
        await api.approvals.deny(idToAct, reviewNotes || "Rejected and quarantined by Authorizing Officer");
        setActionFeedback(`Ticket ${idToAct} denied and logged.`);
      }
      setReviewNotes("");
      await loadData(filterTab, false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit decision.";
      setActionFeedback(`Error: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredApprovals = approvals.filter((appr) => {
    if (severityFilter !== "ALL" && appr.risk_level !== severityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        appr.tool_name.toLowerCase().includes(q) ||
        (appr.requester_id && appr.requester_id.toLowerCase().includes(q)) ||
        (appr.agent_id && appr.agent_id.toLowerCase().includes(q)) ||
        (appr.ticket_id && appr.ticket_id.toLowerCase().includes(q)) ||
        (appr.id && appr.id.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-xl">
      {/* Header Banner */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-sm mb-space-xxs">
            <span className="font-label-mono text-label-mono text-primary font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              HUMAN-IN-THE-LOOP DUAL CUSTODY
            </span>
            <span className="font-label-mono text-label-mono px-space-xs py-0.5 rounded bg-surface-container text-on-surface-variant">
              NIST 800-53 AC-3 ENFORCED
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
            Escrow Sign-Off &amp; Approvals Queue
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Strict human verification for destructive tool calls, sensitive PII transfers, and privileged credentials
          </p>
        </div>

        <div className="flex items-center gap-space-xs font-label-mono text-label-mono">
          <button
            onClick={() => void loadData(filterTab, true)}
            className="px-space-md py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Refresh Queue</span>
          </button>
        </div>
      </section>

      {/* Feedback Toast */}
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

      {/* Queue Tabs & Filters */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-xs font-label-mono text-label-mono bg-surface-container-low p-1 rounded-xl border border-surface-container">
          {(["PENDING", "APPROVED", "DENIED", "ALL"] as const).map((tab) => {
            const count =
              tab === "PENDING"
                ? counts.pending
                : tab === "APPROVED"
                ? counts.approved
                : tab === "DENIED"
                ? counts.denied
                : counts.all;
            return (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`px-space-md py-1.5 rounded-lg transition-all cursor-pointer font-semibold ${
                  filterTab === tab
                    ? "bg-surface-container-lowest text-on-surface shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {tab} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-space-sm font-label-mono text-label-mono">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticket, tool, agent..."
              className="bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant px-space-md py-1.5 pl-8 rounded-lg font-body-sm text-body-sm border border-surface-container outline-hidden focus:bg-surface-container-low w-48 sm:w-64"
            />
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant absolute left-2.5 top-2.5 pointer-events-none">
              search
            </span>
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-surface-container-lowest text-on-surface px-space-md py-1.5 rounded-lg border border-surface-container outline-hidden cursor-pointer"
          >
            <option value="ALL">Severity: All</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>
      </section>

      {/* Main 2-Column Split: Ticket List (7 cols) + Action Inspector (5 cols) */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* Left: Ticket Cards List */}
        <div className="xl:col-span-7 flex flex-col gap-space-sm">
          {loading ? (
            <div className="bg-surface-container-lowest p-12 rounded-xl text-center font-label-mono text-on-surface-variant border border-surface-container">
              Loading approval tickets from Sentinel API...
            </div>
          ) : filteredApprovals.length === 0 ? (
            <div className="bg-surface-container-lowest p-12 rounded-xl text-center space-y-2 border border-surface-container">
              <div className="w-10 h-10 rounded-full bg-secondary-container text-secondary mx-auto flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">done_all</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Queue Empty</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm mx-auto">
                No tickets matching {filterTab} status. All autonomous agent calls are within permitted boundaries.
              </p>
            </div>
          ) : (
            filteredApprovals.map((ticket) => {
              const isSelected = selectedTicket?.id === ticket.id || selectedTicket?.ticket_id === ticket.ticket_id;
              const isCritical = ticket.risk_level === "CRITICAL" || ticket.risk_score >= 80;

              return (
                <div
                  key={ticket.id || ticket.ticket_id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`bg-surface-container-lowest p-space-md rounded-xl shadow-xs transition-all cursor-pointer border relative overflow-hidden group ${
                    isSelected
                      ? "border-primary/50 shadow-md bg-surface-container-low/40"
                      : "border-surface-container hover:border-border hover:shadow-xs"
                  }`}
                >
                  {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}

                  <div className="flex items-start justify-between gap-space-sm">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-space-xs font-label-mono text-[11px] text-on-surface-variant mb-1">
                        <span className="font-bold text-primary">{ticket.ticket_id || (ticket.id ? ticket.id.slice(0, 12) : "ticket")}</span>
                        <span>•</span>
                        <span>{ticket.tool_name}</span>
                        <span>•</span>
                        <span>{formatTime(ticket.created_at)}</span>
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                        {ticket.action || ticket.tool_name}
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 line-clamp-1">
                        {ticket.reason || "Operation requires explicit human verification."}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0 font-label-mono text-label-mono">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${decisionBadgeClass(ticket.status)}`}>
                        {ticket.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${riskBadgeClass(ticket.risk_level)}`}>
                        {ticket.risk_level} ({ticket.risk_score})
                      </span>
                    </div>
                  </div>

                  <div className="mt-space-sm pt-space-xs border-t border-surface-container flex items-center justify-between font-label-mono text-[10px] text-on-surface-variant">
                    <span>Requester: {ticket.requester_id || ticket.agent_id || "agent"}</span>
                    <Link
                      href={`/approvals/${ticket.ticket_id || ticket.id}`}
                      className="text-primary hover:underline font-semibold"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Detail Page →
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Selected Ticket Inspector Pane */}
        <div className="xl:col-span-5 bg-surface-container-lowest p-space-lg sm:p-space-xl rounded-xl shadow-xs border border-surface-container sticky top-20 flex flex-col gap-space-md">
          {selectedTicket ? (
            <>
              <div className="flex items-center justify-between pb-space-sm border-b border-surface-container">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-[20px]">shield</span>
                  <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                    Escrow Verification Pane
                  </h2>
                </div>
                <span className={`font-label-mono text-label-mono px-space-xs py-0.5 rounded font-bold ${decisionBadgeClass(selectedTicket.status)}`}>
                  {selectedTicket.status}
                </span>
              </div>

              <div>
                <span className="font-label-mono text-[10px] text-on-surface-variant uppercase font-semibold">
                  Ticket Reference
                </span>
                <div className="font-label-mono text-body-md text-on-surface font-bold break-all">
                  {selectedTicket.ticket_id || selectedTicket.id}
                </div>
              </div>

              {/* Consequence Alert */}
              <div className="p-space-sm bg-error-container/20 rounded-lg border border-error/30 text-on-surface font-body-sm text-body-sm flex items-start gap-space-xs">
                <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">warning</span>
                <div>
                  <strong className="text-error font-semibold">Security Consequence:</strong> Authorizing this action executes{" "}
                  <code className="font-label-mono font-bold">{selectedTicket.tool_name}</code> directly against the production runtime with parameters shown below.
                </div>
              </div>

              {/* Parameters payload */}
              <div>
                <span className="font-label-mono text-[10px] text-on-surface-variant uppercase font-semibold">
                  Parameters &amp; Cryptographic Hash
                </span>
                <pre className="mt-1 p-space-sm bg-surface-container rounded-lg font-label-mono text-code-sm text-on-surface overflow-x-auto border border-surface-container max-h-48">
                  {JSON.stringify(selectedTicket.parameters || {}, null, 2)}
                </pre>
                {selectedTicket.parameter_hash && (
                  <div className="mt-1 font-label-mono text-[10px] text-on-surface-variant truncate">
                    SHA-256: {selectedTicket.parameter_hash}
                  </div>
                )}
              </div>

              {/* Decision Section if PENDING */}
              {selectedTicket.status === "PENDING" && (
                <div className="pt-space-sm border-t border-surface-container flex flex-col gap-space-sm">
                  <label className="font-label-mono text-[10px] text-on-surface-variant uppercase font-semibold">
                    Decision Justification Note
                  </label>
                  <textarea
                    rows={2}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Enter audit rationale for approval or denial..."
                    className="w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant p-space-sm rounded-lg font-body-sm text-body-sm border border-surface-container outline-hidden focus:bg-surface-container"
                  />

                  <div className="grid grid-cols-2 gap-space-sm pt-1">
                    <button
                      onClick={() => void handleDecision("approve")}
                      disabled={actionLoading}
                      className="py-2 bg-primary text-on-primary font-label-ui text-label-ui font-bold rounded-lg hover:bg-primary-container transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">check</span>
                      Authorize Action
                    </button>
                    <button
                      onClick={() => void handleDecision("deny")}
                      disabled={actionLoading}
                      className="py-2 bg-surface-container-high text-on-surface font-label-ui text-label-ui font-semibold rounded-lg hover:bg-error-container hover:text-on-error-container transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">block</span>
                      Deny &amp; Quarantine
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center font-label-mono text-on-surface-variant text-body-sm">
              Select an escrow ticket to view cryptographic parameters and decision controls.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
