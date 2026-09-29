"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  AlertTriangle,
  FileCode,
  Fingerprint,
  RefreshCw,
  Search,
  Lock,
  UserCheck,
  X,
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

export default function ApprovalsPage() {
  const [, startTransition] = useTransition();
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("PENDING");
  const [selectedTicket, setSelectedTicket] = useState<ApprovalRecord | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    type: "approve" | "deny" | "cancel";
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
          startTransition(() => {
            setError(err instanceof Error ? err.message : "Failed to load approvals");
            setLoading(false);
          });
        }
      });

    api.auth
      .me()
      .then((user) => {
        if (active) {
          startTransition(() => {
            setCurrentUser(user);
          });
        }
      })
      .catch(() => {
        if (active) {
          const role = typeof window !== "undefined" ? localStorage.getItem("sentinel_role") || "ADMIN" : "ADMIN";
          setCurrentUser({
            id: "usr_local",
            email: "admin@sentinel.test",
            name: "Security Admin",
            display_name: "Security Admin",
            role,
            status: "ACTIVE",
            is_active: true,
            permissions: ["*"],
          });
        }
      });

    return () => {
      active = false;
    };
  }, [filterStatus]);

  const executeApprove = async () => {
    if (!confirmModal || confirmModal.type !== "approve") return;
    const ticketId = confirmModal.ticket.ticket_id;
    try {
      setActionLoading(true);
      setError(null);
      const updated = await api.approvals.approve(ticketId, actionNotes || undefined);
      startTransition(() => {
        setApprovals((prev) =>
          prev.map((a) => (a.ticket_id === ticketId ? updated : a))
        );
        setSelectedTicket(updated);
        setActionSuccess(`Ticket ${shortId(ticketId)} successfully approved.`);
        setActionNotes("");
      });
      setTimeout(() => setActionSuccess(null), 4000);
      setConfirmModal(null);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.isForbidden) {
        setError("Authorization denied: Your role does not possess the APPROVER permission.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to approve ticket");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const executeDeny = async () => {
    if (!confirmModal || confirmModal.type !== "deny") return;
    const ticketId = confirmModal.ticket.ticket_id;
    try {
      setActionLoading(true);
      setError(null);
      const updated = await api.approvals.deny(ticketId, actionNotes || undefined);
      startTransition(() => {
        setApprovals((prev) =>
          prev.map((a) => (a.ticket_id === ticketId ? updated : a))
        );
        setSelectedTicket(updated);
        setActionSuccess(`Ticket ${shortId(ticketId)} denied.`);
        setActionNotes("");
      });
      setTimeout(() => setActionSuccess(null), 4000);
      setConfirmModal(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to deny ticket");
    } finally {
      setActionLoading(false);
    }
  };

  const executeCancel = async () => {
    if (!confirmModal || confirmModal.type !== "cancel") return;
    const ticketId = confirmModal.ticket.ticket_id;
    try {
      setActionLoading(true);
      setError(null);
      const updated = await api.approvals.cancel(ticketId, actionNotes || undefined);
      startTransition(() => {
        setApprovals((prev) =>
          prev.map((a) => (a.ticket_id === ticketId ? updated : a))
        );
        setSelectedTicket(updated);
        setActionSuccess(`Ticket ${shortId(ticketId)} cancelled.`);
        setActionNotes("");
      });
      setTimeout(() => setActionSuccess(null), 4000);
      setConfirmModal(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel ticket");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopy = (text: string, type: "hash" | "json") => {
    navigator.clipboard.writeText(text);
    if (type === "hash") {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } else {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  const isPending = selectedTicket?.status === "PENDING";
  const isViewer = currentUser?.role === "VIEWER";

  const filteredApprovals = approvals.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.ticket_id.toLowerCase().includes(q) ||
      a.tool_name.toLowerCase().includes(q) ||
      a.action.toLowerCase().includes(q) ||
      a.target_id.toLowerCase().includes(q) ||
      a.risk_level.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#243044]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
            <span>Governance</span>
            <span>/</span>
            <span className="text-amber-400">Human-in-the-Loop Gating</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
              Approval Queue & Gating
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-amber-950/50 text-amber-400 border border-amber-800/60">
              {approvals.filter((a) => a.status === "PENDING").length} PENDING GATED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Cryptographic parameter binding and dual-authorization workflow. High-risk actions require explicit human sign-off before FastMCP server dispatch.
          </p>
        </div>

        <button
          onClick={() => fetchApprovals(filterStatus)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#111827] border border-[#243044] text-xs font-medium text-slate-300 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-3.5 rounded-lg text-xs flex items-center justify-between border border-emerald-900/50 bg-emerald-950/30 text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-3.5 rounded-lg text-xs flex items-center justify-between border border-rose-900/50 bg-rose-950/30 text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Status Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0F172A] border border-[#243044] overflow-x-auto w-full sm:w-auto">
          {STATUS_FILTERS.map((f) => {
            const count =
              f.value === "ALL"
                ? approvals.length
                : approvals.filter((a) => a.status === f.value).length;
            const isActive = filterStatus === f.value;

            return (
              <button
                key={f.value}
                onClick={() => setFilterStatus(f.value)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-blue-600/20 text-sky-400 border border-sky-500/30 font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                    isActive ? "bg-sky-500/20 text-sky-300" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick Ticket Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search tickets, tools, actions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#111827] border border-[#243044] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-sans"
          />
        </div>
      </div>

      {/* Split Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Ticket List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            Gating Tickets ({filteredApprovals.length})
          </div>

          {loading ? (
            <LoadingState message="Fetching approval tickets..." />
          ) : filteredApprovals.length === 0 ? (
            <EmptyState
              title="No Approval Tickets Found"
              message={
                filterStatus === "PENDING"
                  ? "No operations currently require human review. The queue is clear."
                  : "No tickets match the selected status filter."
              }
              icon={ShieldCheck}
            />
          ) : (
            <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
              {filteredApprovals.map((ticket) => {
                const isSelected = selectedTicket?.ticket_id === ticket.ticket_id;
                return (
                  <div
                    key={ticket.ticket_id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#1A2332] border-sky-500/50 shadow-md shadow-sky-950/20"
                        : "bg-[#111827] border-[#243044] hover:border-slate-600 hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs font-mono font-bold text-sky-400">
                          {shortId(ticket.ticket_id)}
                        </code>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {relativeTime(ticket.created_at)}
                        </span>
                      </div>
                      <StatusBadge status={ticket.status} />
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-slate-200">
                        {ticket.action || ticket.tool_name}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">on</span>
                      <code className="text-[11px] font-mono text-slate-300 px-1 py-0.2 rounded bg-slate-800">
                        {ticket.target_id || "resource"}
                      </code>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#243044]/60 text-xs">
                      <div className="flex items-center gap-2">
                        <RiskBadge severity={ticket.risk_level} score={ticket.risk_score} />
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        Tool: {ticket.tool_name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Detailed Ticket Inspector */}
        <div className="lg:col-span-7">
          {selectedTicket ? (
            <div className="p-6 rounded-lg bg-[#111827] border border-[#243044] space-y-6">
              {/* Ticket Top Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#243044]">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white font-mono">
                      Ticket {selectedTicket.ticket_id}
                    </h2>
                    <StatusBadge status={selectedTicket.status} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Gated execution request initiated by agent{" "}
                    <code className="text-sky-400 font-mono">{selectedTicket.agent_id}</code>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <RiskBadge
                    severity={selectedTicket.risk_level}
                    score={selectedTicket.risk_score}
                  />
                  <VerificationBadge label="SHA-256 SEALED" verified={Boolean(selectedTicket.parameter_hash)} />
                </div>
              </div>

              {/* Critical Risk Assessment Overview */}
              <div className="p-3.5 rounded-lg bg-[#0F172A] border border-[#243044] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Gating Reason & Policy Invariant:</span>
                  <span className="font-mono text-[11px] text-amber-400 font-semibold">
                    Policy: {selectedTicket.policy_id}
                  </span>
                </div>
                <p className="text-xs text-slate-200">
                  {selectedTicket.reason || "Operation exceeded standard risk scoring threshold. Explicit human approval mandatory."}
                </p>
              </div>

              {/* Ticket Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded bg-[#0F172A] border border-[#243044]">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Requested Tool</span>
                  <span className="font-mono font-semibold text-sky-400">{selectedTicket.tool_name}</span>
                </div>
                <div className="p-2.5 rounded bg-[#0F172A] border border-[#243044]">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Action Verb</span>
                  <span className="font-mono font-semibold text-slate-200">{selectedTicket.action}</span>
                </div>
                <div className="p-2.5 rounded bg-[#0F172A] border border-[#243044]">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Target ID</span>
                  <span className="font-mono font-semibold text-slate-200 truncate block">{selectedTicket.target_id}</span>
                </div>
                <div className="p-2.5 rounded bg-[#0F172A] border border-[#243044]">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Environment</span>
                  <span className="font-mono font-semibold text-emerald-400 uppercase">{selectedTicket.environment}</span>
                </div>
              </div>

              {/* Cryptographic Parameter Binding */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Fingerprint className="w-3.5 h-3.5 text-sky-400" />
                    Cryptographic Parameter Fingerprint (SHA-256)
                  </span>
                  <button
                    onClick={() => handleCopy(selectedTicket.parameter_hash, "hash")}
                    className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-mono"
                  >
                    {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHash ? "Copied" : "Copy Hash"}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded bg-[#0B0F14] border border-[#243044] font-mono text-[11px] text-slate-300 break-all select-all">
                  {selectedTicket.parameter_hash || "No parameter hash sealed"}
                </div>
                <p className="text-[11px] text-slate-500">
                  Any runtime parameter alteration before server execution invalidates this fingerprint and blocks dispatch.
                </p>
              </div>

              {/* Authorized Payload JSON Inspector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-sky-400" />
                    Request Parameter Payload
                  </span>
                  <button
                    onClick={() => handleCopy(prettyJson(selectedTicket.parameters), "json")}
                    className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-mono"
                  >
                    {copiedJson ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedJson ? "Copied" : "Copy JSON"}</span>
                  </button>
                </div>
                <pre className="p-3.5 rounded bg-[#0B0F14] border border-[#243044] text-[11px] font-mono text-sky-300 max-h-48 overflow-y-auto select-all">
                  {prettyJson(selectedTicket.parameters)}
                </pre>
              </div>

              {/* Timing & Expiration Invariant */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-[#0F172A] border border-[#243044] text-xs">
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Requested At</span>
                  <span className="font-mono text-slate-300">{formatDate(selectedTicket.created_at)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Expires At</span>
                  <span className="font-mono text-amber-400">{formatDate(selectedTicket.expires_at)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Decision By</span>
                  <span className="font-mono text-slate-300">
                    {selectedTicket.approver_id || (selectedTicket.status === "PENDING" ? "Awaiting Reviewer" : "System")}
                  </span>
                </div>
              </div>

              {/* Decision Section */}
              {isPending && (
                <div className="pt-4 border-t border-[#243044] space-y-4">
                  {isViewer ? (
                    <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 text-xs text-amber-300 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span>
                        Your account has <strong>VIEWER</strong> role. You can inspect parameters but lack permission to sign off.
                      </span>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Audit Decision Notes (Mandatory for Denials, Optional for Approvals):
                        </label>
                        <textarea
                          rows={2}
                          placeholder="e.g. Identity verified via secondary channel; parameters checked against operational request."
                          value={actionNotes}
                          onChange={(e) => setActionNotes(e.target.value)}
                          className="w-full p-2.5 rounded-lg bg-[#0B0F14] border border-[#243044] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-sans"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-2">
                        <button
                          onClick={() =>
                            setConfirmModal({ type: "cancel", ticket: selectedTicket })
                          }
                          disabled={actionLoading}
                          className="px-3 py-1.5 rounded-md border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
                        >
                          Cancel Ticket
                        </button>

                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() =>
                              setConfirmModal({ type: "deny", ticket: selectedTicket })
                            }
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/70 text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Deny Request</span>
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({ type: "approve", ticket: selectedTicket })
                            }
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 transition-all hover:scale-[1.02] disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Authorize & Dispatch</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 rounded-lg bg-[#111827] border border-[#243044] text-center text-slate-500">
              Select an approval ticket from the left panel to inspect parameters and cryptographic hash.
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-[#0F172A] border border-[#243044] shadow-2xl overflow-hidden p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-full ${
                  confirmModal.type === "approve"
                    ? "bg-emerald-950/60 border border-emerald-700/60 text-emerald-400"
                    : "bg-rose-950/60 border border-rose-700/60 text-rose-400"
                }`}
              >
                {confirmModal.type === "approve" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Confirm {confirmModal.type === "approve" ? "Authorization" : "Denial"}
                </h3>
                <p className="text-xs text-slate-400">
                  Ticket {shortId(confirmModal.ticket.ticket_id)} ({confirmModal.ticket.tool_name})
                </p>
              </div>
            </div>

            <div className="p-3 rounded bg-[#111827] border border-[#243044] text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Target Action:</span>
                <span className="font-mono text-white font-semibold">{confirmModal.ticket.action}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Resource:</span>
                <span className="font-mono text-slate-200">{confirmModal.ticket.target_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Risk Score:</span>
                <RiskBadge severity={confirmModal.ticket.risk_level} score={confirmModal.ticket.risk_score} />
              </div>
            </div>

            <p className="text-xs text-slate-300">
              {confirmModal.type === "approve"
                ? "Authorizing will cryptographically unlock the tool execution on the FastMCP server. This token is strictly one-time use."
                : "Denying this ticket will permanently abort the agent request and record the rejection in the immutable audit log."}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-1.5 rounded-md border border-slate-700 bg-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={
                  confirmModal.type === "approve"
                    ? executeApprove
                    : confirmModal.type === "deny"
                    ? executeDeny
                    : executeCancel
                }
                disabled={actionLoading}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold text-white transition-colors ${
                  confirmModal.type === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-950/40"
                    : "bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-950/40"
                }`}
              >
                {actionLoading ? "Processing..." : `Confirm ${confirmModal.type === "approve" ? "Sign-off" : "Rejection"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
