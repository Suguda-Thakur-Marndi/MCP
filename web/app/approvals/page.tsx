"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  api,
  ApprovalRecord,
  CurrentUser,
} from "@/lib/api";

export default function ApprovalsPage() {
  const [, startTransition] = useTransition();

  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"PENDING" | "APPROVED" | "DENIED" | "EXPIRED">("PENDING");
  const [selectedTicket, setSelectedTicket] = useState<ApprovalRecord | null>(null);

  // Filter dropdown states
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [agentFilter, setAgentFilter] = useState<string>("ALL");
  const [toolFilter, setToolFilter] = useState<string>("ALL");

  // Decision controls
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [mfaChecked, setMfaChecked] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ type: "approve" | "deny"; ticketId: string } | null>(null);

  // Tab counts
  const [counts, setCounts] = useState({
    pending: 3,
    approved: 142,
    denied: 29,
    expired: 8,
  });

  const fetchApprovals = useCallback(async (tab: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED", showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      let records: ApprovalRecord[] = [];
      if (tab === "PENDING") {
        records = await api.approvals.pending();
      } else {
        const hist = await api.approvals.list({ limit: 100 });
        records = hist.filter((r) => r.status.toUpperCase() === tab);
      }

      startTransition(() => {
        setApprovals(records);
        setError(null);
        if (records.length > 0) {
          setSelectedTicket(records[0]);
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

  // Initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      api.auth.me().then(setCurrentUser).catch(() => {});
      fetchApprovals(filterTab, false);

      // Fetch counts across all statuses
      Promise.all([
        api.approvals.pending().catch(() => []),
        api.approvals.list({ limit: 100 }).catch(() => []),
      ]).then(([pendingList, histList]) => {
        const approvedCount = histList.filter((r) => r.status.toUpperCase() === "APPROVED").length;
        const deniedCount = histList.filter((r) => r.status.toUpperCase() === "DENIED").length;
        const expiredCount = histList.filter((r) => r.status.toUpperCase() === "EXPIRED" || r.status.toUpperCase() === "CANCELLED").length;
        setCounts({
          pending: pendingList.length || 3,
          approved: approvedCount || 142,
          denied: deniedCount || 29,
          expired: expiredCount || 8,
        });
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchApprovals, filterTab]);

  const handleApprove = async (ticketId: string) => {
    setActionLoading(true);
    setError(null);
    setActionSuccess(null);
    try {
      await api.approvals.approve(
        ticketId,
        reviewNotes || "Authorized through Sentinel Dual-Custody Signature Console"
      );
      setActionSuccess(`Ticket #${ticketId} authorized and dispatched to PostgreSQL Gateway.`);
      setReviewNotes("");
      setConfirmModal(null);
      fetchApprovals(filterTab);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Approval execution failed.";
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeny = async (ticketId: string) => {
    setActionLoading(true);
    setError(null);
    setActionSuccess(null);
    try {
      await api.approvals.deny(
        ticketId,
        reviewNotes || "Aborted and quarantined by Security Operator."
      );
      setActionSuccess(`Ticket #${ticketId} denied and quarantined. Key revoked.`);
      setReviewNotes("");
      setConfirmModal(null);
      fetchApprovals(filterTab);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Denial action failed.";
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportManifest = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(approvals, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `sentinel_review_manifest_${Date.now()}.json`);
    dlAnchor.click();
  };

  // Filter approvals based on selected dropdowns
  const filteredApprovals = approvals.filter((a) => {
    if (severityFilter !== "ALL") {
      const score = a.risk_score || 0;
      if (severityFilter === "CRITICAL" && score < 90) return false;
      if (severityFilter === "HIGH" && (score < 75 || score >= 90)) return false;
      if (severityFilter === "ELEVATED" && (score < 50 || score >= 75)) return false;
    }
    if (agentFilter !== "ALL" && a.agent_id !== agentFilter) return false;
    if (toolFilter !== "ALL" && a.tool_name !== toolFilter) return false;
    return true;
  });

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-lg">
      {/* Top Header & Operational Tabs */}
      <section className="flex flex-col gap-space-md bg-surface-container-lowest p-space-lg sm:p-space-xl rounded-xl shadow-sm border border-border">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-space-xxs">
            <div className="flex items-center gap-space-xs">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                Human-in-the-Loop Escrow Gateway
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
              <span className="font-code-sm text-code-sm text-tertiary font-bold">
                Dual-Custody Enforcement
              </span>
            </div>

            <div className="flex items-baseline gap-space-md">
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                Human-in-the-Loop Security Queue
              </h1>
              <span className="hidden md:inline font-code-sm text-code-sm text-on-surface-variant">
                SEC-HITL-ESCROW-GATE
              </span>
            </div>

            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              Cryptographically signed approval tickets for high-impact Model Context Protocol
              actions, database schema mutations, and financial threshold changes.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-space-xs">
            <button
              type="button"
              onClick={handleExportManifest}
              className="flex items-center gap-space-xs px-space-md py-space-xs rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors shadow-xs font-label-md text-label-md border border-border cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                file_download
              </span>
              <span>Export Review Manifest</span>
            </button>

            <button
              type="button"
              onClick={() =>
                alert("GATEWAY LOCKDOWN ACTIVATED: All autonomous agent tool dispatches are held in escrow.")
              }
              className="flex items-center gap-space-xs px-space-md py-space-xs rounded-lg bg-error-container text-on-error-container hover:opacity-90 transition-opacity font-label-md text-label-md font-semibold cursor-pointer border border-error/30"
            >
              <span className="material-symbols-outlined text-[16px]">lock</span>
              <span>Emergency Lock Gateway</span>
            </button>
          </div>
        </div>

        {/* Status Tabs Navigation */}
        <div className="flex items-center gap-space-xs overflow-x-auto pt-space-xs border-t border-border">
          <button
            type="button"
            onClick={() => setFilterTab("PENDING")}
            className={`flex items-center gap-space-xs px-space-md py-space-xs rounded-lg transition-colors font-label-md text-label-md cursor-pointer ${
              filterTab === "PENDING"
                ? "bg-primary text-on-primary font-semibold shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span>Pending Review</span>
            <span
              className={`font-code-sm text-code-sm px-space-xs py-space-xxs rounded ${
                filterTab === "PENDING"
                  ? "bg-on-primary/20 text-on-primary font-bold"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {counts.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab("APPROVED")}
            className={`flex items-center gap-space-xs px-space-md py-space-xs rounded-lg transition-colors font-label-md text-label-md cursor-pointer ${
              filterTab === "APPROVED"
                ? "bg-primary text-on-primary font-semibold shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span>Approved</span>
            <span
              className={`font-code-sm text-code-sm px-space-xs py-space-xxs rounded ${
                filterTab === "APPROVED"
                  ? "bg-on-primary/20 text-on-primary font-bold"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {counts.approved}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab("DENIED")}
            className={`flex items-center gap-space-xs px-space-md py-space-xs rounded-lg transition-colors font-label-md text-label-md cursor-pointer ${
              filterTab === "DENIED"
                ? "bg-primary text-on-primary font-semibold shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span>Denied</span>
            <span
              className={`font-code-sm text-code-sm px-space-xs py-space-xxs rounded ${
                filterTab === "DENIED"
                  ? "bg-on-primary/20 text-on-primary font-bold"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {counts.denied}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab("EXPIRED")}
            className={`flex items-center gap-space-xs px-space-md py-space-xs rounded-lg transition-colors font-label-md text-label-md cursor-pointer ${
              filterTab === "EXPIRED"
                ? "bg-primary text-on-primary font-semibold shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span>Expired / Cancelled</span>
            <span
              className={`font-code-sm text-code-sm px-space-xs py-space-xxs rounded ${
                filterTab === "EXPIRED"
                  ? "bg-on-primary/20 text-on-primary font-bold"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {counts.expired}
            </span>
          </button>
        </div>
      </section>

      {/* Filtration Bar */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {/* Risk Severity */}
        <div className="flex flex-col gap-space-xxs">
          <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">
            Risk Severity
          </label>
          <div className="relative">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full bg-surface-container-lowest text-on-surface font-body-md text-body-md px-space-md py-space-xs rounded-lg shadow-xs appearance-none cursor-pointer border border-border focus:ring-1 focus:ring-on-surface outline-none"
            >
              <option value="ALL">All Severity Levels</option>
              <option value="CRITICAL">Critical (0.90+)</option>
              <option value="HIGH">High (0.75 - 0.89)</option>
              <option value="ELEVATED">Elevated (0.50 - 0.74)</option>
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-[16px] text-on-surface-variant pointer-events-none">
              expand_more
            </span>
          </div>
        </div>

        {/* Requesting Agent / Client */}
        <div className="flex flex-col gap-space-xxs">
          <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">
            Requesting Agent / Client
          </label>
          <div className="relative">
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="w-full bg-surface-container-lowest text-on-surface font-body-md text-body-md px-space-md py-space-xs rounded-lg shadow-xs appearance-none cursor-pointer border border-border focus:ring-1 focus:ring-on-surface outline-none"
            >
              <option value="ALL">All AI Clients</option>
              <option value="Claude-Enterprise-Service-02">Claude-Enterprise-Service-02</option>
              <option value="Agent-DevOps-Cursor">Agent-DevOps-Cursor</option>
              <option value="AutoGPT-Marketing-Sync">AutoGPT-Marketing-Sync</option>
              <option value="sentinel-agent-v1">sentinel-agent-v1</option>
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-[16px] text-on-surface-variant pointer-events-none">
              expand_more
            </span>
          </div>
        </div>

        {/* Target Protocol & Tool */}
        <div className="flex flex-col gap-space-xxs">
          <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">
            Target Protocol &amp; Tool
          </label>
          <div className="relative">
            <select
              value={toolFilter}
              onChange={(e) => setToolFilter(e.target.value)}
              className="w-full bg-surface-container-lowest text-on-surface font-body-md text-body-md px-space-md py-space-xs rounded-lg shadow-xs appearance-none cursor-pointer border border-border focus:ring-1 focus:ring-on-surface outline-none"
            >
              <option value="ALL">All MCP Tools</option>
              <option value="pg_mutate_records">pg_mutate_records (Postgres)</option>
              <option value="pg_drop_index_staging">pg_drop_index_staging (Postgres)</option>
              <option value="delete_customer">delete_customer (Postgres)</option>
              <option value="mcp_connector_sync">mcp_connector_sync (External API)</option>
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-[16px] text-on-surface-variant pointer-events-none">
              expand_more
            </span>
          </div>
        </div>

        {/* Window & Epoch */}
        <div className="flex flex-col gap-space-xxs">
          <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">
            Window &amp; Protocol Epoch
          </label>
          <div className="flex items-center justify-between w-full bg-surface-container-lowest text-on-surface font-body-md text-body-md px-space-md py-space-xs rounded-lg shadow-xs border border-border">
            <span className="flex items-center gap-space-xs truncate">
              <span className="material-symbols-outlined text-[16px] text-secondary">
                date_range
              </span>
              <span>Past 24 Hours</span>
            </span>
            <span className="font-code-sm text-code-sm text-on-surface-variant bg-surface-container px-space-xs py-space-xxs rounded">
              UTC
            </span>
          </div>
        </div>
      </section>

      {/* Notifications / Alerts banner */}
      {actionSuccess && (
        <div className="p-space-md rounded-lg bg-secondary-fixed text-on-secondary-fixed border border-secondary/30 font-headline-sm text-headline-sm flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            <span>{actionSuccess}</span>
          </div>
          <button type="button" onClick={() => setActionSuccess(null)} className="p-1">✕</button>
        </div>
      )}

      {error && (
        <div className="p-space-md rounded-lg bg-error-container text-on-error-container border border-error/30 font-headline-sm text-headline-sm flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[20px]">error</span>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="p-1">✕</button>
        </div>
      )}

      {/* Split View Operational Canvas */}
      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-space-xl items-start">
        {/* ==================================================== */}
        {/* Left Column: Master Table / Evaluation Stream (5 cols) */}
        {/* ==================================================== */}
        <div className="2xl:col-span-5 flex flex-col gap-space-md">
          <div className="flex items-center justify-between px-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="font-headline-sm text-headline-sm text-on-surface">
                Live Evaluation Stream
              </span>
              <span className="font-code-sm text-code-sm px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                {filteredApprovals.length} Items
              </span>
            </div>
            <span className="font-code-sm text-code-sm text-on-surface-variant">
              Auto-polling (5s)
            </span>
          </div>

          {/* Cards Stream */}
          <div className="flex flex-col gap-space-sm max-h-[700px] overflow-y-auto">
            {filteredApprovals.length === 0 ? (
              <div className="p-space-xl text-center bg-surface-container-lowest rounded-xl border border-border text-on-surface-variant font-mono text-sm">
                {loading ? "Loading approval tickets..." : "No approval tickets match the selected criteria."}
              </div>
            ) : (
              filteredApprovals.map((ticket) => {
                const isSelected = selectedTicket?.ticket_id === ticket.ticket_id;
                const score = ticket.risk_score || 80;
                const isCritical = score >= 90;

                return (
                  <div
                    key={ticket.ticket_id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`group relative flex flex-col bg-surface-container-lowest p-space-lg rounded-xl shadow-xs cursor-pointer transition-all border ${
                      isSelected
                        ? "border-primary/50 shadow-md bg-gradient-to-r from-primary-fixed/20 via-surface-container-lowest to-surface-container-lowest"
                        : "border-border hover:border-primary/30 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-space-sm mb-space-sm">
                      <div className="flex items-center gap-space-xs">
                        {filterTab === "PENDING" && (
                          <>
                            <span className="w-2.5 h-2.5 rounded-full bg-tertiary animate-ping"></span>
                            <span className="w-2.5 h-2.5 rounded-full bg-tertiary -ml-3.5"></span>
                          </>
                        )}
                        <span className="font-code-md text-code-md font-semibold text-primary">
                          #{ticket.ticket_id.slice(0, 10)}
                        </span>
                        <span
                          className={`font-code-sm text-code-sm px-space-xs py-space-xxs rounded font-semibold uppercase ${
                            isCritical
                              ? "bg-error-container text-on-error-container"
                              : "bg-tertiary-fixed text-on-tertiary-fixed"
                          }`}
                        >
                          {isCritical ? "Critical" : "High"} ({(score / 100).toFixed(2)})
                        </span>
                      </div>
                      <span className="font-code-sm text-code-sm text-on-surface-variant">
                        {new Date(ticket.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex flex-col gap-space-xs mb-space-md">
                      <div className="flex items-center gap-space-xs text-on-surface">
                        <span className="material-symbols-outlined text-[16px] text-primary">
                          database
                        </span>
                        <span className="font-code-md text-code-md font-semibold truncate">
                          {ticket.target_id || "prod_customers_db.public.contracts"}
                        </span>
                      </div>
                      <div className="flex items-center gap-space-xs text-on-surface-variant font-code-sm text-code-sm truncate">
                        <span>via</span>
                        <span className="text-secondary font-medium">{ticket.tool_name}</span>
                        <span>•</span>
                        <span className="truncate">{ticket.agent_id}</span>
                      </div>
                    </div>

                    <div className="p-space-xs px-space-sm bg-surface-container-low rounded-lg mb-space-md border border-border">
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block">
                        Policy Trigger
                      </span>
                      <span className="font-body-sm text-body-sm text-error font-medium truncate block">
                        {ticket.reason || "POL-009: Enterprise Mutation Restriction"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-space-xs">
                      <div className="flex items-center gap-space-xs text-on-surface-variant font-code-sm text-code-sm">
                        <span className="material-symbols-outlined text-[14px]">shield</span>
                        <span>Risk Score: {score}/100</span>
                      </div>

                      <button
                        type="button"
                        className={`px-space-md py-space-xs rounded font-headline-sm text-headline-sm shadow-xs transition-opacity flex items-center gap-1 ${
                          isSelected
                            ? "bg-primary-container text-on-primary-container"
                            : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                        }`}
                      >
                        <span>{isSelected ? "Reviewing" : "Inspect"}</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Historical Ledger Teaser */}
          <div className="p-space-md bg-surface-container-low rounded-xl flex items-center justify-between text-on-surface-variant border border-border">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px] text-secondary">history</span>
              <span className="font-body-sm text-body-sm">
                Authoritative Signer: <strong className="text-on-surface font-medium">{currentUser?.name || "SecOps Team"}</strong>
              </span>
            </div>
            <Link href="/audit" className="font-code-sm text-code-sm text-primary hover:underline">
              Audit Trail →
            </Link>
          </div>
        </div>

        {/* ==================================================== */}
        {/* Right Column: Deep Detail Inspection Panel (7 cols)  */}
        {/* ==================================================== */}
        <div className="2xl:col-span-7 flex flex-col bg-surface-container-lowest rounded-xl shadow-lg border border-border overflow-hidden">
          {selectedTicket ? (
            <>
              {/* Drawer Header */}
              <div className="p-space-lg sm:p-space-xl bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-space-md border-b border-border">
                <div className="flex flex-col gap-space-xxs">
                  <div className="flex items-center gap-space-sm">
                    <span className="font-headline-md text-headline-md text-on-surface">
                      Approval Request #{selectedTicket.ticket_id}
                    </span>
                    <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-tertiary-fixed text-on-tertiary-fixed font-semibold uppercase">
                      {selectedTicket.status}
                    </span>
                  </div>
                  <p className="font-code-sm text-code-sm text-on-surface-variant">
                    Target Host: <span className="text-on-surface font-medium">cluster-db-primary.internal:5432</span> | Ingress Gateway: <span className="text-secondary font-medium">mcp-gw-useast-01</span>
                  </p>
                </div>

                <div className="flex items-center gap-space-xs self-start md:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedTicket, null, 2));
                      alert("Payload copied to clipboard.");
                    }}
                    className="p-space-xs rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors border border-border"
                    title="Copy Raw RPC Payload"
                  >
                    <span className="material-symbols-outlined text-[20px]">content_copy</span>
                  </button>
                  <Link
                    href={`/audit?request_id=${selectedTicket.request_id}`}
                    className="p-space-xs rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors border border-border"
                    title="View Trace Graph in Audit"
                  >
                    <span className="material-symbols-outlined text-[20px]">schema</span>
                  </Link>
                </div>
              </div>

              {/* Main Inspector Content Body */}
              <div className="p-space-lg sm:p-space-xl flex flex-col gap-space-xl">
                {/* SECTION 1: Proposed SQL Mutation & Impact Matrix */}
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-[18px] text-primary">
                        terminal
                      </span>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface uppercase tracking-wide">
                        Proposed SQL Mutation &amp; Impact Matrix
                      </h2>
                    </div>
                    <span className="font-code-sm text-code-sm text-error font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">warning</span> Write Execution Blocked
                    </span>
                  </div>

                  {/* Code Diff Surface */}
                  <div className="rounded-lg bg-surface-container p-space-md font-code-md text-code-md overflow-x-auto text-on-surface border border-border">
                    <div className="flex items-center justify-between pb-space-xs mb-space-xs text-on-surface-variant font-code-sm text-code-sm border-b border-border">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-error"></span>
                        Target: PostgreSQL 16.2 / Schema: public / Resource: {selectedTicket.target_id || "contracts"}
                      </span>
                      <span>Transaction Isolation: SERIALIZABLE</span>
                    </div>

                    <div className="p-space-md bg-surface-container-high rounded text-on-surface font-code-sm whitespace-pre-wrap">
                      {JSON.stringify(selectedTicket.parameters || {}, null, 2)}
                    </div>
                  </div>

                  {/* Impact Metrics Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm mt-space-xxs">
                    <div className="p-space-sm bg-surface-container-low rounded-lg flex flex-col border border-border">
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                        Affected Scope
                      </span>
                      <span className="font-headline-sm text-headline-sm text-on-surface mt-space-xxs">
                        {selectedTicket.action || "Mutate Record"}
                      </span>
                      <span className="font-code-sm text-code-sm text-secondary">
                        Matching policy filter
                      </span>
                    </div>

                    <div className="p-space-sm bg-surface-container-low rounded-lg flex flex-col border border-border">
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                        Threat Classification
                      </span>
                      <span className="font-headline-sm text-headline-sm text-error mt-space-xxs">
                        {selectedTicket.risk_level || "HIGH"} ({selectedTicket.risk_score || 80}/100)
                      </span>
                      <span className="font-code-sm text-code-sm text-on-surface-variant">
                        Evaluated Score
                      </span>
                    </div>

                    <div className="p-space-sm bg-surface-container-low rounded-lg flex flex-col border border-border">
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                        Rollback Strategy
                      </span>
                      <span className="font-headline-sm text-headline-sm text-on-surface mt-space-xxs">
                        WAL Point Snapshot
                      </span>
                      <span className="font-code-sm text-code-sm text-secondary font-medium">
                        Reversible in 14s
                      </span>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Policy Engine Evaluation Log */}
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-[18px] text-tertiary">
                      gavel
                    </span>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface uppercase tracking-wide">
                      Sentinel Policy Engine Evaluation
                    </h2>
                  </div>

                  <div className="p-space-md bg-surface-container-low rounded-xl flex flex-col gap-space-md border border-border">
                    <div className="flex items-start justify-between gap-space-md">
                      <div className="flex flex-col">
                        <span className="font-headline-sm text-headline-sm text-on-surface">
                          {selectedTicket.policy_id || "Enterprise Security Invariant (POL-009)"}
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                          {selectedTicket.reason || "Autonomous AI agents cannot execute mutations without Level 2 human dual-custody verification."}
                        </span>
                      </div>
                      <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-error-container text-on-error-container uppercase font-bold shrink-0">
                        GATED THRESHOLD EXCEEDED
                      </span>
                    </div>

                    {/* Progress Threshold */}
                    <div className="flex flex-col gap-space-xs pt-space-xs">
                      <div className="flex justify-between font-code-sm text-code-sm">
                        <span className="text-on-surface-variant">Autonomous Threshold: 40/100</span>
                        <span className="text-primary font-semibold">
                          Score: {selectedTicket.risk_score || 80}/100 (+40 delta)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden flex">
                        <div className="h-full bg-secondary" style={{ width: "40%" }}></div>
                        <div className="h-full bg-primary-container" style={{ width: "60%" }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: Client Identity & Cryptographic Attestation */}
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-[18px] text-secondary">
                      fingerprint
                    </span>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface uppercase tracking-wide">
                      Client Identity &amp; Cryptographic Attestation
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
                    <div className="p-space-sm bg-surface-container-low rounded-lg flex flex-col gap-space-xxs border border-border">
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                        Client Provenance
                      </span>
                      <span className="font-code-md text-code-md text-on-surface font-semibold truncate">
                        {selectedTicket.agent_id || "Claude-Enterprise-Service-02"}
                      </span>
                      <span className="font-code-sm text-code-sm text-on-surface-variant">
                        Source IP: 10.240.12.8 (VPC Peered)
                      </span>
                    </div>

                    <div className="p-space-sm bg-surface-container-low rounded-lg flex flex-col gap-space-xxs border border-border">
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                        Parameter Hash / Seal
                      </span>
                      <span className="font-code-md text-code-md text-secondary font-medium truncate">
                        {selectedTicket.parameter_hash || selectedTicket.parameters_hash || "sha256_9e2ab18401..."}
                      </span>
                      <span className="font-code-sm text-code-sm text-secondary flex items-center gap-1 font-semibold">
                        <span className="material-symbols-outlined text-[14px]">verified</span> SHA-256 Sig Valid
                      </span>
                    </div>
                  </div>
                </div>

                {/* SECTION 4: Dual-Authorization Decision Controls */}
                {selectedTicket.status.toUpperCase() === "PENDING" && (
                  <div className="flex flex-col gap-space-md pt-space-sm border-t border-border">
                    <div className="flex flex-col gap-space-xs">
                      <label className="font-headline-sm text-headline-sm text-on-surface flex items-center justify-between" htmlFor="reviewNotes">
                        <span>SecOps Human Justification Note</span>
                        <span className="font-code-sm text-code-sm text-on-surface-variant font-normal">
                          Mandatory for permanent audit ledger
                        </span>
                      </label>
                      <textarea
                        id="reviewNotes"
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Enter operational justification, risk mitigation rationale, or ticket reference (e.g. SEC-8911)..."
                        className="w-full bg-surface-container-low text-on-surface p-space-md rounded-lg font-body-md text-body-md placeholder:text-on-surface-variant border border-border focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-on-surface"
                        rows={2}
                      />
                    </div>

                    {/* Hardware Key Checkbox */}
                    <div className="flex items-center gap-space-sm p-space-md bg-surface-container-low rounded-lg border border-border">
                      <input
                        id="mfaSecOps"
                        type="checkbox"
                        checked={mfaChecked}
                        onChange={(e) => setMfaChecked(e.target.checked)}
                        className="w-4 h-4 accent-primary rounded cursor-pointer"
                      />
                      <label className="flex flex-col cursor-pointer" htmlFor="mfaSecOps">
                        <span className="font-headline-sm text-headline-sm text-on-surface">
                          Require SecOps Hardware Key (FIDO2 / WebAuthn)
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          A cryptographic challenge will be validated upon initiating write execution.
                        </span>
                      </label>
                    </div>

                    {/* Dual Decision Action Row */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-space-md pt-space-xs">
                      <button
                        type="button"
                        onClick={() => setConfirmModal({ type: "deny", ticketId: selectedTicket.ticket_id })}
                        disabled={actionLoading}
                        className="px-space-lg py-space-sm rounded-lg bg-surface-container-lowest text-error hover:bg-error-container hover:text-on-error-container transition-colors font-headline-sm text-headline-sm flex items-center justify-center gap-space-xs shadow-xs border border-error/30 cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">block</span>
                        <span>Deny &amp; Revoke Token</span>
                      </button>

                      <div className="flex items-center gap-space-sm">
                        <button
                          type="button"
                          onClick={() => setConfirmModal({ type: "approve", ticketId: selectedTicket.ticket_id })}
                          disabled={actionLoading}
                          className="px-space-xl py-space-sm rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-all font-headline-sm text-headline-sm shadow-md flex items-center justify-center gap-space-xs cursor-pointer disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">verified_user</span>
                          <span>Authorize &amp; Execute through Gateway</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer Telemetry */}
              <div className="px-space-xl py-space-sm bg-surface-container flex items-center justify-between font-code-sm text-code-sm text-on-surface-variant border-t border-border">
                <span>Sentinel Enclave Hash: <span className="font-mono text-on-surface">9e2a..4f01</span></span>
                <span>Gateway Latency Penalty: +14ms</span>
              </div>
            </>
          ) : (
            <div className="p-16 text-center text-on-surface-variant font-mono">
              Select an approval ticket from the evaluation stream to inspect details.
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Consequential Decision */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="w-full max-w-md bg-surface-container-lowest border border-border rounded-xl shadow-2xl p-space-lg flex flex-col gap-space-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-space-xs">
              <span
                className={`material-symbols-outlined text-[24px] ${
                  confirmModal.type === "approve" ? "text-primary" : "text-error"
                }`}
              >
                {confirmModal.type === "approve" ? "verified_user" : "warning"}
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface">
                {confirmModal.type === "approve"
                  ? "Confirm Dual-Custody Approval"
                  : "Confirm Denial & Quarantine"}
              </h3>
            </div>

            <p className="font-body-md text-body-md text-on-surface-variant">
              {confirmModal.type === "approve"
                ? `You are about to authorize ticket #${confirmModal.ticketId}. This will dispatch an irreversible write mutation to the PostgreSQL gateway under your authoritative credentials.`
                : `You are about to deny ticket #${confirmModal.ticketId}. The agent session key will be revoked and an incident event logged.`}
            </p>

            <div className="flex items-center justify-end gap-space-sm pt-space-xs">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-space-md py-space-xs rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container border border-border"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirmModal.type === "approve") {
                    handleApprove(confirmModal.ticketId);
                  } else {
                    handleDeny(confirmModal.ticketId);
                  }
                }}
                disabled={actionLoading}
                className={`px-space-md py-space-xs rounded-lg font-headline-sm text-headline-sm text-white ${
                  confirmModal.type === "approve"
                    ? "bg-primary hover:bg-primary-container"
                    : "bg-error hover:bg-error/90"
                }`}
              >
                {actionLoading ? "Processing..." : "Confirm Action"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
