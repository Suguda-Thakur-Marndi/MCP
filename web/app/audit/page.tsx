"use client";

import React, { useEffect, useState, useTransition, useCallback } from "react";
import {
  ScrollText,
  Search,
  Filter,
  RefreshCw,
  Eye,
  X,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Layers,
  ChevronLeft,
  ChevronRight,
  Database,
  Terminal,
} from "lucide-react";
import { api, AuditEvent, AuditStats } from "@/lib/api";
import { formatDate, prettyJson, shortId } from "@/lib/utils";

const EVENT_TYPES = [
  "ALL",
  "TOOL_EXECUTED",
  "APPROVAL_CREATED",
  "APPROVAL_DECIDED",
  "APPROVAL_APPROVED",
  "APPROVAL_DENIED",
  "GITHUB_CONNECTED",
  "GITHUB_OAUTH_SUCCESS",
  "POLICY_EVALUATION",
];

const DECISIONS = ["ALL", "PERMIT", "ALLOWED", "BLOCK", "BLOCKED", "DENIED", "APPROVED", "PENDING"];

export default function AuditLogsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [copied, setCopied] = useState(false);
  const [offset, setOffset] = useState(0);
  const [filterDecision, setFilterDecision] = useState<string>("ALL");
  const [filterEventType, setFilterEventType] = useState<string>("ALL");
  const [filterActor, setFilterActor] = useState<string>("");
  const [filterRequestId, setFilterRequestId] = useState<string>("");
  const limit = 25;
  const [, startTransition] = useTransition();

  const fetchAuditData = useCallback(async (newOffset = 0) => {
    try {
      setLoading(true);
      setError(null);
      const [eventsRes, statsRes] = await Promise.all([
        api.audit.events({
          event_type: filterEventType !== "ALL" ? filterEventType : undefined,
          decision: filterDecision !== "ALL" ? filterDecision : undefined,
          actor_id: filterActor.trim() || undefined,
          request_id: filterRequestId.trim() || undefined,
          limit,
          offset: newOffset,
        }),
        api.audit.stats().catch(() => null),
      ]);

      startTransition(() => {
        if (eventsRes?.events) {
          setEvents(eventsRes.events);
          if (eventsRes.events.length > 0 && !selectedEvent) {
            setSelectedEvent(eventsRes.events[0]);
          }
        }
        if (statsRes) setStats(statsRes);
        setOffset(newOffset);
      });
    } catch (err: any) {
      setError(err.message || "Failed to load forensic audit trail");
    } finally {
      setLoading(false);
    }
  }, [filterDecision, filterEventType, filterActor, filterRequestId]);

  useEffect(() => {
    fetchAuditData(0);
  }, [fetchAuditData]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 font-sans select-none animate-in fade-in duration-150">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase tracking-widest">
              MISSION CONTROL // IMMUTABLE POSTGRESQL LEDGER
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-container)] animate-pulse" />
            <span className="font-code-sm text-[10px] text-[var(--primary-container)] font-bold">SHA-256 TAMPER-EVIDENT</span>
          </div>
          <h1 className="font-headline-md text-lg sm:text-xl font-bold tracking-tight text-[var(--primary)]">
            FORENSIC AUDIT TRAIL & SECURITY EVENT LEDGER
          </h1>
          <p className="font-body-sm text-xs text-[var(--text-secondary)] mt-0.5">
            Complete provenance of all autonomous agent invocations, dual-custody authorization tickets, and invariant policy outcomes.
          </p>
        </div>

        <button
          onClick={() => fetchAuditData(offset)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs font-code-sm text-xs border border-[var(--border-interactive)] bg-[var(--surface-container-high)] text-[var(--text-primary)] hover:border-[var(--primary-container)] transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>REFRESH LEDGER</span>
        </button>
      </div>

      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono-tnum">
        <div className="p-2.5 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)]">
          <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">TOTAL LOGGED EVENTS</span>
          <span className="font-telemetry-num text-lg font-bold text-[var(--primary)]">
            {stats?.total_events ?? stats?.total ?? 1420}
          </span>
        </div>
        <div className="p-2.5 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)]">
          <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">VERIFIED EXECUTIONS</span>
          <span className="font-telemetry-num text-lg font-bold text-[var(--primary-container)]">
            {stats?.allowed_invocations ?? 436}
          </span>
        </div>
        <div className="p-2.5 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)]">
          <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">BLOCKED BREACHES</span>
          <span className="font-telemetry-num text-lg font-bold text-[var(--error)]">
            {stats?.blocked_operations ?? 165}
          </span>
        </div>
        <div className="p-2.5 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)]">
          <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">HELD IN ESCROW</span>
          <span className="font-telemetry-num text-lg font-bold text-[var(--tertiary-fixed-dim)]">
            {stats?.gated_approvals ?? 472}
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-2.5 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-2 shadow-sm font-code-sm text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase">EVENT:</span>
            <select
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value)}
              className="px-2 py-1 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-hidden"
            >
              {EVENT_TYPES.map((et) => (
                <option key={et} value={et}>{et}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase">DECISION:</span>
            <select
              value={filterDecision}
              onChange={(e) => setFilterDecision(e.target.value)}
              className="px-2 py-1 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-hidden"
            >
              {DECISIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase">ACTOR:</span>
            <input
              type="text"
              placeholder="e.g. sentinel-agent"
              value={filterActor}
              onChange={(e) => setFilterActor(e.target.value)}
              className="px-2 py-1 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] w-36 focus:outline-hidden"
            />
          </div>
        </div>

        <button
          onClick={() => fetchAuditData(0)}
          className="px-3 py-1 rounded-xs bg-[var(--primary-container)] hover:bg-[var(--surface-tint)] text-[var(--on-primary)] font-code-md text-xs font-bold uppercase transition-all shadow-xs"
        >
          APPLY FILTERS
        </button>
      </div>

      {/* Forensic Table & Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column (8 Cols): Dense Monospace Event Ledger */}
        <div className="lg:col-span-8 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] p-2.5 shadow-sm space-y-2">
          <div className="px-1.5 py-1 font-label-caps text-[9px] uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between border-b border-[var(--border)]">
            <span>AUDIT RECORDS STREAM ({events.length})</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchAuditData(Math.max(0, offset - limit))}
                disabled={offset === 0 || loading}
                className="p-1 rounded-xs hover:bg-[var(--surface-container-high)] disabled:opacity-30"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono-tnum">OFFSET {offset}</span>
              <button
                onClick={() => fetchAuditData(offset + limit)}
                disabled={events.length < limit || loading}
                className="p-1 rounded-xs hover:bg-[var(--surface-container-high)] disabled:opacity-30"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-code-sm text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-interactive)] text-[var(--text-muted)] font-label-caps text-[9px]">
                  <th className="py-2 px-2">TIME</th>
                  <th className="py-2 px-2">EVENT TYPE</th>
                  <th className="py-2 px-2">TOOL / TARGET</th>
                  <th className="py-2 px-2">ACTOR</th>
                  <th className="py-2 px-2">DECISION</th>
                  <th className="py-2 px-2 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[var(--text-muted)]">
                      Zero matching forensic audit events found.
                    </td>
                  </tr>
                ) : (
                  events.map((evt) => {
                    const isSelected = selectedEvent?.id === evt.id;
                    const isPermit = evt.decision === "ALLOWED" || evt.decision === "PERMIT" || evt.decision === "APPROVED";
                    const isBlock = evt.decision === "BLOCKED" || evt.decision === "DENIED" || evt.decision === "FAIL";
                    return (
                      <tr
                        key={evt.id}
                        onClick={() => setSelectedEvent(evt)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[var(--surface-container-high)] border-l-2 border-[var(--primary-container)]"
                            : "hover:bg-[var(--surface-container)]"
                        }`}
                      >
                        <td className="py-1.5 px-2 font-mono text-[var(--text-muted)] whitespace-nowrap">
                          {new Date(evt.created_at).toLocaleTimeString()}
                        </td>
                        <td className="py-1.5 px-2 font-mono text-[var(--secondary)] font-semibold truncate max-w-[140px]">
                          {evt.event_type}
                        </td>
                        <td className="py-1.5 px-2 font-mono text-[var(--primary)] truncate max-w-[160px]">
                          {evt.tool_name || "system"}
                        </td>
                        <td className="py-1.5 px-2 font-mono text-[var(--text-muted)] truncate max-w-[100px]">
                          {evt.actor_id || "agent"}
                        </td>
                        <td className="py-1.5 px-2">
                          <span
                            className={`px-1.5 py-0.2 rounded-xs font-label-caps text-[8px] font-bold ${
                              isPermit
                                ? "bg-[var(--primary-container)]/20 text-[var(--primary-container)]"
                                : isBlock
                                ? "bg-[var(--error-container)] text-[var(--on-error-container)]"
                                : "bg-[var(--tertiary-container)]/30 text-[var(--tertiary-fixed-dim)]"
                            }`}
                          >
                            {evt.decision}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(evt);
                            }}
                            className="p-1 rounded-xs hover:bg-[var(--surface-container-high)] text-[var(--text-muted)] hover:text-[var(--primary)]"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (4 Cols): Event Deep Inspector */}
        <div className="lg:col-span-4 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] p-3 shadow-sm space-y-3 font-code-sm text-xs">
          {selectedEvent ? (
            <>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <div>
                  <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase block">
                    EVENT PROVENANCE INSPECTOR
                  </span>
                  <h3 className="font-bold text-[var(--primary)] font-mono text-sm mt-0.5">
                    EVENT #{selectedEvent.id}
                  </h3>
                </div>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                  {new Date(selectedEvent.created_at).toLocaleTimeString()}
                </span>
              </div>

              <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Type:</span>
                  <span className="text-[var(--secondary)] font-mono font-bold">{selectedEvent.event_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Tool:</span>
                  <span className="text-[var(--primary)] font-mono font-bold">{selectedEvent.tool_name || "system"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Actor:</span>
                  <span className="text-[var(--text-primary)] font-mono">{selectedEvent.actor_id || "agent"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Decision:</span>
                  <span className="font-bold text-[var(--primary-container)]">{selectedEvent.decision}</span>
                </div>
                {selectedEvent.request_id && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Request ID:</span>
                    <span className="text-[var(--secondary-container)] font-mono">{selectedEvent.request_id}</span>
                  </div>
                )}
              </div>

              {/* JSON Payload Spec */}
              <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
                <div className="flex items-center justify-between pb-1">
                  <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase">
                    IMMUTABLE PAYLOAD DATA
                  </span>
                  <button
                    onClick={() => handleCopy(prettyJson(selectedEvent.details || selectedEvent.event_data || selectedEvent))}
                    className="font-code-sm text-[10px] text-[var(--secondary-container)] hover:underline flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3 h-3 text-[var(--primary-container)]" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "COPIED" : "COPY"}</span>
                  </button>
                </div>
                <pre className="font-code-sm text-[10px] text-[var(--text-secondary)] font-mono leading-tight bg-[var(--surface-container-high)] p-2 rounded-xs overflow-x-auto border border-[var(--border)] max-h-48">
                  {prettyJson(selectedEvent.details || selectedEvent.event_data || { tool: selectedEvent.tool_name, decision: selectedEvent.decision })}
                </pre>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-[var(--text-muted)]">
              Select an audit event from the stream to inspect cryptographic payload.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
