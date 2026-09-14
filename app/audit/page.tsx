"use client";

import { useEffect, useState } from "react";
import { api, AuditEvent, AuditStats } from "@/lib/api";
import { decisionBadgeClass, formatDate, prettyJson } from "@/lib/utils";

export default function AuditLogsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchAuditData = async (newOffset = 0) => {
    try {
      setLoading(true);
      setError(null);
      const [eventsRes, statsRes] = await Promise.all([
        api.audit.events({ limit, offset: newOffset }),
        api.audit.stats().catch(() => null),
      ]);
      setEvents(eventsRes.events || []);
      setTotal(eventsRes.total || 0);
      if (statsRes) setStats(statsRes);
      setOffset(newOffset);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load audit events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData(0);
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Cryptographic Audit Trail</h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-sky-950 text-sky-400 border border-sky-800">
              POSTGRESQL AUDIT_EVENTS
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Immutable, structured audit records capturing every tool invocation, security decision, and approval gating step.
          </p>
        </div>

        <button
          onClick={() => fetchAuditData(offset)}
          disabled={loading}
          className="btn-ghost text-xs flex items-center gap-1.5"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          Refresh Logs
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(239, 68, 68, 0.12)", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {/* Audit Stats Breakdown */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-4 space-y-1">
            <div className="text-xs font-mono text-slate-400">TOTAL RECORDED EVENTS</div>
            <div className="text-2xl font-bold text-white font-mono">{stats.total}</div>
            <div className="text-[11px] text-slate-500">All sessions</div>
          </div>
          <div className="glass-card p-4 space-y-1">
            <div className="text-xs font-mono text-slate-400">ALLOWED EXECUTIONS</div>
            <div className="text-2xl font-bold text-green-400 font-mono">
              {(stats.by_decision?.ALLOW || 0) + (stats.by_decision?.ALLOWED || 0)}
            </div>
            <div className="text-[11px] text-green-500">Directly authorized</div>
          </div>
          <div className="glass-card p-4 space-y-1">
            <div className="text-xs font-mono text-slate-400">BLOCKED ATTEMPTS</div>
            <div className="text-2xl font-bold text-red-400 font-mono">
              {(stats.by_decision?.BLOCK || 0) + (stats.by_decision?.BLOCKED || 0)}
            </div>
            <div className="text-[11px] text-red-500">Security violations prevented</div>
          </div>
          <div className="glass-card p-4 space-y-1">
            <div className="text-xs font-mono text-slate-400">HUMAN APPROVAL GATED</div>
            <div className="text-2xl font-bold text-amber-400 font-mono">
              {(stats.by_decision?.REQUIRE_APPROVAL || 0) + (stats.by_decision?.APPROVAL_REQUIRED || 0)}
            </div>
            <div className="text-[11px] text-amber-500">Gating tickets dispatched</div>
          </div>
        </div>
      )}

      {/* Main Grid: Events Table & JSON Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
              Audit Event Stream ({total} records)
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <button
                disabled={offset === 0 || loading}
                onClick={() => fetchAuditData(Math.max(0, offset - limit))}
                className="px-2.5 py-1 rounded bg-slate-800 disabled:opacity-30 hover:bg-slate-700"
              >
                Previous
              </button>
              <span className="text-slate-400 font-mono">
                {offset + 1}–{Math.min(offset + limit, total)} of {total}
              </span>
              <button
                disabled={offset + limit >= total || loading}
                onClick={() => fetchAuditData(offset + limit)}
                className="px-2.5 py-1 rounded bg-slate-800 disabled:opacity-30 hover:bg-slate-700"
              >
                Next
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event Type</th>
                  <th>Tool</th>
                  <th>Decision</th>
                  <th>Risk</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-xs text-slate-400">
                      Loading audit events...
                    </td>
                  </tr>
                )}
                {!loading && events.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-xs text-slate-400 font-mono">
                      No audit events recorded yet.
                    </td>
                  </tr>
                )}
                {events.map((e) => {
                  const isSelected = selectedEvent?.id === e.id;
                  return (
                    <tr
                      key={e.id}
                      onClick={() => setSelectedEvent(e)}
                      className={`cursor-pointer ${isSelected ? "bg-sky-950/30" : ""}`}
                    >
                      <td className="whitespace-nowrap font-mono text-xs">
                        {formatDate(e.created_at)}
                      </td>
                      <td className="font-mono text-xs font-semibold text-white">
                        {e.event_type}
                      </td>
                      <td>
                        <code className="text-xs text-sky-400 font-mono">
                          {e.tool_name || "system"}
                        </code>
                      </td>
                      <td>
                        <span className={decisionBadgeClass(e.decision)}>
                          {e.decision}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-slate-300">
                        {e.risk_score !== null ? e.risk_score : "—"}
                      </td>
                      <td>
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setSelectedEvent(e);
                          }}
                          className="text-xs text-sky-400 hover:underline font-mono"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* JSON Inspector Pane */}
        <div className="lg:col-span-4 glass-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
              Event Payload Inspector
            </h3>
            {selectedEvent && (
              <span className="text-[10px] font-mono text-slate-400">
                ID: {selectedEvent.id.substring(0, 8)}…
              </span>
            )}
          </div>

          {!selectedEvent ? (
            <div className="text-center py-20 text-xs font-mono text-slate-500">
              Select an event from the table to view its full JSON payload, redaction telemetry, and metadata.
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <div className="text-slate-400 font-mono text-[11px]">Event Type:</div>
                <div className="text-white font-mono font-semibold">{selectedEvent.event_type}</div>
              </div>

              {selectedEvent.policy_id && (
                <div className="space-y-1">
                  <div className="text-slate-400 font-mono text-[11px]">Policy ID:</div>
                  <div className="text-sky-300 font-mono">{selectedEvent.policy_id}</div>
                </div>
              )}

              {selectedEvent.agent_id && (
                <div className="space-y-1">
                  <div className="text-slate-400 font-mono text-[11px]">Agent Correlation ID:</div>
                  <div className="text-slate-200 font-mono text-[11px] break-all">{selectedEvent.agent_id}</div>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="text-slate-400 font-mono text-[11px]">Structured Payload:</div>
                <pre
                  className="p-3 rounded-lg text-[11px] font-mono overflow-x-auto text-emerald-400 max-h-96"
                  style={{ background: "#050914", border: "1px solid var(--border)" }}
                >
                  {prettyJson(selectedEvent.event_data || {})}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
