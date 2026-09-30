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
  Lock,
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
import { SecurityCore3D } from "@/components/visualization/SecurityCore3D";
import { BorderBeam } from "@/components/ui/BorderBeam";

interface DecisionEvent {
  id: string;
  event_type: string;
  tool_name: string;
  decision: string;
  created_at: string;
}

const DECISION_COLORS: Record<string, string> = {
  ALLOW: "#3A8A7F",
  ALLOWED: "#3A8A7F",
  PASS: "#3A8A7F",
  BLOCK: "#D64541",
  BLOCKED: "#D64541",
  DENY: "#D64541",
  REQUIRE_APPROVAL: "#D05A40",
  PENDING: "#E3A03E",
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

    if (Object.keys(counts).length === 0 && stats?.metrics) {
      if (stats.metrics.completed_approvals > 0) counts["ALLOW"] = stats.metrics.completed_approvals;
      if (stats.metrics.blocked_actions > 0) counts["BLOCK"] = stats.metrics.blocked_actions;
      if (stats.metrics.pending_approvals > 0) counts["REQUIRE_APPROVAL"] = stats.metrics.pending_approvals;
    }

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: DECISION_COLORS[name] || "#D05A40",
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
      header: "Target Tool",
      render: (row) => (
        <code className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#D05A40]/10 text-[#D05A40] border border-[#D05A40]/30 font-semibold">
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
          className="p-1 rounded text-slate-400 hover:text-[#1A202E] dark:hover:text-slate-200 hover:bg-[#EFECE5] dark:hover:bg-slate-800 transition-colors"
          title="Inspect Event"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner & Editorial Asymmetric Layout (deep-research-report.md Section 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Editorial Typography & Key Operational Metrics (5 Columns) */}
        <div className="lg:col-span-5 space-y-6">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#D05A40] font-bold mb-2">
              <span>CONTROL TOWER</span>
              <span>/</span>
              <span>SECURITY GATEKEEPER</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-[#1A202E] dark:text-[#F4F6F9] leading-tight">
              Security Posture: Operational
            </h1>

            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-teal-50 text-[#2C6E65] border border-teal-300 dark:bg-[#3A8A7F]/20 dark:text-[#4EA699] dark:border-[#3A8A7F]/40 font-semibold">
                <span className="pulse-dot bg-[#3A8A7F]" />
                LIVE TELEMETRY ACTIVE
              </span>
              <span className="text-[11px] font-mono text-[#6B7280] dark:text-slate-400">
                FastMCP v1.0
              </span>
            </div>

            <p className="text-xs text-[#475063] dark:text-[#94A3B8] mt-3 leading-relaxed">
              Deterministic policy enforcement, cryptographic tool gating, and LangGraph agent governance. All in-flight invocations are verified via SHA-256 parameter seals.
            </p>

            <div className="flex items-center gap-3 pt-4">
              <Link
                href="/approvals"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D05A40] hover:bg-[#B84E37] text-white text-xs font-semibold shadow-md shadow-[#D05A40]/25 transition-all hover:translate-y-[-1px]"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Investigate Issues</span>
              </Link>
              <button
                onClick={fetchStats}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] text-xs font-medium text-[#1A202E] dark:text-slate-300 hover:border-[#D05A40] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Sync</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg text-xs flex items-center justify-between border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200">
              <span>{error}</span>
              <button onClick={fetchStats} className="font-semibold underline hover:text-red-900">
                Retry
              </button>
            </div>
          )}

          {/* Key Metric Cards in Clean 2x3 Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 pt-2">
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
              subtext="Policy Enforced"
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
              title="Indexed Records"
              value={loading ? "—" : stats?.metrics.customers ?? 0}
              icon={Users}
              subtext="Protected Entities"
            />
            <MetricCard
              title="Managed Orders"
              value={loading ? "—" : stats?.metrics.orders ?? 0}
              icon={ShoppingBag}
              subtext="Secured Items"
            />
          </div>
        </div>

        {/* Right Side: 3D "Security Machine" Hero Centerpiece (7 Columns) */}
        <div className="lg:col-span-7">
          <SecurityCore3D
            systemHealthy={!error}
            pendingCount={stats?.metrics?.pending_approvals ?? 0}
            blockedCount={stats?.metrics?.blocked_actions ?? 0}
            toolCount={6}
          />
        </div>
      </div>

      {/* Visual Analytics & Operational Guarantees */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security Decision Distribution */}
        <div className="p-5 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-[#D1CEC7] dark:border-[#26344A]">
            <div>
              <span className="text-[10px] font-mono uppercase text-[#D05A40] font-bold block">Telemetry</span>
              <h3 className="text-xs font-bold text-[#1A202E] dark:text-[#F4F6F9] uppercase tracking-wider font-sans">
                Security Decision Ratio
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">DISTRIBUTION</span>
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
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#17202E",
                      borderColor: "#26344A",
                      borderRadius: "6px",
                      fontSize: "11px",
                      color: "#F4F6F9",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500 font-mono">No decision samples recorded</div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#D1CEC7] dark:border-[#26344A] text-[11px]">
            {decisionChartData.map((item) => (
              <div key={item.name} className="flex flex-col items-center">
                <span className="text-[10px] font-mono text-[#6B7280] dark:text-slate-400 truncate">{item.name}</span>
                <span className="font-mono-tnum font-bold text-[#1A202E] dark:text-[#F4F6F9]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity by Tool Invocation */}
        <div className="p-5 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-[#D1CEC7] dark:border-[#26344A]">
            <div>
              <span className="text-[10px] font-mono uppercase text-[#3A8A7F] font-bold block">Activity</span>
              <h3 className="text-xs font-bold text-[#1A202E] dark:text-[#F4F6F9] uppercase tracking-wider font-sans">
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
                    tick={{ fill: "#64748B", fontSize: 10 }}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#17202E",
                      borderColor: "#26344A",
                      borderRadius: "6px",
                      fontSize: "11px",
                      color: "#F4F6F9",
                    }}
                  />
                  <Bar dataKey="count" fill="#D05A40" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500 font-mono">No recent tool activity</div>
            )}
          </div>

          <div className="pt-3 border-t border-[#D1CEC7] dark:border-[#26344A] flex items-center justify-between text-[11px] text-[#6B7280] dark:text-slate-400 font-mono">
            <span>FastMCP Pre-hook Enforcement</span>
            <span className="text-[#3A8A7F] font-bold">ACTIVE</span>
          </div>
        </div>

        {/* Security Perimeter Guarantees */}
        <div className="relative overflow-hidden p-5 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] flex flex-col justify-between shadow-sm">
          <BorderBeam size={220} duration={12} colorFrom="#D05A40" colorTo="#3A8A7F" />
          <div className="flex items-center justify-between pb-3 border-b border-[#D1CEC7] dark:border-[#26344A]">
            <div>
              <span className="text-[10px] font-mono uppercase text-[#D05A40] font-bold block">Invariants</span>
              <h3 className="text-xs font-bold text-[#1A202E] dark:text-[#F4F6F9] uppercase tracking-wider font-sans">
                Security Core Guarantees
              </h3>
            </div>
            <ShieldCheck className="w-4 h-4 text-[#3A8A7F]" />
          </div>

          <div className="space-y-2.5 py-3 text-xs">
            <div className="flex items-center justify-between p-2 rounded bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
              <span className="text-[#475063] dark:text-slate-300">Model Oversight</span>
              <span className="font-mono text-[#3A8A7F] font-semibold text-[11px]">Server Gated</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
              <span className="text-[#475063] dark:text-slate-300">Parameter Tamper Defense</span>
              <span className="font-mono text-[#D05A40] font-semibold text-[11px]">SHA-256 Gated</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
              <span className="text-[#475063] dark:text-slate-300">Untrusted Data Tagging</span>
              <span className="font-mono text-[#3A8A7F] font-semibold text-[11px]">Active</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
              <span className="text-[#475063] dark:text-slate-300">Replay Protection</span>
              <span className="font-mono text-[#E3A03E] font-semibold text-[11px]">One-Time Consume</span>
            </div>
          </div>

          <div className="pt-3 border-t border-[#D1CEC7] dark:border-[#26344A] flex items-center justify-between text-[11px] text-[#6B7280] dark:text-slate-400">
            <span className="font-mono">Security Gate Status</span>
            <span className="font-mono text-[#3A8A7F] font-bold">100% ENFORCED</span>
          </div>
        </div>
      </div>

      {/* Recent Security Decisions Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#1A202E] dark:text-[#F4F6F9] uppercase tracking-wider font-sans">
              Recent Security Decisions
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#EFECE5] dark:bg-slate-800 text-[#475063] dark:text-slate-400 border border-[#D1CEC7] dark:border-slate-700">
              {stats?.recent_security_events?.length ?? 0} Events
            </span>
          </div>
          <Link
            href="/audit"
            className="text-xs font-semibold text-[#D05A40] hover:text-[#B84E37] inline-flex items-center gap-1 transition-colors"
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
          className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] hover:border-[#D05A40] dark:hover:border-[#D05A40] transition-all group flex items-start gap-3.5 shadow-sm"
        >
          <div className="p-2.5 rounded-lg bg-[#D05A40]/10 border border-[#D05A40]/30 text-[#D05A40] group-hover:scale-105 transition-transform">
            <Bot className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-[#1A202E] dark:text-[#F4F6F9] uppercase tracking-wider font-sans">
              Guarded Agent Console
            </h4>
            <p className="text-[11px] text-[#475063] dark:text-[#94A3B8] mt-1 leading-relaxed">
              Interact with Gemini reasoning agent protected by server-side policy and risk evaluation.
            </p>
          </div>
        </Link>

        <Link
          href="/evaluation"
          className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] hover:border-[#3A8A7F] dark:hover:border-[#3A8A7F] transition-all group flex items-start gap-3.5 shadow-sm"
        >
          <div className="p-2.5 rounded-lg bg-[#3A8A7F]/10 border border-[#3A8A7F]/30 text-[#3A8A7F] group-hover:scale-105 transition-transform">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-[#1A202E] dark:text-[#F4F6F9] uppercase tracking-wider font-sans">
              Security Evaluation Suite
            </h4>
            <p className="text-[11px] text-[#475063] dark:text-[#94A3B8] mt-1 leading-relaxed">
              Run automated attack scenarios testing parameter tampering, replay, and prompt injection.
            </p>
          </div>
        </Link>

        <Link
          href="/policies"
          className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] hover:border-[#E3A03E] dark:hover:border-[#E3A03E] transition-all group flex items-start gap-3.5 shadow-sm"
        >
          <div className="p-2.5 rounded-lg bg-[#E3A03E]/10 border border-[#E3A03E]/30 text-[#E3A03E] group-hover:scale-105 transition-transform">
            <Sliders className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-[#1A202E] dark:text-[#F4F6F9] uppercase tracking-wider font-sans">
              Policy & Risk Matrix
            </h4>
            <p className="text-[11px] text-[#475063] dark:text-[#94A3B8] mt-1 leading-relaxed">
              Inspect deterministic rule hierarchy, risk scoring thresholds, and tool gating criteria.
            </p>
          </div>
        </Link>
      </div>

      {/* Inspect Event Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] shadow-2xl overflow-hidden p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D1CEC7] dark:border-[#26344A]">
              <div>
                <span className="text-[10px] font-mono text-[#D05A40] uppercase font-bold block">Event Details</span>
                <h3 className="text-sm font-bold text-[#1A202E] dark:text-[#F4F6F9] font-mono">{selectedEvent.event_type}</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded text-slate-400 hover:text-[#1A202E] dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[#6B7280] dark:text-slate-400">Target Tool:</span>
                <code className="text-[#D05A40] font-mono font-semibold">{selectedEvent.tool_name || "system"}</code>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[#6B7280] dark:text-slate-400">Decision Outcome:</span>
                <DecisionBadge decision={selectedEvent.decision} />
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[#6B7280] dark:text-slate-400">Timestamp:</span>
                <span className="font-mono text-[#1A202E] dark:text-slate-200">{formatDate(selectedEvent.created_at)}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[#6B7280] dark:text-slate-400">Event ID:</span>
                <span className="font-mono text-[#1A202E] dark:text-slate-300">{selectedEvent.id}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => handleCopy(JSON.stringify(selectedEvent, null, 2))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#EFECE5] dark:bg-slate-800 hover:bg-[#E2DFD8] text-xs text-[#1A202E] dark:text-slate-200 border border-[#D1CEC7] dark:border-slate-700 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#3A8A7F]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy JSON"}</span>
              </button>
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-3.5 py-1.5 rounded bg-[#D05A40] hover:bg-[#B84E37] text-xs font-semibold text-white transition-colors"
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
