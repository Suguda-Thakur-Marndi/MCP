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
  ArrowRight,
  Database,
  FileCheck,
} from "lucide-react";
import { api, ApprovalRecord, CurrentUser, ApiError } from "@/lib/api";
import {
  formatDate,
  relativeTime,
  prettyJson,
  shortId,
} from "@/lib/utils";
import { RiskBadge, StatusBadge, VerificationBadge, RoleBadge } from "@/components/ui/Badges";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/FeedbackStates";

const STATUS_FILTERS = [
  { label: "Pending Review", value: "PENDING" },
  { label: "Approved / Executed", value: "APPROVED" },
  { label: "Denied / Failed", value: "DENIED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "All Tickets", value: "ALL" },
];

const INITIAL_APPROVALS: ApprovalRecord[] = [
  {
    ticket_id: "TICKET-DELETE-529abcbeef95bd31",
    request_id: "REQ-DC6B3E4B01FE",
    agent_id: "gemini-agent-v1",
    requester_id: "user-p7-operator",
    approver_id: null,
    tool_name: "delete_customer_records",
    target_id: "CUST-VIEWER-01",
    action: "DELETE",
    parameters: { customer_id: "CUST-VIEWER-01" },
    parameter_hash: "120dce331ac455aaab36bb8f8633799d37cb69553687ef1a752895aed505d742",
    environment: "development",
    policy_id: "RULE-GATED-DELETION",
    risk_level: "HIGH",
    risk_score: 80,
    status: "PENDING",
    reason: "Test viewer access boundary — Gated deletion of customer record",
    decision_notes: null,
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
    expires_at: new Date(Date.now() + 55 * 60000).toISOString(),
    decided_at: null,
    executed_at: null,
  },
  {
    ticket_id: "TICKET-PURGE-983dfa1029ba44",
    request_id: "REQ-AA8712DF0931",
    agent_id: "gemini-agent-v1",
    requester_id: "system-auto-cleanup",
    approver_id: null,
    tool_name: "batch_purge_inactive_accounts",
    target_id: "ALL_INACTIVE",
    action: "BATCH_PURGE",
    parameters: { days_inactive: 180, dry_run: false },
    parameter_hash: "88fa2981bc203810293cbaf88710293847aaef09182390847120398471203948",
    environment: "development",
    policy_id: "RULE-BATCH-PURGE-GATING",
    risk_level: "CRITICAL",
    risk_score: 95,
    status: "PENDING",
    reason: "Batch destructive purge requires dual-custody verification",
    decision_notes: null,
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
    expires_at: new Date(Date.now() + 45 * 60000).toISOString(),
    decided_at: null,
    executed_at: null,
  },
];

export default function ApprovalsPage() {
  const [, startTransition] = useTransition();
  const [approvals, setApprovals] = useState<ApprovalRecord[]>(INITIAL_APPROVALS);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("PENDING");
  const [selectedTicket, setSelectedTicket] = useState<ApprovalRecord | null>(INITIAL_APPROVALS[0]);
  const [actionNotes, setActionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    type: "approve" | "deny";
    ticket: ApprovalRecord;
  } | null>(null);

  const fetchApprovals = useCallback(async (status?: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.approvals.list({
        status: status && status !== "ALL" ? status : undefined,
      });
      startTransition(() => {
        setApprovals(res);
        if (res.length > 0) {
          setSelectedTicket((curr) => {
            if (!curr) return res[0];
            const found = res.find((r) => r.ticket_id === curr.ticket_id);
            return found || res[0];
          });
        } else {
          setSelectedTicket(null);
        }
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load approval tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.approvals
      .list({
        status: filterStatus && filterStatus !== "ALL" ? filterStatus : undefined,
      })
      .then((res) => {
        if (active) {
          startTransition(() => {
            setApprovals(res);
            setLoading(false);
            if (res.length > 0) {
              setSelectedTicket((curr) => {
                if (!curr) return res[0];
                const found = res.find((r) => r.ticket_id === curr.ticket_id);
                return found || res[0];
              });
            } else {
              setSelectedTicket(null);
            }
          });
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to fetch approvals");
          setLoading(false);
        }
      });

    api.auth
      .me()
      .then((u) => {
        if (active) setCurrentUser(u);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [filterStatus]);

  const handleExecuteApproval = async (ticketId: string) => {
    setActionLoading(true);
    setActionSuccess(null);
    setError(null);
    try {
      const res = await api.approvals.approve(ticketId, actionNotes);
      setActionSuccess(`Ticket #${shortId(ticketId)} approved and dispatched to FastMCP.`);
      setConfirmModal(null);
      setActionNotes("");
      fetchApprovals(filterStatus);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Approval dispatch failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteDenial = async (ticketId: string) => {
    setActionLoading(true);
    setActionSuccess(null);
    setError(null);
    try {
      await api.approvals.deny(ticketId, actionNotes || "Rejected by Authorizing Officer.");
      setActionSuccess(`Ticket #${shortId(ticketId)} denied. Execution halted.`);
      setConfirmModal(null);
      setActionNotes("");
      fetchApprovals(filterStatus);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Denial action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleCopyJson = (obj: unknown) => {
    navigator.clipboard.writeText(prettyJson(obj));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono-tnum font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Governance & Dual Custody
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--risk-high)]" />
            <span className="text-[10px] font-mono-tnum text-[var(--risk-high)] font-semibold">HUMAN-IN-THE-LOOP</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Approval Queue & Dual-Custody Gating
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Cryptographic parameter binding and two-person authorization. Destructive operations require explicit human sign-off before FastMCP server dispatch.
          </p>
        </div>

        <button
          onClick={() => fetchApprovals(filterStatus)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {actionSuccess && (
        <div className="p-3 rounded bg-[var(--risk-low-bg)] border border-[var(--risk-low-border)] text-[var(--risk-low)] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="font-semibold">{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Status Filter Tabs & Search Bar */}
      <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-1.5 font-mono-tnum text-xs overflow-x-auto pb-1 sm:pb-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                filterStatus === f.value
                  ? "bg-[var(--accent)] text-white font-semibold"
                  : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* Master-Detail Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 Cols): Scannable Ticket List */}
        <div className="lg:col-span-5 rounded bg-[var(--bg-card)] border border-[var(--border)] p-3 shadow-xs space-y-2">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
            <span>Gating Tickets ({filteredApprovals.length})</span>
            <span className="font-mono-tnum">Filter: {filterStatus}</span>
          </div>

          <div className="space-y-1.5 max-h-[640px] overflow-y-auto">
            {loading ? (
              <LoadingState message="Querying dual-custody tickets..." />
            ) : filteredApprovals.length === 0 ? (
              <div className="p-6 text-center space-y-3 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
                <div className="w-8 h-8 rounded-full bg-[var(--risk-low-bg)] text-[var(--risk-low)] border border-[var(--risk-low-border)] mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    {filterStatus === "PENDING" ? "Queue Clear — Zero Pending Gated Actions" : `No ${filterStatus} Tickets Found`}
                  </h4>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1 max-w-xs mx-auto leading-relaxed">
                    {filterStatus === "PENDING"
                      ? "All elevated-risk operations have been cryptographically resolved. No human authorization is currently blocking agent tool execution."
                      : `No historical tickets match the filter "${filterStatus}". Change filter status to view other records.`}
                  </p>
                </div>
                {filterStatus === "PENDING" && (
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button
                      onClick={() => setFilterStatus("APPROVED")}
                      className="px-2.5 py-1 rounded text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-95 transition-opacity"
                    >
                      View 45 Executed Tickets
                    </button>
                    <Link
                      href="/agent"
                      className="px-2.5 py-1 rounded text-xs font-medium border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      Dispatch Test Action
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              filteredApprovals.map((ticket) => {
                const isSelected = selectedTicket?.ticket_id === ticket.ticket_id;
                const isPending = ticket.status === "PENDING";

                return (
                  <div
                    key={ticket.ticket_id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`p-3 rounded border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[var(--bg-primary)] border-[var(--accent)] shadow-xs ring-1 ring-[var(--accent)]/30"
                        : "bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-primary)]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 font-mono-tnum text-[11px] font-bold text-[var(--text-primary)] truncate">
                        <span>{ticket.tool_name}</span>
                        <span className="text-[var(--text-muted)] font-normal text-[10px]">
                          #{shortId(ticket.ticket_id)}
                        </span>
                      </div>
                      <StatusBadge status={ticket.status} />
                    </div>

                    <div className="flex items-center justify-between text-xs mb-1">
                      <p className="text-[11px] text-[var(--text-secondary)] truncate">
                        {ticket.reason || "High-risk tool execution gated by policy"}
                      </p>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] font-mono-tnum text-[var(--text-muted)]">
                      <RiskBadge severity={ticket.risk_level || "HIGH"} score={ticket.risk_score} />
                      <span>{relativeTime(ticket.created_at)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (7 Cols): Authoritative Decision Inspector */}
        <div className="lg:col-span-7">
          {selectedTicket ? (
            <div className="rounded bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-xs space-y-5">
              {/* Ticket Action Header */}
              <div className="pb-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono-tnum font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Authorization Ticket
                    </span>
                    <span className="font-mono-tnum text-xs font-bold text-[var(--text-primary)]">
                      #{selectedTicket.ticket_id}
                    </span>
                    <StatusBadge status={selectedTicket.status} />
                  </div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    Proposed Operation: <code className="font-mono-tnum text-[var(--accent)] font-semibold">{selectedTicket.tool_name}</code>
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Requested by agent <code className="font-mono-tnum font-semibold">{selectedTicket.requester_id || "gemini-agent-v1"}</code>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <RiskBadge severity={selectedTicket.risk_level || "HIGH"} score={selectedTicket.risk_score} />
                  <VerificationBadge label="SHA-256 SEALED" verified={true} />
                </div>
              </div>

              {/* Policy Invariant Reason */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                  Enforced Policy Invariant & Gating Rationale
                </label>
                <div className="p-3 rounded bg-[var(--bg-primary)]/60 border border-[var(--border)] text-xs text-[var(--text-primary)] leading-relaxed">
                  <span className="font-semibold text-[var(--risk-high)] mr-1.5">[GATED REQUIREMENT]</span>
                  <span>{selectedTicket.reason || "Destructive or elevated-risk tool execution requires dual-custody authorization."}</span>
                </div>
              </div>

              {/* Cryptographic Parameter Fingerprint (SHA-256) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                    <Fingerprint className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>Cryptographic Parameter Fingerprint (SHA-256)</span>
                  </label>
                  <button
                    onClick={() => handleCopyHash(selectedTicket.parameter_hash || "sha256_mock_hash")}
                    className="text-[10px] font-mono-tnum text-[var(--accent)] hover:underline flex items-center gap-1"
                  >
                    {copiedHash ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHash ? "Copied" : "Copy Hash"}</span>
                  </button>
                </div>
                <div className="p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border)] font-mono-tnum text-[11px] text-[var(--text-primary)] break-all select-all">
                  {selectedTicket.parameter_hash || "120dce331ac455aaab36bb8f8633799d37cb69553687ef1a752895aed505d742"}
                </div>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  Runtime verification ensures any in-flight alteration to arguments immediately invalidates this fingerprint and blocks dispatch.
                </p>
              </div>

              {/* Parameter Payload */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Exact Parameter Payload
                  </label>
                  <button
                    onClick={() => handleCopyJson(selectedTicket.parameters)}
                    className="text-[10px] font-mono-tnum text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
                  >
                    {copiedJson ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedJson ? "Copied" : "Copy Payload"}</span>
                  </button>
                </div>
                <pre className="p-3 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[11px] font-mono-tnum text-[var(--text-primary)] overflow-x-auto leading-relaxed">
                  {prettyJson(selectedTicket.parameters || {})}
                </pre>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono-tnum text-xs pt-1">
                <div className="p-2.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[9px] uppercase font-semibold text-[var(--text-muted)] block">Requested</span>
                  <span className="font-semibold text-[var(--text-primary)]">{formatDate(selectedTicket.created_at)}</span>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[9px] uppercase font-semibold text-[var(--text-muted)] block">Expires</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {selectedTicket.expires_at ? formatDate(selectedTicket.expires_at) : "1 Hour TTL"}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[9px] uppercase font-semibold text-[var(--text-muted)] block">Reviewer</span>
                  <span className="font-semibold text-[var(--text-primary)]">{currentUser?.email || "Authorizing Officer"}</span>
                </div>
              </div>

              {/* ACTION AREA: Reviewer Notes & Decision Buttons */}
              {selectedTicket.status === "PENDING" ? (
                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                      Authorizing Reviewer Notes (Audit Trail)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Identity verified via secondary channel; parameters checked against operational ticket."
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      className="w-full px-3 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--accent)]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      onClick={() => setConfirmModal({ type: "deny", ticket: selectedTicket })}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded border border-[var(--danger)] text-[var(--danger)] text-xs font-semibold hover:bg-[var(--danger)]/10 transition-colors disabled:opacity-50"
                    >
                      Reject Operation
                    </button>
                    <button
                      onClick={() => setConfirmModal({ type: "approve", ticket: selectedTicket })}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve & Authorize Dispatch</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-muted)] font-mono-tnum flex items-center justify-between">
                  <span>Ticket Status: {selectedTicket.status}</span>
                  <span>Decision Completed</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded bg-[var(--bg-card)] border border-[var(--border)] p-6 shadow-xs space-y-4">
              <div className="pb-3 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] block">
                    Security Governance
                  </span>
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Dual-Custody Gating Architecture
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono-tnum font-semibold bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)]">
                  PROTOCOL SPEC
                </span>
              </div>

              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                When an AI agent requests a tool classified as HIGH or CRITICAL risk (such as database deletions or batch mutations), execution is immediately suspended. A single-use cryptographic ticket is generated and queued for human dual-custody verification.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                    <Fingerprint className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>SHA-256 Binding</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-normal">
                    Tool parameters are hashed upon ticket creation. Any in-flight mutation invalidates authorization.
                  </p>
                </div>

                <div className="p-3 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                    <Lock className="w-3.5 h-3.5 text-[var(--risk-low)]" />
                    <span>Anti-Replay Token</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-normal">
                    Each approval token is single-use and bound to a 1-hour time-to-live (TTL) expiration window.
                  </p>
                </div>

                <div className="p-3 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                    <UserCheck className="w-3.5 h-3.5 text-[var(--risk-high)]" />
                    <span>Two-Person Rule</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-normal">
                    The authorizing officer must have APPROVER or ADMIN RBAC permissions and must not be the automated requester.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-muted)] flex items-center justify-between">
                <span>Select any ticket from the queue to inspect arguments and render an operational decision.</span>
                <span className="font-mono-tnum text-[11px]">Enforcement: FAST_MCP 4.0</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRMATION DIALOG MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
              {confirmModal.type === "approve" ? (
                <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
              ) : (
                <XCircle className="w-5 h-5 text-[var(--danger)]" />
              )}
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                {confirmModal.type === "approve" ? "Confirm Dual-Custody Approval" : "Confirm Operation Rejection"}
              </h3>
            </div>

            <div className="text-xs text-[var(--text-secondary)] space-y-2">
              <p>
                You are about to {confirmModal.type === "approve" ? "authorize database execution for" : "reject and cancel"} ticket:
              </p>
              <div className="p-2.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] font-mono-tnum text-[11px] text-[var(--text-primary)] space-y-1">
                <div>Tool: <span className="font-bold">{confirmModal.ticket.tool_name}</span></div>
                <div>Ticket: #{confirmModal.ticket.ticket_id}</div>
                <div>Risk: {confirmModal.ticket.risk_level || "HIGH"}</div>
              </div>
              {confirmModal.type === "approve" && (
                <p className="text-[11px] text-[var(--text-muted)]">
                  The FastMCP server will verify the SHA-256 parameter hash against this ticket before committing mutations to PostgreSQL.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => setConfirmModal(null)}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmModal.type === "approve") {
                    handleExecuteApproval(confirmModal.ticket.ticket_id);
                  } else {
                    handleExecuteDenial(confirmModal.ticket.ticket_id);
                  }
                }}
                disabled={actionLoading}
                className={`px-4 py-1.5 rounded text-xs font-semibold text-white transition-opacity ${
                  confirmModal.type === "approve"
                    ? "bg-[var(--accent)] hover:opacity-90"
                    : "bg-[var(--danger)] hover:opacity-90"
                }`}
              >
                {actionLoading ? "Processing..." : confirmModal.type === "approve" ? "Confirm & Execute" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
