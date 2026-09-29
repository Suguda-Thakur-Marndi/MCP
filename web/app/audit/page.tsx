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
} from "lucide-react";
import { api, AuditEvent, AuditStats } from "@/lib/api";
import { formatDate, relativeTime, prettyJson } from "@/lib/utils";
import { DecisionBadge } from "@/components/ui/Badges";
import { MetricCard } from "@/components/ui/MetricCard";
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
          event_type: filterEventType !== "ALL" ? filterEventType : undefined,
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
  }, [filterEventType, filterDecision, filterTool, filterActor, filterRequestId]);

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
        <span
          className="font-mono text-[11px] text-slate-400"
          title={formatDate(row.created_at)}
        >
          {relativeTime(row.created_at)}
        </span>
      ),
    },
    {
      key: "event_type",
      header: "Event Type",
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-200">
          {row.event_type}
        </span>
      ),
    },
    {
      key: "tool_name",
      header: "Tool / Channel",
      render: (row) => (
        <code className="px-2 py-0.5 rounded text-[11px] font-mono bg-sky-950/40 text-sky-400 border border-sky-800/50">
          {row.tool_name || "system"}
        </code>
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
        <span className="font-mono text-[11px] text-slate-400 truncate max-w-[130px] block">
          {row.actor_id || "agent"}
        </span>
      ),
    },
    {
      key: "request_id",
      header: "Request ID",
      render: (row) => (
        <span className="font-mono text-[11px] text-slate-500 truncate max-w-[110px] block">
          {row.request_id ? `${row.request_id.substring(0, 10)}…` : "—"}
        </span>
      ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedEvent(row);
          }}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          title="Inspect Event JSON"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#243044]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
            <span>Compliance & Forensics</span>
            <span>/</span>
            <span className="text-sky-400">PostgreSQL Immutable Ledger</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
              Cryptographic Audit Trail
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-sky-950/50 text-sky-400 border border-sky-800/60">
              {total} TOTAL EVENTS RECORDED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Append-only structured audit logs capturing every tool invocation, security decision, parameter payload, and governance intervention.
          </p>
        </div>

        <button
          onClick={() => fetchAuditData(offset)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#111827] border border-[#243044] text-xs font-medium text-slate-300 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg text-xs border border-rose-900/50 bg-rose-950/30 text-rose-200 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => fetchAuditData(offset)} className="font-semibold underline hover:text-white">
            Retry
          </button>
        </div>
      )}

      {/* Audit Stats Breakdown */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <MetricCard
            title="Total Events"
            value={stats.total}
            icon={ScrollText}
            subtext="Complete Audit Trail"
          />
          <MetricCard
            title="Allowed Invocations"
            value={stats.by_decision?.["ALLOW"] ?? 0}
            icon={ShieldCheck}
            variant="success"
            subtext="Policy Validated"
          />
          <MetricCard
            title="Blocked Operations"
            value={stats.by_decision?.["BLOCK"] ?? 0}
            icon={Ban}
            variant="critical"
            subtext="Adversarial / Unauthorized"
          />
          <MetricCard
            title="Gated Approvals"
            value={stats.by_decision?.["REQUIRE_APPROVAL"] ?? 0}
            icon={Activity}
            variant="warning"
            subtext="Human Interventions"
          />
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 rounded-lg bg-[#111827] border border-[#243044] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-sky-400" />
            Filter Audit Ledger
          </span>
          {(filterEventType !== "ALL" || filterDecision !== "ALL" || filterActor || filterRequestId) && (
            <button
              onClick={() => {
                setFilterEventType("ALL");
                setFilterDecision("ALL");
                setFilterTool("ALL");
                setFilterActor("");
                setFilterRequestId("");
              }}
              className="text-[11px] font-mono text-sky-400 hover:underline"
            >
              Reset All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Event Type Filter */}
          <div>
            <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Event Type</label>
            <select
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md bg-[#0F172A] border border-[#243044] text-slate-200 focus:outline-none focus:border-sky-500 font-sans"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Decision Filter */}
          <div>
            <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Decision</label>
            <select
              value={filterDecision}
              onChange={(e) => setFilterDecision(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md bg-[#0F172A] border border-[#243044] text-slate-200 focus:outline-none focus:border-sky-500 font-sans"
            >
              {DECISIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Actor ID Search */}
          <div>
            <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Actor ID</label>
            <input
              type="text"
              placeholder="e.g. agent-001 or admin"
              value={filterActor}
              onChange={(e) => setFilterActor(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md bg-[#0F172A] border border-[#243044] text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-xs"
            />
          </div>

          {/* Request ID Search */}
          <div>
            <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Request ID</label>
            <input
              type="text"
              placeholder="e.g. req_abc123"
              value={filterRequestId}
              onChange={(e) => setFilterRequestId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md bg-[#0F172A] border border-[#243044] text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Events DataTable */}
      <DataTable
        columns={columns}
        data={events}
        isLoading={loading}
        totalItems={total}
        pageSize={limit}
        currentPage={currentPage}
        onPageChange={(page) => fetchAuditData((page - 1) * limit)}
        emptyTitle="No Audit Events Found"
        emptyMessage="No audit logs match your query criteria."
        onRowClick={(row) => setSelectedEvent(row)}
      />

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-[#0F172A] border border-[#243044] shadow-2xl overflow-hidden p-6 space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#243044]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white font-mono">{selectedEvent.event_type}</h3>
                  <DecisionBadge decision={selectedEvent.decision} />
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  ID: {selectedEvent.id} • {formatDate(selectedEvent.created_at)}
                </span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2 rounded bg-[#111827] border border-[#243044]">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Tool Name</span>
                <span className="font-mono text-sky-400 font-semibold">{selectedEvent.tool_name || "—"}</span>
              </div>
              <div className="p-2 rounded bg-[#111827] border border-[#243044]">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Actor Type</span>
                <span className="font-mono text-slate-200">{selectedEvent.actor_type || "agent"}</span>
              </div>
              <div className="p-2 rounded bg-[#111827] border border-[#243044]">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Risk Score</span>
                <span className="font-mono text-amber-400 font-bold">{selectedEvent.risk_score ?? "N/A"}</span>
              </div>
              <div className="p-2 rounded bg-[#111827] border border-[#243044]">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Policy ID</span>
                <span className="font-mono text-slate-300 truncate block">{selectedEvent.policy_id || "sentinel-core"}</span>
              </div>
            </div>

            {/* Event Details JSON */}
            <div className="space-y-1.5 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">Structured Event Payload:</span>
                <button
                  onClick={() => handleCopy(prettyJson(selectedEvent.details || selectedEvent.event_data || selectedEvent))}
                  className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-mono"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy Payload"}</span>
                </button>
              </div>
              <pre className="p-3 rounded bg-[#0B0F14] border border-[#243044] text-[11px] font-mono text-sky-300 overflow-y-auto flex-1 select-all">
                {prettyJson(selectedEvent.details || selectedEvent.event_data || selectedEvent)}
              </pre>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
