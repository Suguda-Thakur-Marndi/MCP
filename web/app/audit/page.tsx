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
  Fingerprint,
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
          className="font-mono text-[11px] text-[#6B7280] dark:text-slate-400"
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
        <span className="font-mono text-xs font-semibold text-[#1A202E] dark:text-slate-200">
          {row.event_type}
        </span>
      ),
    },
    {
      key: "tool_name",
      header: "Tool / Channel",
      render: (row) => (
        <code className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#D05A40]/10 text-[#D05A40] border border-[#D05A40]/30 font-semibold">
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
        <span className="font-mono text-[11px] text-[#475063] dark:text-slate-400 truncate max-w-[130px] block">
          {row.actor_id || "agent"}
        </span>
      ),
    },
    {
      key: "request_id",
      header: "Request ID",
      render: (row) => (
        <span className="font-mono text-[11px] text-[#6B7280] dark:text-slate-500 truncate max-w-[110px] block">
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
          className="p-1.5 rounded text-[#6B7280] hover:text-[#D05A40] hover:bg-[#EFECE5] dark:hover:bg-slate-800 transition-colors"
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#D1CEC7] dark:border-[#26344A]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#D05A40] font-bold mb-1">
            <span>COMPLIANCE & FORENSICS</span>
            <span>/</span>
            <span>POSTGRESQL AUDIT LEDGER</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A202E] dark:text-[#F4F6F9] tracking-tight">
              Cryptographic Audit Trail
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-teal-50 text-[#2C6E65] border border-teal-300 dark:bg-[#3A8A7F]/20 dark:text-[#4EA699] dark:border-[#3A8A7F]/40 font-bold">
              {total} TOTAL EVENTS RECORDED
            </span>
          </div>
          <p className="text-xs text-[#475063] dark:text-[#94A3B8] mt-1 max-w-2xl leading-relaxed">
            Append-only structured audit logs capturing every tool invocation, security decision, parameter payload, and governance intervention.
          </p>
        </div>

        <button
          onClick={() => fetchAuditData(offset)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] text-xs font-medium text-[#1A202E] dark:text-slate-300 hover:border-[#D05A40] transition-colors disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl text-xs border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 flex items-center justify-between shadow-sm">
          <span>{error}</span>
          <button onClick={() => fetchAuditData(offset)} className="font-semibold underline hover:text-red-950">
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
            subtext="Adversarial / Gated"
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
      <div className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#1A202E] dark:text-slate-300 flex items-center gap-1.5 font-sans">
            <Filter className="w-3.5 h-3.5 text-[#D05A40]" />
            Filter Audit Trail
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
              className="text-[11px] font-mono text-[#D05A40] hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Event Type Filter */}
          <div>
            <label className="text-[10px] uppercase font-mono text-[#6B7280] dark:text-slate-400 block mb-1">Event Type</label>
            <select
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A] text-[#1A202E] dark:text-slate-200 focus:outline-none focus:border-[#D05A40] font-sans"
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
            <label className="text-[10px] uppercase font-mono text-[#6B7280] dark:text-slate-400 block mb-1">Decision</label>
            <select
              value={filterDecision}
              onChange={(e) => setFilterDecision(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A] text-[#1A202E] dark:text-slate-200 focus:outline-none focus:border-[#D05A40] font-sans"
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
            <label className="text-[10px] uppercase font-mono text-[#6B7280] dark:text-slate-400 block mb-1">Actor ID</label>
            <input
              type="text"
              placeholder="e.g. agent-001 or admin"
              value={filterActor}
              onChange={(e) => setFilterActor(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A] text-[#1A202E] dark:text-slate-200 focus:outline-none focus:border-[#D05A40] font-mono text-xs"
            />
          </div>

          {/* Request ID Search */}
          <div>
            <label className="text-[10px] uppercase font-mono text-[#6B7280] dark:text-slate-400 block mb-1">Request ID</label>
            <input
              type="text"
              placeholder="e.g. req_abc123"
              value={filterRequestId}
              onChange={(e) => setFilterRequestId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A] text-[#1A202E] dark:text-slate-200 focus:outline-none focus:border-[#D05A40] font-mono text-xs"
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

      {/* Event Detail Modal / Slide-over */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] shadow-2xl overflow-hidden p-6 space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D1CEC7] dark:border-[#26344A]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#1A202E] dark:text-white font-mono">{selectedEvent.event_type}</h3>
                  <DecisionBadge decision={selectedEvent.decision} />
                </div>
                <span className="text-xs text-[#6B7280] dark:text-slate-400 font-mono">
                  ID: {selectedEvent.id} • {formatDate(selectedEvent.created_at)}
                </span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded text-slate-400 hover:text-[#1A202E] dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[10px] text-[#6B7280] dark:text-slate-500 uppercase font-mono block">Tool Name</span>
                <span className="font-mono text-[#D05A40] font-semibold">{selectedEvent.tool_name || "—"}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[10px] text-[#6B7280] dark:text-slate-500 uppercase font-mono block">Actor Type</span>
                <span className="font-mono text-[#1A202E] dark:text-slate-200">{selectedEvent.actor_type || "agent"}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[10px] text-[#6B7280] dark:text-slate-500 uppercase font-mono block">Risk Score</span>
                <span className="font-mono text-[#E3A03E] font-bold">{selectedEvent.risk_score ?? "N/A"}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[10px] text-[#6B7280] dark:text-slate-500 uppercase font-mono block">Policy ID</span>
                <span className="font-mono text-[#1A202E] dark:text-slate-300 truncate block">{selectedEvent.policy_id || "sentinel-core"}</span>
              </div>
            </div>

            {/* Event Details JSON */}
            <div className="space-y-1.5 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#1A202E] dark:text-slate-300 font-bold font-sans">Structured Event Payload:</span>
                <button
                  onClick={() => handleCopy(prettyJson(selectedEvent.details || selectedEvent.event_data || selectedEvent))}
                  className="inline-flex items-center gap-1 text-[11px] text-[#D05A40] hover:text-[#B84E37] font-mono font-semibold"
                >
                  {copied ? <Check className="w-3 h-3 text-[#3A8A7F]" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy Payload"}</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-lg bg-[#F8F6F0] dark:bg-[#0D1117] border border-[#D1CEC7] dark:border-[#26344A] text-[11px] font-mono text-[#1A202E] dark:text-sky-300 overflow-y-auto flex-1 select-all">
                {prettyJson(selectedEvent.details || selectedEvent.event_data || selectedEvent)}
              </pre>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 rounded-lg bg-[#D05A40] hover:bg-[#B84E37] text-xs font-semibold text-white transition-colors"
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
