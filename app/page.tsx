"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, DashboardStats } from "@/lib/api";
import { decisionBadgeClass, formatDate, relativeTime } from "@/lib/utils";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.dashboard.stats();
      setStats(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dashboard metrics";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Security Command Center</h1>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono" style={{ background: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              LIVE TELEMETRY
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Real-time policy enforcement, AI agent oversight, and cryptographic gating telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStats}
            className="btn-ghost text-xs flex items-center gap-1.5"
            disabled={loading}
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh
          </button>
          <Link href="/approvals" className="btn-primary text-xs flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Review Approvals
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg text-sm flex items-center justify-between" style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444" }}>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
          <button onClick={fetchStats} className="text-xs underline font-semibold hover:opacity-80">
            Retry
          </button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Pending Approvals */}
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-medium" style={{ color: "var(--text-secondary)" }}>PENDING APPROVALS</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>Gated</span>
          </div>
          <div className="metric-value" style={{ color: (stats?.metrics.pending_approvals ?? 0) > 0 ? "#f59e0b" : "var(--text-primary)" }}>
            {loading ? <div className="h-8 w-16 skeleton" /> : stats?.metrics.pending_approvals ?? 0}
          </div>
          <div className="text-[11px] mt-2 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <span>Requires human review</span>
          </div>
        </div>

        {/* Blocked Actions */}
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-medium" style={{ color: "var(--text-secondary)" }}>BLOCKED ACTIONS</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>Denied</span>
          </div>
          <div className="metric-value">
            {loading ? <div className="h-8 w-16 skeleton" /> : stats?.metrics.blocked_actions ?? 0}
          </div>
          <div className="text-[11px] mt-2 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <span>Zero unauthorized execution</span>
          </div>
        </div>

        {/* Completed Approvals */}
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-medium" style={{ color: "var(--text-secondary)" }}>AUTHORIZED RUNS</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e" }}>Passed</span>
          </div>
          <div className="metric-value">
            {loading ? <div className="h-8 w-16 skeleton" /> : stats?.metrics.completed_approvals ?? 0}
          </div>
          <div className="text-[11px] mt-2 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <span>Cryptographically verified</span>
          </div>
        </div>

        {/* Audit Events */}
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-medium" style={{ color: "var(--text-secondary)" }}>AUDIT EVENTS</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "rgba(56, 189, 248, 0.15)", color: "var(--accent)" }}>Logged</span>
          </div>
          <div className="metric-value">
            {loading ? <div className="h-8 w-16 skeleton" /> : stats?.metrics.audit_events ?? 0}
          </div>
          <div className="text-[11px] mt-2 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <span>PostgreSQL audit trail</span>
          </div>
        </div>

        {/* Customers Protected */}
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-medium" style={{ color: "var(--text-secondary)" }}>CUSTOMERS</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "rgba(148, 163, 184, 0.15)", color: "var(--text-secondary)" }}>DB</span>
          </div>
          <div className="metric-value">
            {loading ? <div className="h-8 w-16 skeleton" /> : stats?.metrics.customers ?? 0}
          </div>
          <div className="text-[11px] mt-2 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <span>Synthetic test records</span>
          </div>
        </div>

        {/* Orders Managed */}
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-medium" style={{ color: "var(--text-secondary)" }}>ORDERS</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "rgba(148, 163, 184, 0.15)", color: "var(--text-secondary)" }}>DB</span>
          </div>
          <div className="metric-value">
            {loading ? <div className="h-8 w-16 skeleton" /> : stats?.metrics.orders ?? 0}
          </div>
          <div className="text-[11px] mt-2 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <span>Indexed and secured</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Architecture Telemetry & Recent Security Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Security Events */}
        <div className="lg:col-span-2 glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <h2 className="text-base font-semibold text-white">Recent Security Decisions</h2>
            </div>
            <Link href="/audit" className="text-xs font-medium text-sky-400 hover:underline">
              View all audit logs →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event Type</th>
                  <th>Tool</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                      Loading recent events...
                    </td>
                  </tr>
                )}
                {!loading && (!stats?.recent_security_events || stats.recent_security_events.length === 0) && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      No recent security events recorded yet.
                    </td>
                  </tr>
                )}
                {stats?.recent_security_events?.map((evt) => (
                  <tr key={evt.id}>
                    <td className="whitespace-nowrap font-mono text-xs">
                      {relativeTime(evt.created_at)}
                    </td>
                    <td className="font-mono text-xs font-medium text-white">
                      {evt.event_type}
                    </td>
                    <td>
                      <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(56, 189, 248, 0.08)", color: "var(--accent)" }}>
                        {evt.tool_name || "system"}
                      </code>
                    </td>
                    <td>
                      <span className={decisionBadgeClass(evt.decision)}>
                        {evt.decision}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: System Topology & Security Guarantees */}
        <div className="space-y-6">
          {/* Security Perimeter Status */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Security Perimeter
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                <span style={{ color: "var(--text-secondary)" }}>Model Oversight</span>
                <span className="font-mono text-emerald-400 font-semibold">FastMCP Server Gate</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                <span style={{ color: "var(--text-secondary)" }}>Parameter Binding</span>
                <span className="font-mono text-sky-400 font-semibold">SHA-256 Gated</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                <span style={{ color: "var(--text-secondary)" }}>Untrusted Data Guard</span>
                <span className="font-mono text-emerald-400 font-semibold">Active Tagging</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                <span style={{ color: "var(--text-secondary)" }}>Database Isolation</span>
                <span className="font-mono text-sky-400 font-semibold">Parameterized SQL</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                <span style={{ color: "var(--text-secondary)" }}>Replay Attack Defense</span>
                <span className="font-mono text-emerald-400 font-semibold">One-Time Consume</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-card p-6 space-y-3">
            <h2 className="text-base font-semibold text-white">Platform Actions</h2>
            <div className="grid grid-cols-1 gap-2">
              <Link
                href="/agent"
                className="p-3 rounded-lg flex items-center justify-between text-xs font-medium transition-colors hover:bg-slate-800"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 text-white">
                  <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 8V4H8" />
                    <rect x="4" y="8" width="16" height="12" rx="2" />
                  </svg>
                  <span>Chat with Guarded Agent</span>
                </div>
                <span style={{ color: "var(--text-muted)" }}>→</span>
              </Link>
              <Link
                href="/evaluation"
                className="p-3 rounded-lg flex items-center justify-between text-xs font-medium transition-colors hover:bg-slate-800"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 text-white">
                  <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 11 3 3L22 4" />
                  </svg>
                  <span>Run 25 Security Scenarios</span>
                </div>
                <span style={{ color: "var(--text-muted)" }}>→</span>
              </Link>
              <Link
                href="/tools"
                className="p-3 rounded-lg flex items-center justify-between text-xs font-medium transition-colors hover:bg-slate-800"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 text-white">
                  <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6" />
                  </svg>
                  <span>Inspect MCP Tool Registry</span>
                </div>
                <span style={{ color: "var(--text-muted)" }}>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
