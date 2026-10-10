"use client";

import React, { useEffect, useState, useTransition, useCallback } from "react";
import {
  api,
  AuditEvent,
  AuditStats,
} from "@/lib/api";
import { formatNumber, formatTime, riskBadgeClass, decisionBadgeClass } from "@/lib/utils";

const DECISION_TABS = ["ALL", "ALLOWED", "BLOCKED", "APPROVED", "PENDING", "PERMIT", "DENY"];

export default function AuditLogsPage() {
  const [, startTransition] = useTransition();

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [copied, setCopied] = useState(false);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDecision, setSelectedDecision] = useState("ALL");
  const limit = 20;

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
          setTotalRecords(eventsRes.total || eventsRes.events.length);
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
      const msg = err instanceof Error ? err.message : "Failed to load audit events";
      startTransition(() => {
        setError(msg);
        setLoading(false);
      });
    }
  }, [selectedDecision]);

  useEffect(() => {
    void fetchAuditData(0, true);
  }, [fetchAuditData]);

  const handleCopyJson = (payload: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJSON = () => {
    const packet = {
      cluster: "sentinel-cluster-01",
      exported_at: new Date().toISOString(),
      total_records: events.length,
      audit_events: events,
    };
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentinel_audit_ledger_${Date.now()}.json`;
    a.click();
  };

  // Authoritative metrics calculated from real by_decision counts
  const totalEvents =
    stats?.total_events ??
    stats?.total ??
    Object.values(stats?.by_decision || {}).reduce((a, b) => a + b, 0);

  const allowedCount =
    (stats?.by_decision?.ALLOWED ?? 0) +
    (stats?.by_decision?.APPROVED ?? 0) +
    (stats?.by_decision?.EXECUTED ?? 0) +
    (stats?.by_decision?.PERMIT ?? 0);

  const blockedCount =
    (stats?.by_decision?.BLOCKED ?? 0) +
    (stats?.by_decision?.DENIED ?? 0) +
    (stats?.by_decision?.DENY ?? 0);

  const pendingCount = stats?.by_decision?.PENDING ?? 0;

  const filteredEvents = events.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(e.id).toLowerCase().includes(q) ||
      e.tool_name.toLowerCase().includes(q) ||
      (e.actor_id && e.actor_id.toLowerCase().includes(q)) ||
      (e.decision && e.decision.toLowerCase().includes(q))
    );
  });

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-xl">
      {/* Header Banner */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-sm mb-space-xxs">
            <span className="font-label-mono text-label-mono text-secondary font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              IMMUTABLE WORM AUDIT TRAIL
            </span>
            <span className="font-label-mono text-label-mono px-space-xs py-0.5 rounded bg-surface-container text-on-surface-variant">
              POSTGRESQL REPLICATION ACTIVE
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
            Forensic Audit Telemetry &amp; Event Stream
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Cryptographically chained provenance for all Model Context Protocol tool invocations and policy verdicts
          </p>
        </div>

        <div className="flex items-center gap-space-xs font-label-mono text-label-mono">
          <button
            onClick={() => void fetchAuditData(offset, true)}
            className="px-space-md py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="px-space-md py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export JSON Packet</span>
          </button>
        </div>
      </section>

      {/* 4 Forensic Metric Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container flex flex-col justify-between">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Total Audit Ledger</span>
          <div className="flex items-baseline gap-space-xs mt-space-xs">
            <span className="font-headline-xl text-headline-xl text-on-surface" suppressHydrationWarning>
              {formatNumber(totalEvents)}
            </span>
            <span className="font-label-mono text-label-mono text-secondary font-semibold">EVENTS</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container flex flex-col justify-between">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Permitted / Allowed</span>
          <div className="flex items-baseline gap-space-xs mt-space-xs">
            <span className="font-headline-xl text-headline-xl text-secondary" suppressHydrationWarning>
              {formatNumber(allowedCount)}
            </span>
            <span className="font-label-mono text-label-mono text-secondary font-semibold">AUTHORIZED</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container flex flex-col justify-between">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Blocked &amp; Intercepted</span>
          <div className="flex items-baseline gap-space-xs mt-space-xs">
            <span className="font-headline-xl text-headline-xl text-error" suppressHydrationWarning>
              {formatNumber(blockedCount)}
            </span>
            <span className="font-label-mono text-label-mono text-error font-semibold">DENIED</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container flex flex-col justify-between">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Escrow Gated</span>
          <div className="flex items-baseline gap-space-xs mt-space-xs">
            <span className="font-headline-xl text-headline-xl text-primary font-bold" suppressHydrationWarning>
              {formatNumber(pendingCount)}
            </span>
            <span className="font-label-mono text-label-mono text-primary font-semibold">PENDING</span>
          </div>
        </div>
      </section>

      {/* Filter Tabs and Search Bar */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-xs font-label-mono text-label-mono bg-surface-container-low p-1 rounded-xl border border-surface-container overflow-x-auto">
          {DECISION_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setSelectedDecision(tab);
                setOffset(0);
              }}
              className={`px-space-md py-1.5 rounded-lg transition-all cursor-pointer font-semibold whitespace-nowrap ${
                selectedDecision === tab
                  ? "bg-surface-container-lowest text-on-surface shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Event ID, tool, actor..."
            className="bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant px-space-md py-1.5 pl-8 rounded-lg font-body-sm text-body-sm border border-surface-container outline-hidden w-64"
          />
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant absolute left-2.5 top-2.5 pointer-events-none">
            search
          </span>
        </div>
      </section>

      {/* Main 2-Column Split: Event Stream Table (8 cols) + Selected JSON Inspector (4 cols) */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* Left: Event Table */}
        <div className="xl:col-span-8 bg-surface-container-lowest rounded-xl shadow-xs border border-surface-container overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider border-b border-surface-container">
                  <th className="py-space-sm px-space-md">Event ID</th>
                  <th className="py-space-sm px-space-md">Timestamp</th>
                  <th className="py-space-sm px-space-md">Actor / Agent</th>
                  <th className="py-space-sm px-space-md">Target Tool</th>
                  <th className="py-space-sm px-space-md">Verdict</th>
                  <th className="py-space-sm px-space-md">Risk Score</th>
                  <th className="py-space-sm px-space-md text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container font-body-sm text-body-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-on-surface-variant font-label-mono">
                      Querying PostgreSQL ledger...
                    </td>
                  </tr>
                ) : filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-on-surface-variant font-label-mono">
                      No audit events found for selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((evt) => {
                    const isSelected = selectedEvent?.id === evt.id;
                    return (
                      <tr
                        key={evt.id}
                        onClick={() => setSelectedEvent(evt)}
                        className={`hover:bg-surface-container-low/60 transition-colors cursor-pointer ${
                          isSelected ? "bg-surface-container-low/80 font-medium" : ""
                        }`}
                      >
                        <td className="py-space-md px-space-md font-label-mono text-label-mono font-bold text-on-surface">
                          #{evt.id}
                        </td>
                        <td className="py-space-md px-space-md font-label-mono text-label-mono text-on-surface-variant whitespace-nowrap">
                          {formatTime(evt.created_at)}
                        </td>
                        <td className="py-space-md px-space-md truncate max-w-[140px] text-on-surface">
                          {evt.actor_id || evt.agent_id || "Gemini-Agent"}
                        </td>
                        <td className="py-space-md px-space-md font-label-mono text-label-mono text-on-surface truncate max-w-[160px]">
                          {evt.tool_name}
                        </td>
                        <td className="py-space-md px-space-md">
                          <span className={`font-label-mono text-label-mono font-bold px-space-xs py-0.5 rounded ${decisionBadgeClass(evt.decision)}`}>
                            {evt.decision}
                          </span>
                        </td>
                        <td className="py-space-md px-space-md">
                          <span className={`font-label-mono text-label-mono font-semibold px-space-xs py-0.5 rounded ${riskBadgeClass(evt.risk_score ? (evt.risk_score >= 80 ? "CRITICAL" : evt.risk_score >= 50 ? "HIGH" : "LOW") : "LOW")}`}>
                            {evt.risk_score ?? 0}
                          </span>
                        </td>
                        <td className="py-space-md px-space-md text-right font-label-mono text-label-mono text-primary hover:underline">
                          Inspect
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-space-md bg-surface-container-low/40 flex items-center justify-between text-body-sm font-label-mono text-on-surface-variant border-t border-surface-container">
            <span>
              Showing {offset + 1}–{offset + events.length} of {totalRecords} events
            </span>
            <div className="flex items-center gap-space-xs">
              <button
                disabled={offset === 0}
                onClick={() => void fetchAuditData(Math.max(0, offset - limit), true)}
                className="px-space-sm py-1 rounded bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={offset + limit >= totalRecords}
                onClick={() => void fetchAuditData(offset + limit, true)}
                className="px-space-sm py-1 rounded bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Right: Selected Event Inspector */}
        <div className="xl:col-span-4 bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container sticky top-20 flex flex-col gap-space-md">
          {selectedEvent ? (
            <>
              <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">policy</span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Event #{selectedEvent.id}
                  </h3>
                </div>
                <button
                  onClick={() => handleCopyJson(selectedEvent)}
                  className="px-space-xs py-1 rounded bg-surface-container text-on-surface hover:bg-surface-container-high font-label-mono text-[10px] cursor-pointer"
                >
                  {copied ? "Copied" : "Copy JSON"}
                </button>
              </div>

              <div className="space-y-space-xs font-label-mono text-label-mono">
                <div className="p-space-xs px-space-sm bg-surface-container-low rounded border border-surface-container flex justify-between">
                  <span className="text-on-surface-variant">Tool:</span>
                  <span className="font-bold text-on-surface">{selectedEvent.tool_name}</span>
                </div>
                <div className="p-space-xs px-space-sm bg-surface-container-low rounded border border-surface-container flex justify-between">
                  <span className="text-on-surface-variant">Verdict:</span>
                  <span className="font-bold text-secondary">{selectedEvent.decision}</span>
                </div>
                <div className="p-space-xs px-space-sm bg-surface-container-low rounded border border-surface-container flex justify-between">
                  <span className="text-on-surface-variant">Timestamp:</span>
                  <span className="text-on-surface">{selectedEvent.created_at}</span>
                </div>
                {selectedEvent.actor_id && (
                  <div className="p-space-xs px-space-sm bg-surface-container-low rounded border border-surface-container flex justify-between">
                    <span className="text-on-surface-variant">Actor:</span>
                    <span className="text-on-surface truncate">{selectedEvent.actor_id}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="font-label-mono text-[10px] text-on-surface-variant uppercase font-semibold">
                  Event Data / Parameter Ledger
                </span>
                <pre className="mt-1 p-space-sm bg-surface-container rounded-lg font-label-mono text-code-sm text-on-surface overflow-x-auto border border-surface-container max-h-80">
                  {JSON.stringify(selectedEvent.details || selectedEvent.event_data || selectedEvent, null, 2)}
                </pre>
              </div>
            </>
          ) : (
            <div className="p-8 text-center font-label-mono text-on-surface-variant text-body-sm">
              Select an event from the audit ledger to inspect raw telemetry.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
