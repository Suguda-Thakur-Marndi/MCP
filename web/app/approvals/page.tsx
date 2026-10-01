"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  AlertTriangle,
  Fingerprint,
  RefreshCw,
  Search,
  Lock,
  UserCheck,
  X,
  Terminal,
} from "lucide-react";
import { api, ApprovalRecord, CurrentUser } from "@/lib/api";
import { formatDate, prettyJson, shortId } from "@/lib/utils";

const STATUS_FILTERS = [
  { label: "Pending Review", value: "PENDING" },
  { label: "Approved / Executed", value: "APPROVED" },
  { label: "Denied / Blocked", value: "DENIED" },
  { label: "All Tickets", value: "ALL" },
];

export default function ApprovalsPage() {
  const [, startTransition] = useTransition();
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("PENDING");
  const [selectedTicket, setSelectedTicket] = useState<ApprovalRecord | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const fetchApprovals = useCallback(async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      let records: ApprovalRecord[] = [];
      if (status === "PENDING") {
        records = await api.approvals.pending();
      } else {
        const hist: ApprovalRecord[] = await api.approvals.list({ limit: 100 });
        if (status === "ALL") {
          records = hist;
        } else {
          records = hist.filter((r: ApprovalRecord) => r.status.toUpperCase() === status);
        }
      }

      startTransition(() => {
        setApprovals(records);
        if (records.length > 0) {
          setSelectedTicket((prev) => {
            const found = prev ? records.find((r) => r.ticket_id === prev.ticket_id) : null;
            return found || records[0];
          });
        } else {
          setSelectedTicket(null);
        }
      });
    } catch (err: any) {
      setError(err.message || "Failed to load approval queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.auth.me().then(setCurrentUser).catch(() => {});
    fetchApprovals(filterStatus);
  }, [fetchApprovals, filterStatus]);

  const handleApprove = async (ticketId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await api.approvals.approve(ticketId, actionNotes || "Approved via Tactical Operations Console");
      setActionSuccess(`Ticket #${shortId(ticketId)} authorized & dispatched.`);
      setActionNotes("");
      fetchApprovals(filterStatus);
    } catch (err: any) {
      setError(err.message || "Approval execution failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeny = async (ticketId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await api.approvals.deny(ticketId, actionNotes || "Aborted by Security Operator");
      setActionSuccess(`Ticket #${shortId(ticketId)} denied & quarantined.`);
      setActionNotes("");
      fetchApprovals(filterStatus);
    } catch (err: any) {
      setError(err.message || "Denial action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredApprovals = approvals.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      a.ticket_id.toLowerCase().includes(q) ||
      a.tool_name.toLowerCase().includes(q) ||
      (a.reason && a.reason.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 font-sans select-none animate-in fade-in duration-150">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase tracking-widest">
              MISSION CONTROL // HUMAN ESCROW GATEWAY
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--tertiary-fixed-dim)] animate-pulse" />
            <span className="font-code-sm text-[10px] text-[var(--tertiary-fixed-dim)] font-bold">DUAL-CUSTODY GATING</span>
          </div>
          <h1 className="font-headline-md text-lg sm:text-xl font-bold tracking-tight text-[var(--primary)]">
            APPROVAL QUEUE & ESCROW INTERCEPTION
          </h1>
          <p className="font-body-sm text-xs text-[var(--text-secondary)] mt-0.5">
            Strict human-in-the-loop authorization. Elevated-risk MCP tool calls are paused at Gate 6 with cryptographic parameter hash binding.
          </p>
        </div>

        <button
          onClick={() => fetchApprovals(filterStatus)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs font-code-sm text-xs border border-[var(--border-interactive)] bg-[var(--surface-container-high)] text-[var(--text-primary)] hover:border-[var(--primary-container)] transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>REFRESH ESCROW</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {actionSuccess && (
        <div className="p-2.5 rounded-xs bg-[var(--primary-container)]/10 border border-[var(--primary-container)]/30 text-[var(--primary-container)] font-code-sm text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="font-bold">{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-2.5 rounded-xs bg-[var(--error-container)]/20 border border-[var(--error)]/40 text-[var(--error)] font-code-sm text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Status Filter Tabs & Search Bar */}
      <div className="p-2.5 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-1 font-mono-tnum text-xs overflow-x-auto pb-1 sm:pb-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={`px-2.5 py-1 rounded-xs font-label-caps text-[10px] transition-colors ${
                filterStatus === f.value
                  ? "bg-[var(--primary-container)] text-[var(--on-primary)] font-bold shadow-xs"
                  : "bg-[var(--surface-container-high)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tickets by ID or tool..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] font-code-sm text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--secondary-container)]"
          />
        </div>
      </div>

      {/* Master-Detail Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column (5 Cols): Scannable Ticket List */}
        <div className="lg:col-span-5 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] p-2.5 shadow-sm space-y-2">
          <div className="px-1.5 py-1 font-label-caps text-[9px] uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between border-b border-[var(--border)]">
            <span>ESCROW TICKETS ({filteredApprovals.length})</span>
            <span className="font-mono-tnum">FILTER: {filterStatus}</span>
          </div>

          <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-[var(--text-muted)] font-code-sm text-xs">
                Scanning cryptographic escrow database...
              </div>
            ) : filteredApprovals.length === 0 ? (
              <div className="p-8 text-center space-y-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
                <CheckCircle2 className="w-6 h-6 text-[var(--primary-container)] mx-auto" />
                <h4 className="font-label-caps text-xs text-[var(--primary)] font-bold">
                  {filterStatus === "PENDING" ? "QUEUE NOMINAL — ZERO HELD ACTIONS" : "NO TICKETS FOUND"}
                </h4>
                <p className="font-body-sm text-[11px] text-[var(--text-muted)]">
                  All high-risk agent operations have been evaluated and dispatched.
                </p>
              </div>
            ) : (
              filteredApprovals.map((ticket) => {
                const isSelected = selectedTicket?.ticket_id === ticket.ticket_id;
                const isPending = ticket.status.toUpperCase() === "PENDING";
                return (
                  <div
                    key={ticket.ticket_id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`p-2.5 rounded-xs cursor-pointer transition-all border ${
                      isSelected
                        ? "bg-[var(--surface-container-high)] border-2 border-[var(--tertiary-fixed-dim)] shadow-md"
                        : "bg-[var(--surface-container-lowest)] hover:bg-[var(--surface-container)] border-[var(--border)]"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            ticket.risk_level === "CRITICAL"
                              ? "bg-[var(--error)]"
                              : ticket.risk_level === "HIGH"
                              ? "bg-[var(--tertiary-fixed-dim)]"
                              : "bg-[var(--primary-container)]"
                          }`}
                        />
                        <span className="font-code-sm text-xs font-bold text-[var(--primary)] truncate">
                          {ticket.tool_name || ticket.action}
                        </span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded-xs font-label-caps text-[9px] font-bold ${
                          isPending
                            ? "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)]"
                            : ticket.status.toUpperCase() === "APPROVED"
                            ? "bg-[var(--primary-container)]/20 text-[var(--primary-container)]"
                            : "bg-[var(--error-container)] text-[var(--on-error-container)]"
                        }`}
                      >
                        {ticket.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-code-sm pt-1">
                      <span>Agent: {ticket.agent_id}</span>
                      <span className="font-bold text-[var(--error)]">Risk: {ticket.risk_score}/100</span>
                    </div>

                    <div className="font-code-sm text-[10px] text-[var(--text-muted)] truncate pt-0.5">
                      Hash: {ticket.parameter_hash.slice(0, 16)}...
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (7 Cols): Forensic Escrow Inspector */}
        <div className="lg:col-span-7 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] p-3 sm:p-4 shadow-sm space-y-3">
          {selectedTicket ? (
            <>
              {/* Ticket Header & Risk Gauge */}
              <div className="flex items-start justify-between border-b border-[var(--border)] pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-label-caps text-[10px] text-[var(--text-muted)] uppercase">ESCROW INSPECTOR</span>
                    <span className="font-code-sm text-[10px] text-[var(--secondary-container)] font-mono">
                      #{selectedTicket.ticket_id}
                    </span>
                  </div>
                  <h3 className="font-headline-md text-base font-bold text-[var(--primary)] mt-0.5 font-mono">
                    {selectedTicket.tool_name || selectedTicket.action}
                  </h3>
                </div>

                <div className="flex flex-col items-end">
                  <div className="flex items-baseline gap-1">
                    <span className="font-telemetry-num text-xl text-[var(--error)] font-bold">
                      {selectedTicket.risk_score}
                    </span>
                    <span className="font-code-sm text-xs text-[var(--text-muted)]">/ 100</span>
                  </div>
                  <span className="font-label-caps text-[9px] text-[var(--error)] font-bold">
                    {selectedTicket.risk_level} RISK
                  </span>
                </div>
              </div>

              {/* Core Telemetry Specs */}
              <div className="grid grid-cols-2 gap-2 text-xs font-code-sm">
                <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
                  <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase block">REQUESTING AGENT</span>
                  <span className="text-[var(--primary)] font-semibold font-mono mt-0.5 block">{selectedTicket.agent_id}</span>
                </div>
                <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
                  <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase block">POLICY RULE APPLIED</span>
                  <span className="text-[var(--secondary-container)] font-semibold font-mono mt-0.5 block">{selectedTicket.policy_id}</span>
                </div>
              </div>

              {/* Reason Box */}
              <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
                <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase block mb-1">
                  SECURITY POLICY JUSTIFICATION
                </span>
                <p className="font-body-sm text-xs text-[var(--text-primary)] leading-relaxed bg-[var(--surface-container-high)] p-2 rounded-xs border border-[var(--border)]">
                  {selectedTicket.reason}
                </p>
              </div>

              {/* Cryptographic Hash Binding */}
              <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
                <div className="flex items-center justify-between pb-1">
                  <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase">
                    CRYPTOGRAPHIC PARAMETER BINDING (SHA-256)
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedTicket.parameter_hash);
                      setCopiedHash(true);
                      setTimeout(() => setCopiedHash(false), 2000);
                    }}
                    className="font-code-sm text-[10px] text-[var(--secondary-container)] hover:underline flex items-center gap-1"
                  >
                    {copiedHash ? <Check className="w-3 h-3 text-[var(--primary-container)]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHash ? "COPIED" : "COPY HASH"}</span>
                  </button>
                </div>
                <div className="font-code-sm text-[11px] text-[var(--primary-container)] font-mono break-all bg-[var(--surface-container-high)] p-2 rounded-xs border border-[var(--border)]">
                  {selectedTicket.parameter_hash}
                </div>
              </div>

              {/* Raw JSON Parameters Dump */}
              <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
                <div className="flex items-center justify-between pb-1">
                  <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase">
                    BOUND PARAMETERS PAYLOAD
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(prettyJson(selectedTicket.parameters));
                      setCopiedJson(true);
                      setTimeout(() => setCopiedJson(false), 2000);
                    }}
                    className="font-code-sm text-[10px] text-[var(--secondary-container)] hover:underline flex items-center gap-1"
                  >
                    {copiedJson ? <Check className="w-3 h-3 text-[var(--primary-container)]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedJson ? "COPIED" : "COPY JSON"}</span>
                  </button>
                </div>
                <pre className="font-code-sm text-[10px] text-[var(--text-secondary)] font-mono leading-tight bg-[var(--surface-container-high)] p-2 rounded-xs overflow-x-auto border border-[var(--border)] max-h-36">
                  {prettyJson(selectedTicket.parameters)}
                </pre>
              </div>

              {/* Action Controls for Pending Tickets */}
              {selectedTicket.status.toUpperCase() === "PENDING" ? (
                <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] space-y-2">
                  <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase block">
                    OPERATOR DECISION NOTES
                  </span>
                  <input
                    type="text"
                    placeholder="Enter dual-custody justification or reason..."
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xs bg-[var(--surface-container-high)] border border-[var(--border-interactive)] font-code-sm text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--primary-container)]"
                  />
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleApprove(selectedTicket.ticket_id)}
                      disabled={actionLoading}
                      className="py-2 px-3 rounded-xs bg-[var(--primary-container)] hover:bg-[var(--surface-tint)] text-[var(--on-primary)] font-code-md text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{actionLoading ? "AUTHORIZING..." : "AUTHORIZE & DISPATCH"}</span>
                    </button>
                    <button
                      onClick={() => handleDeny(selectedTicket.ticket_id)}
                      disabled={actionLoading}
                      className="py-2 px-3 rounded-xs bg-[var(--error-container)] hover:bg-[var(--error)] text-[var(--on-error-container)] font-code-md text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{actionLoading ? "QUARANTINING..." : "ABORT & QUARANTINE"}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-center font-code-sm text-xs text-[var(--text-muted)]">
                  Ticket status is <span className="font-bold text-[var(--primary)]">{selectedTicket.status.toUpperCase()}</span>. Decided at:{" "}
                  {selectedTicket.decided_at ? formatDate(selectedTicket.decided_at) : "N/A"}.
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center text-[var(--text-muted)] font-code-sm text-xs">
              Select an escrow ticket to view forensic parameters and sign decision.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
