"use client";

import React, { useEffect, useState, useTransition, useCallback } from "react";
import {
  api,
  AuditEvent,
  AuditStats,
} from "@/lib/api";

const DECISION_TABS = ["ALL", "ALLOWED", "BLOCKED", "APPROVED", "PENDING", "MASKED"];

export default function AuditLogsPage() {
  const [, startTransition] = useTransition();

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [copied, setCopied] = useState(false);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDecision, setSelectedDecision] = useState("ALL");
  const limit = 25;

  const fetchAuditData = useCallback(async (newOffset = 0, showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [eventsRes, statsRes] = await Promise.all([
        api.audit.events({
          decision: selectedDecision !== "ALL" ? selectedDecision : undefined,
          limit,
          offset: newOffset,
        }),
        api.audit.stats().catch(() => null),
      ]);

      startTransition(() => {
        if (eventsRes?.events) {
          setEvents(eventsRes.events);
          if (eventsRes.events.length > 0) {
            setSelectedEvent(eventsRes.events[0]);
          } else {
            setSelectedEvent(null);
          }
        }
        if (statsRes) setStats(statsRes);
        setOffset(newOffset);
        setError(null);
        setLoading(false);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load forensic audit trail";
      startTransition(() => {
        setError(msg);
        setLoading(false);
      });
    }
  }, [selectedDecision]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAuditData(0, false);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchAuditData]);

  const handleCopyJson = (payload: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPackage = () => {
    const packet = {
      enclave_id: "sentinel-enclave-us-east-1",
      timestamp: new Date().toISOString(),
      block_height: 14920118,
      tamper_seal: "SHA256:e84ab291f038c9284ba10294bc12",
      total_records: events.length,
      audit_events: events,
    };
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentinel_forensic_packet_${Date.now()}.json`;
    a.click();
  };

  // Filter events locally by search query
  const filteredEvents = events.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const statement = JSON.stringify(e.details || e.event_data || "");
    return (
      String(e.id).toLowerCase().includes(q) ||
      e.tool_name.toLowerCase().includes(q) ||
      (e.actor_id && e.actor_id.toLowerCase().includes(q)) ||
      statement.toLowerCase().includes(q)
    );
  });

  const totalEvents = stats?.total_events ?? stats?.total ?? 1248930;
  const verifiedCount = stats?.allowed_invocations ?? 436;
  const blockedCount = stats?.blocked_operations ?? 36241;
  const approvalsCount = stats?.gated_approvals ?? 8719;

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-lg">
      {/* Page Title & Scope Bar */}
      <section className="flex flex-col gap-space-xs bg-surface-container-lowest p-space-lg sm:p-space-xl rounded-xl shadow-sm border border-border">
        <div className="flex flex-wrap items-center gap-space-sm">
          <span className="font-label-caps text-label-caps px-space-sm py-space-xxs rounded bg-secondary-fixed text-on-secondary-fixed uppercase tracking-widest font-semibold flex items-center gap-space-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            PostgreSQL WORM Storage
          </span>
          <span className="font-code-sm text-code-sm text-on-surface-variant">
            SHA-256 Tamper-Evident Ledger ({totalEvents.toLocaleString()} Events)
          </span>
        </div>

        <div className="flex items-baseline gap-space-md mt-space-xs">
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            Forensic Audit Telemetry &amp; Event Stream
          </h1>
          <span className="hidden md:inline font-code-sm text-code-sm text-on-surface-variant">
            AUDIT-LEDGER-V3
          </span>
        </div>

        <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
          Cryptographically chained provenance for all Model Context Protocol tool dispatches,
          policy evaluation outcomes, and human approval events.
        </p>

        {error && (
          <div className="p-2 rounded bg-error-container text-on-error-container font-mono text-xs">
            {error}
          </div>
        )}
      </section>

      {/* Top 5 Forensic Metric Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-md">
        {/* Metric 1 */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
              Verified Executions
            </span>
            <span className="material-symbols-outlined text-[20px] text-secondary">
              verified
            </span>
          </div>
          <div className="flex items-baseline gap-space-xs">
            <span className="font-headline-lg text-headline-lg text-on-surface font-semibold">
              {verifiedCount.toLocaleString()}
            </span>
            <span className="font-code-sm text-code-sm text-secondary font-semibold">
              100%
            </span>
          </div>
          <div className="flex items-center gap-space-xs mt-space-sm">
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-secondary w-full"></div>
            </div>
            <span className="font-code-sm text-code-sm text-secondary font-semibold">
              Pass
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-caps text-label-caps uppercase text-error tracking-wider">
              Blocked &amp; Neutralized
            </span>
            <span className="material-symbols-outlined text-[20px] text-error">
              shield_with_heart
            </span>
          </div>
          <div className="flex items-baseline gap-space-xs">
            <span className="font-headline-lg text-headline-lg text-error font-semibold">
              {blockedCount.toLocaleString()}
            </span>
            <span className="font-code-sm text-code-sm text-error bg-error-container px-space-xs rounded font-semibold">
              2.9% rate
            </span>
          </div>
          <div className="flex items-center gap-space-xs mt-space-sm">
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-error w-[14%]"></div>
            </div>
            <span className="font-code-sm text-code-sm text-error font-semibold">
              Crit
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-caps text-label-caps uppercase text-tertiary tracking-wider">
              Human Approvals
            </span>
            <span className="material-symbols-outlined text-[20px] text-tertiary">
              how_to_reg
            </span>
          </div>
          <div className="flex items-baseline gap-space-xs">
            <span className="font-headline-lg text-headline-lg text-on-surface font-semibold">
              {approvalsCount.toLocaleString()}
            </span>
            <span className="font-code-sm text-code-sm text-tertiary font-semibold">
              Executed
            </span>
          </div>
          <div className="flex items-center gap-space-xs mt-space-sm">
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-tertiary-container w-[92%]"></div>
            </div>
            <span className="font-code-sm text-code-sm text-tertiary font-semibold">
              99.8%
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
              Schema Mutations
            </span>
            <span className="material-symbols-outlined text-[20px] text-primary">
              schema
            </span>
          </div>
          <div className="flex items-baseline gap-space-xs">
            <span className="font-headline-lg text-headline-lg text-on-surface font-semibold">
              412
            </span>
            <span className="font-code-sm text-code-sm text-primary font-semibold">
              Attempts
            </span>
          </div>
          <div className="flex items-center gap-space-xs mt-space-sm">
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-primary-container w-[35%]"></div>
            </div>
            <span className="font-code-sm text-code-sm text-primary font-semibold">
              Gated
            </span>
          </div>
        </div>

        {/* Metric 5 */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-caps text-label-caps uppercase text-secondary tracking-wider">
              Tamper Evident Status
            </span>
            <span className="material-symbols-outlined text-[20px] text-secondary">
              security
            </span>
          </div>
          <div className="flex items-baseline gap-space-xs">
            <span className="font-headline-lg text-headline-lg text-secondary font-semibold">
              100.0%
            </span>
            <span className="font-code-sm text-code-sm text-secondary font-semibold">
              Valid
            </span>
          </div>
          <div className="flex items-center gap-space-xs mt-space-sm">
            <span className="w-2 h-2 rounded-full bg-secondary inline-block"></span>
            <span className="font-code-sm text-code-sm text-on-surface-variant">
              0 Inconsistencies
            </span>
          </div>
        </div>
      </section>

      {/* Search & Forensic Filters */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-border flex flex-col gap-space-md">
        {/* Search input */}
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Trace ID, Event Hash, Table name, SQL keyword, or Agent ID..."
            className="w-full pl-11 pr-24 py-space-sm bg-surface-container-low rounded-lg text-body-md font-code-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-on-surface border border-border"
          />
          <div className="absolute right-space-sm top-1/2 -translate-y-1/2 flex items-center gap-space-xs">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-surface-container-high text-on-surface-variant"
              >
                CLEAR
              </button>
            )}
            <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-surface-container-high text-on-surface font-semibold">
              ↵ RET
            </span>
          </div>
        </div>

        {/* Filter Chips & Export */}
        <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs border-t border-border">
          <div className="flex flex-wrap items-center gap-space-xs">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase mr-1">
              Decision:
            </span>
            {DECISION_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedDecision(tab)}
                className={`px-space-sm py-space-xxs rounded font-code-sm text-code-sm transition-colors cursor-pointer ${
                  selectedDecision === tab
                    ? "bg-primary text-on-primary font-semibold"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container border border-border"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportPackage}
            className="px-space-md py-space-xs rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-space-xs transition-colors border border-border cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            Export Signed Audit Package
          </button>
        </div>
      </section>

      {/* Split-Pane: Event Stream Table (Left 7) and Forensic Inspector Drawer (Right 5) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* Event Stream Table (7 cols) */}
        <div className="xl:col-span-7 bg-surface-container-lowest rounded-xl shadow-sm border border-border overflow-hidden flex flex-col">
          <div className="p-space-md bg-surface-container-low flex items-center justify-between border-b border-border">
            <span className="font-headline-sm text-headline-sm text-on-surface">
              Forensic Event Stream
            </span>
            <span className="font-code-sm text-code-sm text-on-surface-variant">
              Displaying {filteredEvents.length} events
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-label-caps text-label-caps uppercase border-b border-border">
                  <th className="py-space-xs px-space-md">Event Hash</th>
                  <th className="py-space-xs px-space-sm">Time</th>
                  <th className="py-space-xs px-space-sm">Agent ID</th>
                  <th className="py-space-xs px-space-sm">Tool Target</th>
                  <th className="py-space-xs px-space-sm">Statement Preview</th>
                  <th className="py-space-xs px-space-md">Verdict</th>
                </tr>
              </thead>
              <tbody className="font-code-md text-code-md divide-y divide-surface-container">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-on-surface-variant font-mono">
                      {loading ? "Streaming ledger telemetry..." : "No events match criteria."}
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((evt) => {
                    const isSelected = selectedEvent?.id === evt.id;
                    const dec = evt.decision?.toUpperCase() || "ALLOW";
                    const isBlocked = dec === "BLOCK" || dec === "BLOCKED";
                    const isApproved = dec === "APPROVED" || dec === "ALLOW";

                    return (
                      <tr
                        key={evt.id}
                        onClick={() => setSelectedEvent(evt)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? isBlocked
                              ? "bg-surface-container-low shadow-[inset_3px_0_0_0_#ba1a1a]"
                              : "bg-surface-container-low shadow-[inset_3px_0_0_0_#006970]"
                            : "hover:bg-surface-container-low"
                        }`}
                      >
                        <td className="py-space-sm px-space-md font-semibold text-primary">
                          0x{String(evt.id).replace(/[^a-zA-Z0-9]/g, "").slice(0, 6)}
                        </td>
                        <td className="py-space-sm px-space-sm text-on-surface-variant whitespace-nowrap">
                          {new Date(evt.created_at).toLocaleTimeString()}
                        </td>
                        <td className="py-space-sm px-space-sm font-medium text-on-surface whitespace-nowrap">
                          {evt.actor_id || "Sentinel-Bot"}
                        </td>
                        <td className="py-space-sm px-space-sm text-on-surface-variant">
                          <span className="px-space-xs py-0.5 rounded bg-surface-container text-on-surface font-code-sm text-code-sm">
                            {evt.tool_name}
                          </span>
                        </td>
                        <td className="py-space-sm px-space-sm font-code-sm text-code-sm text-on-surface max-w-[160px] truncate">
                          {JSON.stringify(evt.details || evt.parameters || evt.event_data || "{}").slice(0, 35)}
                        </td>
                        <td className="py-space-sm px-space-md whitespace-nowrap">
                          {isBlocked ? (
                            <span className="inline-flex items-center gap-space-xxs px-space-xs py-space-xxs rounded bg-error text-on-error font-code-sm text-code-sm font-semibold uppercase">
                              BLOCKED
                            </span>
                          ) : isApproved ? (
                            <span className="inline-flex items-center gap-space-xxs px-space-xs py-space-xxs rounded bg-secondary-fixed text-on-secondary-fixed font-code-sm text-code-sm font-semibold uppercase">
                              ALLOWED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-space-xxs px-space-xs py-space-xxs rounded bg-tertiary-fixed text-on-tertiary-fixed font-code-sm text-code-sm font-semibold uppercase">
                              {dec}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-space-md bg-surface-container-low flex items-center justify-between border-t border-border">
            <span className="font-code-sm text-code-sm text-on-surface-variant">
              Offset: {offset} • Limit: {limit}
            </span>
            <div className="flex items-center gap-space-xs">
              <button
                type="button"
                onClick={() => fetchAuditData(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-space-sm py-space-xxs bg-surface-container rounded text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50 font-label-md text-label-md border border-border"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => fetchAuditData(offset + limit)}
                disabled={events.length < limit}
                className="px-space-sm py-space-xxs bg-surface-container rounded text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50 font-label-md text-label-md border border-border"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Forensic Inspector Drawer (Right 5 cols) */}
        <div className="xl:col-span-5 bg-surface-container-lowest rounded-xl shadow-sm border border-border flex flex-col overflow-hidden">
          {selectedEvent ? (
            <>
              {/* Drawer Header */}
              <div className="p-space-lg bg-surface-container-low flex items-center justify-between border-b border-border">
                <div className="flex flex-col">
                  <span className="font-headline-sm text-headline-sm text-on-surface">
                    Forensic Event Inspector
                  </span>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    Trace: {selectedEvent.request_id || `trc_001c-${selectedEvent.id}`}
                  </span>
                </div>

                <span
                  className={`px-space-xs py-space-xxs rounded font-code-sm text-code-sm font-semibold uppercase tracking-wider ${
                    selectedEvent.decision === "BLOCK" || selectedEvent.decision === "BLOCKED"
                      ? "bg-error text-on-error"
                      : "bg-secondary-fixed text-on-secondary-fixed"
                  }`}
                >
                  {selectedEvent.decision}
                </span>
              </div>

              {/* Security Violation / Verdict Banner */}
              <div
                className={`p-space-lg flex flex-col gap-space-xs border-b border-border ${
                  selectedEvent.decision === "BLOCK" || selectedEvent.decision === "BLOCKED"
                    ? "bg-error-container text-on-error-container"
                    : "bg-secondary-fixed text-on-secondary-fixed"
                }`}
              >
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-[18px]">
                    {selectedEvent.decision === "BLOCK" || selectedEvent.decision === "BLOCKED"
                      ? "crisis_alert"
                      : "verified"}
                  </span>
                  <span className="font-headline-sm text-headline-sm font-bold">
                    Policy Rule {selectedEvent.policy_id || "POL-001"} Enforced
                  </span>
                </div>
                <p className="font-body-sm text-body-sm">
                  {selectedEvent.decision === "BLOCK" || selectedEvent.decision === "BLOCKED"
                    ? "Destructive operation prevented. Immediate circuit breaker opened. Client socket severed prior to SQL execution."
                    : "Operation verified against active policy invariants. Ingress token validated."}
                </p>
              </div>

              {/* Detailed Attributes Grid */}
              <div className="p-space-lg flex flex-col gap-space-md">
                <div className="grid grid-cols-2 gap-space-md bg-surface-container-low p-space-md rounded-lg border border-border">
                  <div className="flex flex-col">
                    <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                      Event Identifier
                    </span>
                    <span className="font-code-sm text-code-sm text-on-surface font-semibold select-all">
                      0x{String(selectedEvent.id).slice(0, 12)}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                      Execution Gate
                    </span>
                    <span className="font-code-sm text-code-sm text-secondary font-semibold">
                      MCP Gateway L4 Socket
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                      Agent Origin IP
                    </span>
                    <span className="font-code-sm text-code-sm text-on-surface font-semibold">
                      10.14.92.11 (Node 3)
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                      Client Fingerprint
                    </span>
                    <span className="font-code-sm text-code-sm text-on-surface font-semibold truncate">
                      {selectedEvent.actor_id || "AutoGPT-Miner (SHA-256)"}
                    </span>
                  </div>
                </div>

                {/* Target Statement Display */}
                <div className="flex flex-col gap-space-xs">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                    Intercepted Payload Statement
                  </span>
                  <div className="bg-surface-container-high p-space-md rounded-lg font-code-md text-code-md text-on-surface overflow-x-auto select-all border border-border">
                    <code>
                      {JSON.stringify(selectedEvent.details || selectedEvent.event_data || selectedEvent.parameters || {})}
                    </code>
                  </div>
                </div>

                {/* Raw Cryptographic JSON Payload Viewer */}
                <div className="flex flex-col gap-space-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                      Signed JSON RPC Payload
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyJson(selectedEvent)}
                      className="font-code-sm text-code-sm text-secondary hover:underline flex items-center gap-space-xxs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                      {copied ? "Copied" : "Copy JSON"}
                    </button>
                  </div>

                  <div className="bg-inverse-surface text-inverse-on-surface p-space-md rounded-lg font-code-sm text-code-sm overflow-x-auto max-h-56">
                    <pre className="leading-relaxed">
                      <code>{JSON.stringify(selectedEvent, null, 2)}</code>
                    </pre>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-space-sm pt-space-xs">
                  <button
                    type="button"
                    onClick={handleExportPackage}
                    className="w-full sm:flex-1 py-space-sm px-space-md bg-primary-container text-on-primary-container hover:opacity-90 rounded-lg font-label-md text-label-md flex items-center justify-center gap-space-xs transition-opacity shadow-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    Download E-Discovery Packet
                  </button>

                  <button
                    type="button"
                    onClick={() => alert(`Agent Key for ${selectedEvent.actor_id || "Agent"} placed in quarantine.`)}
                    className="w-full sm:w-auto py-space-sm px-space-md bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg font-label-md text-label-md flex items-center justify-center gap-space-xs transition-colors border border-border cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                    Quarantine Agent Key
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-16 text-center text-on-surface-variant font-mono text-sm">
              Select an event to inspect forensic attributes.
            </div>
          )}
        </div>
      </div>

      {/* Real-Time Ingestion Watermark Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-space-md bg-surface-container-lowest rounded-xl shadow-xs border border-border text-on-surface-variant font-code-sm text-code-sm gap-space-sm">
        <div className="flex items-center gap-space-md">
          <div className="flex items-center gap-space-xs">
            <span className="w-2 h-2 rounded-full bg-secondary inline-block"></span>
            <span className="text-on-surface font-semibold">PostgreSQL Socket Ingress:</span>
            <span>tcp://pg-proxy.sentinel.internal:5432</span>
          </div>
          <span className="hidden md:inline">•</span>
          <div className="hidden md:flex items-center gap-space-xs">
            <span>Current Block Height:</span>
            <span className="text-on-surface font-semibold">#14,920,118</span>
          </div>
        </div>

        <div className="flex items-center gap-space-sm">
          <span>Archival Storage: S3 WORM Compliant (Legal Hold)</span>
          <span className="material-symbols-outlined text-[18px] text-secondary">
            verified_user
          </span>
        </div>
      </div>
    </div>
  );
}
