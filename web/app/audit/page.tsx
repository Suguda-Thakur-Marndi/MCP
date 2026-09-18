"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
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
  const [filterDecision, setFilterDecision] = useState<string>("ALL");
  const [filterTool, setFilterTool] = useState<string>("ALL");
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
          decision: filterDecision !== "ALL" ? filterDecision : undefined,
          tool_name: filterTool !== "ALL" ? filterTool : undefined,
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
  }, [filterDecision, filterTool, filterActor, filterRequestId]);

  useEffect(() => {
    fetchAuditData(0);
  }, [fetchAuditData]);

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

      {/* Server-Side Filter Controls */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-3 text-xs">
        <span className="font-mono text-slate-400 text-[11px]">Server Filters:</span>

        {/* Decision Filter */}
        <select
          value={filterDecision}
          onChange={(e) => setFilterDecision(e.target.value)}
          className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
        >
          <option value="ALL">All Decisions</option>
          <option value="ALLOW">ALLOW</option>
          <option value="BLOCK">BLOCK</option>
          <option value="REQUIRE_APPROVAL">REQUIRE_APPROVAL</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="DENIED">DENIED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>

        {/* Tool Filter */}
        <select
          value={filterTool}
          onChange={(e) => setFilterTool(e.target.value)}
          className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
        >
          <option value="ALL">All Tools</option>
          <option value="get_customer">get_customer</option>
          <option value="list_customers">list_customers</option>
          <option value="update_customer_status">update_customer_status</option>
          <option value="delete_customer">delete_customer</option>
          <option value="add_audit_note">add_audit_note</option>
          <option value="get_order">get_order</option>
          <option value="list_customer_orders">list_customer_orders</option>
          <option value="update_order_status">update_order_status</option>
        </select>

        {/* Actor Filter */}
        <input
          type="text"
          placeholder="Filter by Actor ID..."
          value={filterActor}
          onChange={(e) => setFilterActor(e.target.value)}
          className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-sky-500 w-44"
        />

        {/* Request Correlation ID Filter */}
        <input
          type="text"
          placeholder="Filter by Request ID..."
          value={filterRequestId}
          onChange={(e) => setFilterRequestId(e.target.value)}
          className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-sky-500 w-48"
        />

        {(filterDecision !== "ALL" || filterTool !== "ALL" || filterActor || filterRequestId) && (
          <button
            onClick={() => {
              setFilterDecision("ALL");
              setFilterTool("ALL");
              setFilterActor("");
              setFilterRequestId("");
            }}
            className="text-xs text-sky-400 hover:underline font-mono ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

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
                {total > 0 ? `${offset + 1}–${Math.min(offset + limit, total)} of ${total}` : "0 of 0"}
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
                  <th>Actor</th>
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
                      No audit events matching current criteria.
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
                      <td className="font-mono text-xs text-slate-300 truncate max-w-[120px]">
                        {e.actor_id || e.actor_type || "—"}
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
                ID: {String(selectedEvent.id).substring(0, 8)}…
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

              {selectedEvent.actor_id && (
                <div className="space-y-1">
                  <div className="text-slate-400 font-mono text-[11px]">Actor:</div>
                  <div className="text-slate-200 font-mono text-[11px]">
                    {selectedEvent.actor_id} {selectedEvent.actor_type ? `(${selectedEvent.actor_type})` : ""}
                  </div>
                </div>
              )}

              {selectedEvent.request_id && (
                <div className="space-y-1">
                  <div className="text-slate-400 font-mono text-[11px]">Correlation Request ID:</div>
                  <div className="text-sky-300 font-mono text-[11px] break-all">{selectedEvent.request_id}</div>
                </div>
              )}

              {selectedEvent.policy_id && (
                <div className="space-y-1">
                  <div className="text-slate-400 font-mono text-[11px]">Policy ID:</div>
                  <div className="text-sky-300 font-mono">{selectedEvent.policy_id}</div>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="text-slate-400 font-mono text-[11px]">Structured Payload:</div>
                <pre
                  className="p-3 rounded-lg text-[11px] font-mono overflow-x-auto text-emerald-400 max-h-96"
                  style={{ background: "#050914", border: "1px solid var(--border)" }}
                >
                  {prettyJson(selectedEvent.details || selectedEvent.event_data || {})}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
