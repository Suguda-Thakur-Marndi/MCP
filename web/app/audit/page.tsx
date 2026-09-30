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
  Ban,
  Activity,
  Layers,
  ChevronLeft,
  ChevronRight,
  Database,
  FileCheck,
} from "lucide-react";
import { api, AuditEvent, AuditStats } from "@/lib/api";
import { formatDate, relativeTime, prettyJson, shortId } from "@/lib/utils";
import { DecisionBadge } from "@/components/ui/Badges";
import { DataTable, Column } from "@/components/ui/DataTable";
import { LoadingState, EmptyState } from "@/components/ui/FeedbackStates";

const EVENT_TYPES = [
  "ALL",
  "TOOL_INVOCATION",
  "POLICY_EVALUATION",
  "APPROVAL_CREATED",
  "APPROVAL_DECIDED",
  "EXECUTION_BLOCKED",
  "UNTRUSTED_DATA_DETECTED",
  "SESSION_AUTHENTICATED",
];

const DECISIONS = ["ALL", "ALLOW", "BLOCK", "REQUIRE_APPROVAL"];

export default function AuditLogsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [copied, setCopied] = useState(false);
  const [offset, setOffset] = useState(0);
  const [filterDecision, setFilterDecision] = useState<string>("ALL");
  const [filterEventType, setFilterEventType] = useState<string>("ALL");
  const [filterActor, setFilterActor] = useState<string>("");
  const [filterRequestId, setFilterRequestId] = useState<string>("");
  const limit = 20;
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
        setEvents(eventsRes.events || []);
        setTotal(eventsRes.total || 0);
        if (statsRes) setStats(statsRes);
        setOffset(newOffset);
        setLoading(false);
      });
    } catch (err: unknown) {
      startTransition(() => {
        setError(err instanceof Error ? err.message : "Failed to load audit events");
        setLoading(false);
      });
    }
  }, [filterEventType, filterDecision, filterActor, filterRequestId]);

  useEffect(() => {
    fetchAuditData(0);
  }, [fetchAuditData]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const columns: Column<AuditEvent>[] = [
    {
      key: "created_at",
      header: "Timestamp",
      width: "140px",
      render: (row) => (
        <span className="font-mono-tnum text-[11px] text-[var(--text-muted)]" title={formatDate(row.created_at)}>
          {relativeTime(row.created_at)}
        </span>
      ),
    },
    {
      key: "event_type",
      header: "Event Type",
      render: (row) => (
        <span className="font-mono-tnum text-[11px] font-semibold text-[var(--text-primary)]">
          {row.event_type}
        </span>
      ),
    },
    {
      key: "tool_name",
      header: "Tool / Channel",
      render: (row) => (
        <span className="font-mono-tnum text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]">
          {row.tool_name || "system_invariant"}
        </span>
      ),
    },
    {
      key: "decision",
      header: "Decision",
      render: (row) => <DecisionBadge decision={row.decision} />,
    },
    {
      key: "actor_id",
      header: "Actor Identity",
      render: (row) => (
        <span className="font-mono-tnum text-[11px] text-[var(--text-secondary)]">
          {row.actor_id || "agent"}
        </span>
      ),
    },
    {
      key: "request_id",
      header: "Request ID",
      render: (row) => (
        <span className="font-mono-tnum text-[11px] text-[var(--text-muted)] truncate max-w-[120px] block">
          {row.request_id ? `${row.request_id.substring(0, 12)}…` : "—"}
        </span>
      ),
    },
    {
      key: "id",
      header: "",
      align: "right",
      render: (row) => (
        <button
          onClick={() => setSelectedEvent(row)}
          className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-secondary)] transition-colors"
          title="Inspect forensic payload"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono-tnum font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Compliance & Forensics
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
            <span className="text-[10px] font-mono-tnum text-[var(--success)] font-semibold">IMMUTABLE POSTGRESQL LEDGER</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Cryptographic Audit Trail
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Append-only structured audit logs capturing every tool invocation, security decision, parameter payload, and governance intervention.
          </p>
        </div>

        <button
          onClick={() => fetchAuditData(offset)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Summary Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border)] border-l-2 border-l-[var(--accent)]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">Total Logged Events</span>
          <span className="text-xl font-bold font-mono-tnum text-[var(--text-primary)]">{total || stats?.total_events || 0}</span>
          <span className="text-[10px] text-[var(--text-muted)] block mt-1">PostgreSQL 16 Append-Only</span>
        </div>
        <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border)] border-l-2 border-l-[var(--success)]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">Allowed Dispatches</span>
          <span className="text-xl font-bold font-mono-tnum text-[var(--success)]">{stats?.allowed_invocations || 0}</span>
          <span className="text-[10px] text-[var(--text-muted)] block mt-1">Policy Validated Invariant</span>
        </div>
        <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border)] border-l-2 border-l-[var(--danger)]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">Blocked Operations</span>
          <span className="text-xl font-bold font-mono-tnum text-[var(--danger)]">{stats?.blocked_operations || 0}</span>
          <span className="text-[10px] text-[var(--text-muted)] block mt-1">Neutralized Breaches</span>
        </div>
        <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border)] border-l-2 border-l-[var(--warning)]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">Gated Dual Custody</span>
          <span className="text-xl font-bold font-mono-tnum text-[var(--warning)]">{stats?.gated_approvals || 0}</span>
          <span className="text-[10px] text-[var(--text-muted)] block mt-1">Human Interventions</span>
        </div>
      </div>

      {/* Structured Filter Toolbar */}
      <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs shadow-xs">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
            Event Type
          </label>
          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--accent)]"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
            Gate Decision
          </label>
          <select
            value={filterDecision}
            onChange={(e) => setFilterDecision(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--accent)]"
          >
            {DECISIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
            Actor ID
          </label>
          <input
            type="text"
            placeholder="e.g. agent or admin"
            value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
            Request Correlation ID
          </label>
          <input
            type="text"
            placeholder="e.g. req_abc123"
            value={filterRequestId}
            onChange={(e) => setFilterRequestId(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* Audit Log Data Table */}
      <div className="rounded bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)] text-xs">
          <span className="font-semibold text-[var(--text-primary)] font-mono-tnum">
            Showing {events.length} of {total} Records
          </span>
          <span className="text-[10px] text-[var(--text-muted)] font-mono-tnum">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        <DataTable
          data={events}
          columns={columns}
          emptyMessage="No audit ledger records match the active filters."
        />

        {/* Pagination Controls */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] text-xs font-mono-tnum">
          <button
            onClick={() => fetchAuditData(Math.max(0, offset - limit))}
            disabled={offset === 0 || loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <span className="text-[11px] text-[var(--text-muted)]">
            Rows {offset + 1}–{Math.min(total, offset + limit)}
          </span>

          <button
            onClick={() => fetchAuditData(offset + limit)}
            disabled={offset + limit >= total || loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Forensic Event Detail Drawer / Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded max-w-xl w-full p-5 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Audit Event #{selectedEvent.id} Forensics
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs font-mono-tnum">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[9px] text-[var(--text-muted)] uppercase block">Event Type</span>
                  <span className="font-semibold text-[var(--text-primary)]">{selectedEvent.event_type}</span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[9px] text-[var(--text-muted)] uppercase block">Decision</span>
                  <DecisionBadge decision={selectedEvent.decision} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[9px] text-[var(--text-muted)] uppercase block">Dispatched Tool</span>
                  <span className="font-semibold text-[var(--text-primary)]">{selectedEvent.tool_name || "system_invariant"}</span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[9px] text-[var(--text-muted)] uppercase block">Actor Identity</span>
                  <span className="font-semibold text-[var(--text-primary)]">{selectedEvent.actor_id || "agent"}</span>
                </div>
              </div>

              <div className="p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-[var(--text-muted)] uppercase block">Request Correlation ID</span>
                  <button
                    onClick={() => handleCopy(selectedEvent.request_id || "")}
                    className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
                    <span>Copy ID</span>
                  </button>
                </div>
                <span className="text-[11px] text-[var(--text-primary)] select-all">{selectedEvent.request_id || "—"}</span>
              </div>

              {selectedEvent.parameters && (
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block mb-1">
                    Structured Parameters Payload
                  </span>
                  <pre className="p-3 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[10px] leading-relaxed text-[var(--text-primary)] overflow-x-auto">
                    {prettyJson(selectedEvent.parameters)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-3.5 py-1.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-medium hover:bg-[var(--border)] transition-colors"
              >
                Close Forensics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
