"use client";

import { useEffect, useState } from "react";
import { api, ApprovalRecord } from "@/lib/api";
import {
  statusBadgeClass,
  riskBadgeClass,
  formatDate,
  prettyJson,
} from "@/lib/utils";

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("PENDING");
  const [selectedTicket, setSelectedTicket] = useState<ApprovalRecord | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchApprovals = async (status?: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.approvals.list({
        status: status && status !== "ALL" ? status : undefined,
      });
      setApprovals(res);
      if (res.length > 0 && !selectedTicket) {
        setSelectedTicket(res[0]);
      } else if (res.length > 0 && selectedTicket) {
        const found = res.find((r) => r.ticket_id === selectedTicket.ticket_id);
        setSelectedTicket(found || res[0]);
      } else {
        setSelectedTicket(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals(filterStatus);
  }, [filterStatus]);

  const handleApprove = async (ticketId: string) => {
    try {
      setActionLoading(true);
      setActionSuccess(null);
      await api.approvals.approve(ticketId, actionNotes || "Approved via Security Console");
      setActionSuccess(`Ticket ${ticketId} approved successfully`);
      setActionNotes("");
      await fetchApprovals(filterStatus);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeny = async (ticketId: string) => {
    try {
      setActionLoading(true);
      setActionSuccess(null);
      await api.approvals.deny(ticketId, actionNotes || "Denied by Security Admin via Console");
      setActionSuccess(`Ticket ${ticketId} denied`);
      setActionNotes("");
      await fetchApprovals(filterStatus);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Denial failed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Human-in-the-Loop Gating Inbox
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
              CRYPTOGRAPHIC BINDING
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Review pending destructive actions. Tickets are bound by SHA-256 parameter hashes and cannot be replayed or altered.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          {["ALL", "PENDING", "APPROVED", "DENIED", "COMPLETED"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filterStatus === st
                  ? "bg-sky-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-xs flex items-center justify-between" style={{ background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 rounded-lg text-xs flex items-center justify-between" style={{ background: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="font-bold">×</button>
        </div>
      )}

      {/* Main Content Layout: List on Left, Detail & Decision on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List */}
        <div className="lg:col-span-5 glass-card p-4 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-secondary)" }}>
              TICKETS ({approvals.length})
            </span>
            <button
              onClick={() => fetchApprovals(filterStatus)}
              className="text-xs text-sky-400 hover:underline"
            >
              Refresh
            </button>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {loading && (
              <div className="text-center py-12 text-xs" style={{ color: "var(--text-muted)" }}>
                Loading approval requests...
              </div>
            )}
            {!loading && approvals.length === 0 && (
              <div className="text-center py-12 text-xs" style={{ color: "var(--text-muted)" }}>
                No {filterStatus.toLowerCase()} tickets found.
              </div>
            )}
            {approvals.map((t) => {
              const isSelected = selectedTicket?.ticket_id === t.ticket_id;
              return (
                <div
                  key={t.ticket_id}
                  onClick={() => setSelectedTicket(t)}
                  className={`p-3 rounded-lg cursor-pointer transition-all border ${
                    isSelected
                      ? "border-sky-500 bg-sky-950/20"
                      : "border-slate-800 hover:border-slate-700 bg-slate-900/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs font-bold text-white truncate">
                      {t.tool_name}
                    </span>
                    <span className={statusBadgeClass(t.status)}>{t.status}</span>
                  </div>

                  <div className="text-xs text-slate-300 truncate mb-1">
                    Target: <code className="text-sky-300">{t.target_id}</code>
                  </div>

                  <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--text-muted)" }}>
                    <span className={riskBadgeClass(t.risk_level)}>
                      Risk: {t.risk_score} ({t.risk_level})
                    </span>
                    <span>{formatDate(t.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Detail Pane */}
        <div className="lg:col-span-7 glass-card p-6 space-y-6">
          {!selectedTicket ? (
            <div className="text-center py-24 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              Select a ticket from the left panel to inspect parameters and make decisions.
            </div>
          ) : (
            <>
              {/* Ticket Top Info */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-white font-mono">{selectedTicket.tool_name}</h2>
                    <span className={statusBadgeClass(selectedTicket.status)}>
                      {selectedTicket.status}
                    </span>
                  </div>
                  <div className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                    Ticket ID: <span className="text-white">{selectedTicket.ticket_id}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Environment</div>
                  <span className="px-2 py-0.5 rounded text-xs font-mono uppercase" style={{ background: "rgba(56, 189, 248, 0.1)", color: "var(--accent)" }}>
                    {selectedTicket.environment}
                  </span>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                  <div style={{ color: "var(--text-muted)" }}>Target ID</div>
                  <div className="font-mono font-medium text-white mt-0.5 truncate">{selectedTicket.target_id}</div>
                </div>
                <div className="p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                  <div style={{ color: "var(--text-muted)" }}>Action</div>
                  <div className="font-mono font-medium text-white mt-0.5 truncate">{selectedTicket.action}</div>
                </div>
                <div className="p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                  <div style={{ color: "var(--text-muted)" }}>Risk Score</div>
                  <div className="font-mono font-bold mt-0.5 text-amber-400">
                    {selectedTicket.risk_score} / 100
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                  <div style={{ color: "var(--text-muted)" }}>Policy Rule</div>
                  <div className="font-mono font-medium text-white mt-0.5 truncate">{selectedTicket.policy_id}</div>
                </div>
              </div>

              {/* Cryptographic Hash Binding Alert */}
              <div className="p-3.5 rounded-lg text-xs space-y-1" style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(56, 189, 248, 0.2)" }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-sky-400 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    SHA-256 Parameter Hash Binding
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Enforced at Execution</span>
                </div>
                <div className="font-mono text-[11px] text-slate-300 break-all bg-black/40 p-2 rounded border border-slate-800">
                  {selectedTicket.parameter_hash}
                </div>
              </div>

              {/* Gated Parameters Inspector */}
              <div>
                <div className="text-xs font-mono font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                  BOUND EXECUTION PARAMETERS (JSON)
                </div>
                <pre
                  className="p-3.5 rounded-lg text-xs font-mono overflow-x-auto text-emerald-400"
                  style={{ background: "#050914", border: "1px solid var(--border)" }}
                >
                  {prettyJson(selectedTicket.parameters)}
                </pre>
              </div>

              {/* Reason / Trigger Policy Context */}
              <div className="p-3 rounded-lg text-xs" style={{ background: "var(--bg-secondary)" }}>
                <span className="font-semibold text-slate-300">Policy Trigger Reason: </span>
                <span className="text-slate-400">{selectedTicket.reason}</span>
              </div>

              {/* Decision Action Area (If Pending) */}
              {selectedTicket.status === "PENDING" ? (
                <div className="p-4 rounded-xl space-y-3" style={{ background: "rgba(17, 24, 39, 0.6)", border: "1px solid var(--border-accent)" }}>
                  <div className="text-xs font-semibold text-white">
                    Approver Action Required
                  </div>

                  <input
                    type="text"
                    placeholder="Decision rationale notes (required for audit log)..."
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg text-white font-sans focus:outline-none"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                  />

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={() => handleApprove(selectedTicket.ticket_id)}
                      disabled={actionLoading}
                      className="btn-primary text-xs flex-1 flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      Approve & Authorize Token
                    </button>
                    <button
                      onClick={() => handleDeny(selectedTicket.ticket_id)}
                      disabled={actionLoading}
                      className="btn-danger text-xs flex-1 flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Deny & Fail Closed
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg text-xs" style={{ background: "var(--bg-secondary)" }}>
                  <div className="text-slate-400">
                    Decision: <span className="font-semibold text-white">{selectedTicket.status}</span>
                    {selectedTicket.approver_id && (
                      <span> by <code className="text-sky-300">{selectedTicket.approver_id}</code></span>
                    )}
                    {selectedTicket.decided_at && (
                      <span> at {formatDate(selectedTicket.decided_at)}</span>
                    )}
                  </div>
                  {selectedTicket.decision_notes && (
                    <div className="mt-1 text-slate-300 italic">"{selectedTicket.decision_notes}"</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
