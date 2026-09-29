"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  Ban,
  Activity,
  Users,
  ShoppingBag,
  RefreshCw,
  ArrowRight,
  Bot,
  Sliders,
  CheckCircle,
  Eye,
  X,
  Copy,
  Check,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { api, DashboardStats } from "@/lib/api";
import { relativeTime, formatDate, prettyJson } from "@/lib/utils";
import { MetricCard } from "@/components/ui/MetricCard";
import { DecisionBadge } from "@/components/ui/Badges";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Skeleton } from "@/components/ui/FeedbackStates";

interface DecisionEvent {
  id: string;
  event_type: string;
  tool_name: string;
  decision: string;
  created_at: string;
}

const DECISION_COLORS: Record<string, string> = {
  ALLOW: "#22C55E",
  ALLOWED: "#22C55E",
  PASS: "#22C55E",
  BLOCK: "#EF4444",
  BLOCKED: "#EF4444",
  DENY: "#EF4444",
  REQUIRE_APPROVAL: "#F59E0B",
  PENDING: "#F59E0B",
};

export default function DashboardPage() {
  const [, startTransition] = useTransition();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<DecisionEvent | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.dashboard.stats();
      startTransition(() => {
        setStats(data);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dashboard metrics";
      startTransition(() => {
        setError(msg);
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    let active = true;
    api.dashboard
      .stats()
      .then((data) => {
        if (active) {
          startTransition(() => {
            setStats(data);
            setLoading(false);
          });
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg = err instanceof Error ? err.message : "Failed to load dashboard metrics";
          startTransition(() => {
            setError(msg);
            setLoading(false);
          });
        }
      });

    const interval = setInterval(() => {
      api.dashboard
        .stats()
        .then((data) => {
          if (active) {
            startTransition(() => {
              setStats(data);
            });
          }
        })
        .catch(() => {});
    }, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Prepare Decision Distribution Chart Data
  const decisionChartData = React.useMemo(() => {
    if (!stats?.recent_security_events) return [];
    const counts: Record<string, number> = {};
    stats.recent_security_events.forEach((e) => {
      const d = e.decision.toUpperCase();
      counts[d] = (counts[d] || 0) + 1;
    });

    // If counts empty, seed from metrics
    if (Object.keys(counts).length === 0 && stats?.metrics) {
      if (stats.metrics.completed_approvals > 0) counts["ALLOW"] = stats.metrics.completed_approvals;
      if (stats.metrics.blocked_actions > 0) counts["BLOCK"] = stats.metrics.blocked_actions;
      if (stats.metrics.pending_approvals > 0) counts["REQUIRE_APPROVAL"] = stats.metrics.pending_approvals;
    }

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: DECISION_COLORS[name] || "#38BDF8",
    }));
  }, [stats]);

  // Activity By Tool Chart Data
  const toolActivityData = React.useMemo(() => {
    if (!stats?.recent_security_events) return [];
    const toolCounts: Record<string, number> = {};
    stats.recent_security_events.forEach((e) => {
      const tool = e.tool_name || "system";
      toolCounts[tool] = (toolCounts[tool] || 0) + 1;
    });
    return Object.entries(toolCounts)
      .slice(0, 5)
      .map(([tool, count]) => ({
        tool: tool.replace(/_/g, " "),
        count,
      }));
  }, [stats]);

  const recentColumns: Column<DecisionEvent>[] = [
    {
      key: "created_at",
      header: "Timestamp",
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
      header: "Target Tool",
      render: (row) => (
        <code className="px-2 py-0.5 rounded text-[11px] font-mono bg-sky-950/40 text-sky-400 border border-sky-800/50">
          {row.tool_name || "system"}
        </code>
      ),
    },
    {
      key: "decision",
      header: "Security Decision",
      render: (row) => <DecisionBadge decision={row.decision} />,
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
          title="Inspect Event"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Title & Operational Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#243044]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
            <span>Control Tower</span>
            <span>/</span>
            <span className="text-sky-400">Security Gatekeeper</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
              Security Command Center
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-950/50 text-emerald-400 border border-emerald-800/60">
              <span className="pulse-dot bg-emerald-400" />
              LIVE TELEMETRY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Real-time policy enforcement, AI agent oversight, and cryptographic gating telemetry powered by FastMCP.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#111827] border border-[#243044] text-xs font-medium text-slate-300 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/approvals"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white text-xs font-semibold shadow-sm transition-all hover:shadow-sky-500/20"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Review Approvals</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg text-xs flex items-center justify-between border border-rose-900/50 bg-rose-950/30 text-rose-200">
          <span>{error}</span>
          <button onClick={fetchStats} className="font-semibold underline hover:text-white">
            Retry
          </button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <MetricCard
          title="Pending Approvals"
          value={loading ? "—" : stats?.metrics.pending_approvals ?? 0}
          icon={ShieldAlert}
          variant={(stats?.metrics.pending_approvals ?? 0) > 0 ? "warning" : "default"}
          trend={(stats?.metrics.pending_approvals ?? 0) > 0 ? "Requires Review" : "Clear"}
          trendDirection={(stats?.metrics.pending_approvals ?? 0) > 0 ? "up" : "neutral"}
          subtext="Human Gated"
        />
        <MetricCard
          title="Blocked Actions"
          value={loading ? "—" : stats?.metrics.blocked_actions ?? 0}
          icon={Ban}
          variant={(stats?.metrics.blocked_actions ?? 0) > 0 ? "critical" : "default"}
          trend="0 Breaches"
          trendDirection="down"
          subtext="Denied by Policy"
        />
        <MetricCard
          title="Authorized Runs"
          value={loading ? "—" : stats?.metrics.completed_approvals ?? 0}
          icon={ShieldCheck}
          variant="success"
          trend="Cryptographic"
          trendDirection="down"
          subtext="Verified Hash"
        />
        <MetricCard
          title="Audit Events"
          value={loading ? "—" : stats?.metrics.audit_events ?? 0}
          icon={Activity}
          variant="info"
          subtext="PostgreSQL Trail"
        />
        <MetricCard
          title="Protected Customers"
          value={loading ? "—" : stats?.metrics.customers ?? 0}
          icon={Users}
          subtext="Indexed Records"
        />
        <MetricCard
          title="Managed Orders"
          value={loading ? "—" : stats?.metrics.orders ?? 0}
          icon={ShoppingBag}
          subtext="Secured Items"
        />
      </div>

      {/* Visual Analytics & Operational Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security Decision Distribution */}
        <div className="p-5 rounded-lg bg-[#111827] border border-[#243044] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#243044]">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-500 block">Distribution</span>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Security Decision Ratio
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">TELEMETRY</span>
          </div>

          <div className="py-4 h-48 flex items-center justify-center">
            {mounted && decisionChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={decisionChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {decisionChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#0F172A" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      borderColor: "#243044",
                      borderRadius: "6px",
                      fontSize: "11px",
                      color: "#F8FAFC",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500 font-mono">No decision samples recorded</div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#243044] text-[11px]">
            {decisionChartData.map((item) => (
              <div key={item.name} className="flex flex-col items-center">
                <span className="text-[10px] font-mono text-slate-400 truncate">{item.name}</span>
                <span className="font-mono-tnum font-bold text-slate-200">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity by Tool Invocation */}
        <div className="p-5 rounded-lg bg-[#111827] border border-[#243044] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#243044]">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-500 block">Activity</span>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Top Invocations by Tool
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">FASTMCP</span>
          </div>

          <div className="py-4 h-48 flex items-center justify-center">
            {mounted && toolActivityData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={toolActivityData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="tool"
                    type="category"
                    tick={{ fill: "#94A3B8", fontSize: 10 }}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      borderColor: "#243044",
                      borderRadius: "6px",
                      fontSize: "11px",
                      color: "#F8FAFC",
                    }}
                  />
                  <Bar dataKey="count" fill="#38BDF8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500 font-mono">No recent tool activity</div>
            )}
          </div>

          <div className="pt-3 border-t border-[#243044] flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>FastMCP Pre-hook Enforcement</span>
            <span className="text-emerald-400">ACTIVE</span>
          </div>
        </div>

        {/* Security Perimeter Guarantees */}
        <div className="p-5 rounded-lg bg-[#111827] border border-[#243044] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#243044]">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-500 block">Perimeter</span>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Active Security Invariants
              </h3>
            </div>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="space-y-2.5 py-3 text-xs">
            <div className="flex items-center justify-between p-2 rounded bg-[#0F172A] border border-[#243044]">
              <span className="text-slate-300">Model Oversight</span>
              <span className="font-mono text-emerald-400 font-semibold text-[11px]">Server Gated</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-[#0F172A] border border-[#243044]">
              <span className="text-slate-300">Parameter Tamper Defense</span>
              <span className="font-mono text-sky-400 font-semibold text-[11px]">SHA-256 Gated</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-[#0F172A] border border-[#243044]">
              <span className="text-slate-300">Untrusted Data Tagging</span>
              <span className="font-mono text-emerald-400 font-semibold text-[11px]">Active</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-[#0F172A] border border-[#243044]">
              <span className="text-slate-300">Replay Protection</span>
              <span className="font-mono text-purple-400 font-semibold text-[11px]">One-Time Consume</span>
            </div>
          </div>

          <div className="pt-3 border-t border-[#243044] flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-mono text-slate-500">Security Gate Status</span>
            <span className="font-mono text-emerald-400 font-semibold">100% PASS</span>
          </div>
        </div>
      </div>

      {/* Recent Security Decisions Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Recent Security Decisions
            </h2>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
              {stats?.recent_security_events?.length ?? 0} Events
            </span>
          </div>
          <Link
            href="/audit"
            className="text-xs font-medium text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 transition-colors"
          >
            <span>View Complete Audit Log</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <DataTable
          columns={recentColumns}
          data={stats?.recent_security_events || []}
          isLoading={loading}
          emptyTitle="No Security Decisions Recorded"
          emptyMessage="No tool invocations or policy gating events have been captured yet."
          onRowClick={(row) => setSelectedEvent(row)}
        />
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <Link
          href="/agent"
          className="p-4 rounded-lg bg-[#111827] border border-[#243044] hover:border-sky-500/50 hover:bg-[#1A2332] transition-all group flex items-start gap-3.5"
        >
          <div className="p-2.5 rounded-lg bg-sky-950/60 border border-sky-800/60 text-sky-400 group-hover:scale-105 transition-transform">
            <Bot className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-slate-200 group-hover:text-white uppercase tracking-wider">
              Guarded Agent Console
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Interact with Gemini reasoning agent protected by server-side policy and risk evaluation.
            </p>
          </div>
        </Link>

        <Link
          href="/evaluation"
          className="p-4 rounded-lg bg-[#111827] border border-[#243044] hover:border-purple-500/50 hover:bg-[#1A2332] transition-all group flex items-start gap-3.5"
        >
          <div className="p-2.5 rounded-lg bg-purple-950/60 border border-purple-800/60 text-purple-400 group-hover:scale-105 transition-transform">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-slate-200 group-hover:text-white uppercase tracking-wider">
              Security Evaluation Suite
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Run automated attack scenarios testing parameter tampering, replay, and prompt injection.
            </p>
          </div>
        </Link>

        <Link
          href="/policies"
          className="p-4 rounded-lg bg-[#111827] border border-[#243044] hover:border-amber-500/50 hover:bg-[#1A2332] transition-all group flex items-start gap-3.5"
        >
          <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-400 group-hover:scale-105 transition-transform">
            <Sliders className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-slate-200 group-hover:text-white uppercase tracking-wider">
              Policy & Risk Matrix
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Inspect deterministic rule hierarchy, risk scoring thresholds, and tool gating criteria.
            </p>
          </div>
        </Link>
      </div>

      {/* Inspect Event Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-[#0F172A] border border-[#243044] shadow-2xl overflow-hidden p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#243044]">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Event Details</span>
                <h3 className="text-sm font-bold text-white font-mono">{selectedEvent.event_type}</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded bg-[#111827] border border-[#243044]">
                <span className="text-slate-400">Target Tool:</span>
                <code className="text-sky-400 font-mono font-semibold">{selectedEvent.tool_name || "system"}</code>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-[#111827] border border-[#243044]">
                <span className="text-slate-400">Decision Outcome:</span>
                <DecisionBadge decision={selectedEvent.decision} />
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-[#111827] border border-[#243044]">
                <span className="text-slate-400">Timestamp:</span>
                <span className="font-mono text-slate-200">{formatDate(selectedEvent.created_at)}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-[#111827] border border-[#243044]">
                <span className="text-slate-400">Event ID:</span>
                <span className="font-mono text-slate-300">{selectedEvent.id}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => handleCopy(JSON.stringify(selectedEvent, null, 2))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy JSON"}</span>
              </button>
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-3.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
