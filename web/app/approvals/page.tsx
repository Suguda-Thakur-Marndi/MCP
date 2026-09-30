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
  ArrowRight,
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
import { BorderBeam } from "@/components/ui/BorderBeam";

const STATUS_FILTERS = [
  { label: "Pending Review", value: "PENDING" },
  { label: "Approved / Executed", value: "APPROVED" },
  { label: "Denied / Blocked", value: "DENIED" },
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
      startTransition(() => {
        setError(err instanceof Error ? err.message : "Failed to load approval tickets");
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.auth.me()
      .then((u) => {
        if (active) setCurrentUser(u);
      })
      .catch(() => {
        if (active) {
          const role = typeof window !== "undefined" ? localStorage.getItem("sentinel_role") || "ADMIN" : "ADMIN";
          const email = typeof window !== "undefined" ? localStorage.getItem("sentinel_email") || "admin@sentinel.test" : "admin@sentinel.test";
          setCurrentUser({
            id: "usr_local",
            email,
            name: "Security Admin",
            display_name: "Security Admin",
            role,
            status: "ACTIVE",
            is_active: true,
            permissions: ["*"],
          });
        }
      });

    fetchApprovals(filterStatus);

    return () => {
      active = false;
    };
  }, [fetchApprovals, filterStatus]);

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
        setActionSuccess(`Ticket ${shortId(ticketId)} authorized & dispatched.`);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#D1CEC7] dark:border-[#26344A]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#D05A40] font-bold mb-1">
            <span>GOVERNANCE</span>
            <span>/</span>
            <span>HUMAN-IN-THE-LOOP GATING</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A202E] dark:text-[#F4F6F9] tracking-tight">
              Dual-Custody Approval Queue
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-amber-50 text-[#B87000] border border-amber-300 dark:bg-[#E3A03E]/15 dark:text-[#F3BA63] dark:border-[#E3A03E]/40 font-bold">
              {approvals.filter((a) => a.status === "PENDING").length} PENDING GATED
            </span>
          </div>
          <p className="text-xs text-[#475063] dark:text-[#94A3B8] mt-1 max-w-2xl leading-relaxed">
            High-risk operations and destructive tool calls intercepted by policy rules. Review cryptographically sealed parameter payloads before authorizing FastMCP execution.
          </p>
        </div>

        {/* Current Identity & Sync */}
        <div className="flex items-center gap-3">
          {currentUser && (
            <div className="flex items-center gap-2 p-1.5 rounded-lg bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] text-xs shadow-sm">
              <RoleBadge role={currentUser.role} />
              <span className="font-mono text-[#6B7280] dark:text-slate-400 hidden sm:inline text-[11px]">
                {currentUser.email}
              </span>
            </div>
          )}
          <button
            onClick={() => fetchApprovals(filterStatus)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] text-xs font-medium text-[#1A202E] dark:text-slate-300 hover:border-[#D05A40] transition-colors disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl text-xs flex items-center justify-between border border-teal-300 dark:border-teal-900/50 bg-teal-50 dark:bg-teal-950/30 text-teal-800 dark:text-teal-200 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#3A8A7F]" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-3.5 rounded-xl text-xs flex items-center justify-between border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#D64541] flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Status Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] overflow-x-auto w-full sm:w-auto shadow-sm">
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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-[#D05A40] text-white shadow-xs"
                    : "text-[#475063] dark:text-slate-400 hover:text-[#1A202E] dark:hover:text-white"
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                    isActive ? "bg-white/20 text-white" : "bg-[#EFECE5] dark:bg-slate-800 text-[#475063] dark:text-slate-400"
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
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search tickets, tools, actions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] text-xs text-[#1A202E] dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-[#D05A40] font-sans shadow-sm"
          />
        </div>
      </div>

      {/* Split Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Ticket List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-bold text-[#1A202E] dark:text-slate-400 uppercase tracking-wider px-1 font-sans">
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
                    className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
                      isSelected
                        ? "bg-[#FFFFFF] dark:bg-[#17202E] border-[#D05A40] shadow-md shadow-[#D05A40]/10 ring-1 ring-[#D05A40]"
                        : "bg-[#FFFFFF] dark:bg-[#17202E] border-[#D1CEC7] dark:border-[#26344A] hover:border-[#D05A40]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs font-mono font-bold text-[#D05A40]">
                          {shortId(ticket.ticket_id)}
                        </code>
                        <span className="text-[10px] text-[#6B7280] dark:text-slate-400 font-mono">
                          {relativeTime(ticket.created_at)}
                        </span>
                      </div>
                      <StatusBadge status={ticket.status} />
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-[#1A202E] dark:text-slate-200">
                        {ticket.action || ticket.tool_name}
                      </span>
                      <span className="text-xs text-[#6B7280] dark:text-slate-500 font-mono">on</span>
                      <code className="text-[11px] font-mono text-[#1A202E] dark:text-slate-300 px-1 py-0.2 rounded bg-[#EFECE5] dark:bg-slate-800">
                        {ticket.target_id || "resource"}
                      </code>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#D1CEC7] dark:border-[#26344A]/60 text-xs">
                      <div className="flex items-center gap-2">
                        <RiskBadge severity={ticket.risk_level} score={ticket.risk_score} />
                      </div>
                      <span className="font-mono text-[10px] text-[#6B7280] dark:text-slate-400">
                        Tool: {ticket.tool_name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Detailed Ticket Inspector (7 cols) */}
        <div className="lg:col-span-7">
          {selectedTicket ? (
            <div className="relative overflow-hidden p-6 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] space-y-6 shadow-md">
              {selectedTicket.status === "PENDING" && (
                <BorderBeam size={260} duration={12} colorFrom="#D05A40" colorTo="#E3A03E" />
              )}
              {/* Ticket Top Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#D1CEC7] dark:border-[#26344A]">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#1A202E] dark:text-white font-mono">
                      Ticket {selectedTicket.ticket_id}
                    </h2>
                    <StatusBadge status={selectedTicket.status} />
                  </div>
                  <p className="text-xs text-[#475063] dark:text-slate-400 mt-1">
                    Gated execution request initiated by agent{" "}
                    <code className="text-[#D05A40] font-mono font-semibold">{selectedTicket.agent_id}</code>
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

              {/* Action Emphasized in Bordered Architectural Box (deep-research-report.md) */}
              <div className="p-4 rounded-xl bg-[#F8F6F0] dark:bg-[#131923] border-2 border-[#D05A40]/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#D05A40] font-bold font-mono uppercase tracking-wider text-[10px]">
                    INTERCEPTED ACTION & REASON
                  </span>
                  <span className="font-mono text-[11px] text-[#475063] dark:text-slate-400 font-semibold">
                    Policy Rule: {selectedTicket.policy_id}
                  </span>
                </div>
                <div className="text-sm font-bold text-[#1A202E] dark:text-[#F4F6F9] font-mono">
                  {selectedTicket.action} on {selectedTicket.target_id}
                </div>
                <p className="text-xs text-[#475063] dark:text-slate-300 leading-relaxed">
                  {selectedTicket.reason || "Operation exceeded standard risk scoring threshold. Explicit human approval mandatory."}
                </p>
              </div>

              {/* Ticket Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                  <span className="text-[10px] uppercase font-mono text-[#6B7280] dark:text-slate-500 block">Requested Tool</span>
                  <span className="font-mono font-semibold text-[#D05A40]">{selectedTicket.tool_name}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                  <span className="text-[10px] uppercase font-mono text-[#6B7280] dark:text-slate-500 block">Action Verb</span>
                  <span className="font-mono font-semibold text-[#1A202E] dark:text-slate-200">{selectedTicket.action}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                  <span className="text-[10px] uppercase font-mono text-[#6B7280] dark:text-slate-500 block">Target ID</span>
                  <span className="font-mono font-semibold text-[#1A202E] dark:text-slate-200 truncate block">{selectedTicket.target_id}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                  <span className="text-[10px] uppercase font-mono text-[#6B7280] dark:text-slate-500 block">Environment</span>
                  <span className="font-mono font-semibold text-[#3A8A7F] uppercase">{selectedTicket.environment}</span>
                </div>
              </div>

              {/* Cryptographic Parameter Binding */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#1A202E] dark:text-slate-300 font-semibold flex items-center gap-1.5">
                    <Fingerprint className="w-3.5 h-3.5 text-[#D05A40]" />
                    Cryptographic Parameter Fingerprint (SHA-256)
                  </span>
                  <button
                    onClick={() => handleCopy(selectedTicket.parameter_hash, "hash")}
                    className="inline-flex items-center gap-1 text-[11px] text-[#D05A40] hover:text-[#B84E37] font-mono font-semibold"
                  >
                    {copiedHash ? <Check className="w-3 h-3 text-[#3A8A7F]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHash ? "Copied" : "Copy Hash"}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#0D1117] border border-[#D1CEC7] dark:border-[#26344A] font-mono text-[11px] text-[#1A202E] dark:text-slate-300 break-all select-all">
                  {selectedTicket.parameter_hash || "No parameter hash sealed"}
                </div>
                <p className="text-[11px] text-[#6B7280] dark:text-slate-500">
                  Any in-flight parameter tampering alters this fingerprint and immediately invalidates execution.
                </p>
              </div>

              {/* Authorized Payload JSON Inspector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#1A202E] dark:text-slate-300 font-semibold flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-[#3A8A7F]" />
                    Request Parameter Payload
                  </span>
                  <button
                    onClick={() => handleCopy(prettyJson(selectedTicket.parameters), "json")}
                    className="inline-flex items-center gap-1 text-[11px] text-[#D05A40] hover:text-[#B84E37] font-mono font-semibold"
                  >
                    {copiedJson ? <Check className="w-3 h-3 text-[#3A8A7F]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedJson ? "Copied" : "Copy JSON"}</span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-lg bg-[#F8F6F0] dark:bg-[#0D1117] border border-[#D1CEC7] dark:border-[#26344A] text-[11px] font-mono text-[#1A202E] dark:text-sky-300 max-h-48 overflow-y-auto select-all">
                  {prettyJson(selectedTicket.parameters)}
                </pre>
              </div>

              {/* Decision Section */}
              {isPending && (
                <div className="pt-4 border-t border-[#D1CEC7] dark:border-[#26344A] space-y-4">
                  {isViewer ? (
                    <div className="p-3 rounded-lg bg-amber-50 text-[#B87000] border border-amber-300 dark:bg-amber-950/20 dark:border-amber-800/40 text-xs flex items-center gap-2">
                      <Lock className="w-4 h-4 flex-shrink-0" />
                      <span>
                        Your account has <strong>VIEWER</strong> role. You can inspect parameters but lack permission to sign off.
                      </span>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-[#1A202E] dark:text-slate-300 mb-1.5">
                          Audit Decision Notes (Mandatory for Denials, Optional for Approvals):
                        </label>
                        <textarea
                          rows={2}
                          placeholder="e.g. Identity verified; parameter checked against customer maintenance ticket."
                          value={actionNotes}
                          onChange={(e) => setActionNotes(e.target.value)}
                          className="w-full p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#0D1117] border border-[#D1CEC7] dark:border-[#26344A] text-xs text-[#1A202E] dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-[#D05A40] font-sans"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-2">
                        <button
                          onClick={() =>
                            setConfirmModal({ type: "cancel", ticket: selectedTicket })
                          }
                          disabled={actionLoading}
                          className="px-3 py-1.5 rounded-lg border border-[#D1CEC7] dark:border-slate-700 bg-[#EFECE5] dark:bg-slate-800/60 hover:bg-[#E2DFD8] text-xs font-medium text-[#1A202E] dark:text-slate-300 transition-colors"
                        >
                          Cancel Ticket
                        </button>

                        <div className="flex items-center gap-2.5">
                          {/* Reject Button (Rich Red) */}
                          <button
                            onClick={() =>
                              setConfirmModal({ type: "deny", ticket: selectedTicket })
                            }
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D64541] hover:bg-[#B71C1C] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Reject</span>
                          </button>
                          {/* Approve Button (Burnt Orange) */}
                          <button
                            onClick={() =>
                              setConfirmModal({ type: "approve", ticket: selectedTicket })
                            }
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D05A40] hover:bg-[#B84E37] text-white text-xs font-semibold shadow-md shadow-[#D05A40]/25 transition-all hover:scale-[1.01] disabled:opacity-50"
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
            <div className="p-12 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] text-center text-[#6B7280] dark:text-slate-500 shadow-sm">
              Select an approval ticket from the left panel to inspect parameters and cryptographic hash.
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog (Restates exact action before committing) */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] shadow-2xl overflow-hidden p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-full ${
                  confirmModal.type === "approve"
                    ? "bg-[#D05A40]/15 text-[#D05A40]"
                    : "bg-[#D64541]/15 text-[#D64541]"
                }`}
              >
                {confirmModal.type === "approve" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1A202E] dark:text-white">
                  Confirm {confirmModal.type === "approve" ? "Authorization" : "Rejection"}
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  Ticket {shortId(confirmModal.ticket.ticket_id)} ({confirmModal.ticket.tool_name})
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A] text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#6B7280] dark:text-slate-400">Target Action:</span>
                <span className="font-mono text-[#1A202E] dark:text-white font-semibold">{confirmModal.ticket.action}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280] dark:text-slate-400">Resource:</span>
                <span className="font-mono text-[#1A202E] dark:text-slate-200">{confirmModal.ticket.target_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280] dark:text-slate-400">Risk Score:</span>
                <RiskBadge severity={confirmModal.ticket.risk_level} score={confirmModal.ticket.risk_score} />
              </div>
            </div>

            <p className="text-xs text-[#475063] dark:text-slate-300 leading-relaxed">
              {confirmModal.type === "approve"
                ? "Authorizing will cryptographically unlock the tool execution on the FastMCP server. This approval token is strictly single-use."
                : "Rejecting this ticket will permanently abort the agent request and record the rejection in the immutable audit log."}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-1.5 rounded-lg border border-[#D1CEC7] dark:border-slate-700 bg-[#EFECE5] dark:bg-slate-800 text-xs font-medium text-[#1A202E] dark:text-slate-300 hover:bg-[#E2DFD8] transition-colors"
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
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors ${
                  confirmModal.type === "approve"
                    ? "bg-[#D05A40] hover:bg-[#B84E37] shadow-md shadow-[#D05A40]/25"
                    : "bg-[#D64541] hover:bg-[#B71C1C] shadow-md shadow-[#D64541]/25"
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
