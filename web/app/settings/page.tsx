"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Shield,
  Database,
  Cpu,
  Key,
  Palette,
  Check,
  Server,
  Lock,
  RefreshCw,
  Sliders,
  Terminal,
} from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import { api, CurrentUser, HealthStatus } from "@/lib/api";

type SettingsSection =
  | "account"
  | "database"
  | "mcp-server"
  | "security"
  | "appearance";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsSection>("account");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = () => {
    setRefreshing(true);
    Promise.all([
      api.auth.me().then(setUser).catch(() => null),
      api.healthReady().then(setHealth).catch(() => null),
    ]).finally(() => {
      setLoadingUser(false);
      setLoadingHealth(false);
      setRefreshing(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const SECTIONS: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
    { id: "account", label: "Operator Profile & RBAC", icon: User },
    { id: "database", label: "Supabase & DB Pool", icon: Database },
    { id: "mcp-server", label: "FastMCP Runtime", icon: Cpu },
    { id: "security", label: "Security Invariants", icon: Shield },
    { id: "appearance", label: "Observatory Display", icon: Palette },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-widest">
              SYSTEM CONFIGURATION // OPERATIONAL GOVERNANCE
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[10px] text-emerald-400 font-bold">
              OBSIDIAN OBSERVATORY
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
            SYSTEM PARAMETERS &amp; ENVIRONMENT
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Operational settings, remote Supabase PostgreSQL pool parameters, FastMCP runtime rules, and dual-custody invariants.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={refreshing}
          className="self-start sm:self-auto px-3 py-1.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span>Refresh State</span>
        </button>
      </div>

      {/* Main Settings Layout: Sidebar Tabs + Content Panel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Left Sub-nav */}
        <div className="md:col-span-3 space-y-1">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-xs font-mono transition-all text-left cursor-pointer ${
                  isActive
                    ? "bg-zinc-800/90 text-cyan-400 font-bold border-l-2 border-cyan-400 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-zinc-500"}`} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Content Panel */}
        <div className="md:col-span-9 rounded-lg border border-[var(--border)] bg-zinc-900/60 p-5 sm:p-6 space-y-6">
          {/* 1. ACCOUNT & RBAC */}
          {activeSection === "account" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <h2 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-cyan-400" />
                  AUTHENTICATED OPERATOR PROFILE
                </h2>
                <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {user?.is_active ? "SESSION ACTIVE" : "UNAUTHENTICATED"}
                </span>
              </div>

              {loadingUser ? (
                <div className="py-6 text-center text-zinc-500 font-mono text-xs">Loading operator profile...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-3 bg-zinc-950/50 rounded border border-zinc-800/80 space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Display Identity</span>
                    <div className="text-zinc-200 font-bold">{user?.display_name || user?.name || "Security Officer"}</div>
                  </div>
                  <div className="p-3 bg-zinc-950/50 rounded border border-zinc-800/80 space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Operator Principal</span>
                    <div className="text-zinc-300 truncate">{user?.email || "admin@mcp-sentinel.local"}</div>
                  </div>
                  <div className="p-3 bg-zinc-950/50 rounded border border-zinc-800/80 space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Assigned RBAC Role</span>
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                      {user?.role || "ADMIN"}
                    </span>
                  </div>
                  <div className="p-3 bg-zinc-950/50 rounded border border-zinc-800/80 space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Dual-Custody Authority</span>
                    <div className="text-emerald-400 font-semibold">FULL APPROVAL ESCROW PERMITTED</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. DATABASE & POOL */}
          {activeSection === "database" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <h2 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  SUPABASE POSTGRESQL ENGINE &amp; POOL
                </h2>
                <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                  health?.dependencies?.database === "connected"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}>
                  {loadingHealth ? "CHECKING..." : health?.dependencies?.database === "connected" ? "CONNECTED" : "STANDBY"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3 bg-zinc-950/50 rounded border border-zinc-800/80 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Target Cluster</span>
                  <div className="text-zinc-200 font-bold">aws-0-ap-northeast-2.pooler.supabase.com</div>
                </div>
                <div className="p-3 bg-zinc-950/50 rounded border border-zinc-800/80 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Transport Security</span>
                  <div className="text-emerald-400 font-bold">TLS Enforced (sslmode=require)</div>
                </div>
                <div className="p-3 bg-zinc-950/50 rounded border border-zinc-800/80 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Active Pool Bounds</span>
                  <div className="text-zinc-300">
                    {health?.pool ? `${health.pool.used} in-use / ${health.pool.total} active (Max: 10)` : "Min: 2 / Max: 10 conns"}
                  </div>
                </div>
                <div className="p-3 bg-zinc-950/50 rounded border border-zinc-800/80 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Database Schema Migrations</span>
                  <div className="text-cyan-400 font-bold">001–012 Applied (16 Tables)</div>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-950/60 rounded border border-zinc-800/80 space-y-2">
                <span className="text-[11px] font-mono text-zinc-400 font-bold block">
                  LEAST-PRIVILEGE RUNTIME DATABASE ROLES
                </span>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-cyan-400 font-bold block">mcp_readonly</span>
                    <span className="text-zinc-500 text-[10px]">SELECT only on public tables</span>
                  </div>
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-amber-400 font-bold block">mcp_writer</span>
                    <span className="text-zinc-500 text-[10px]">INSERT / UPDATE on business rows</span>
                  </div>
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-rose-400 font-bold block">mcp_destructive</span>
                    <span className="text-zinc-500 text-[10px]">DELETE / TRUNCATE requires approval</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. MCP SERVER RUNTIME */}
          {activeSection === "mcp-server" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <h2 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  FASTMCP PROTOCOL RUNTIME &amp; DAEMON
                </h2>
                <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  DAEMON ONLINE
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3 bg-zinc-950/50 rounded border border-zinc-800/80 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Server Name</span>
                  <div className="text-zinc-200 font-bold">mcp-sentinel</div>
                </div>
                <div className="p-3 bg-zinc-950/50 rounded border border-zinc-800/80 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Protocol Specification</span>
                  <div className="text-cyan-400 font-bold">MCP 2024-11-05 (FastMCP v4)</div>
                </div>
                <div className="p-3 bg-zinc-950/50 rounded border border-zinc-800/80 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Interception Pipeline</span>
                  <div className="text-zinc-300">9-Stage Policy &amp; Approval Gateway</div>
                </div>
                <div className="p-3 bg-zinc-950/50 rounded border border-zinc-800/80 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Cryptographic Binding</span>
                  <div className="text-emerald-400 font-bold">HMAC-SHA256 Parameter Hash</div>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-950/60 rounded border border-zinc-800/80 space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-zinc-300 font-mono font-bold">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>STDIO INVOCATION PATTERN</span>
                </div>
                <pre className="p-2.5 bg-zinc-900 rounded font-mono text-[11px] text-zinc-400 overflow-x-auto border border-zinc-800">
                  python -m mcp_sentinel.server.app
                </pre>
                <p className="text-[11px] text-zinc-500">
                  Clients (Claude Desktop, Cursor, AI agents) communicate via JSON-RPC over stdio. Every tool call is intercepted by the authoritative Sentinel policy engine before dispatch.
                </p>
              </div>
            </div>
          )}

          {/* 4. SECURITY INVARIANTS */}
          {activeSection === "security" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <h2 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  SECURITY INVARIANT BOUNDARIES &amp; GUARDRAILS
                </h2>
                <span className="text-[11px] font-mono text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  FAIL-CLOSED ENFORCED
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3.5 bg-zinc-950/50 rounded border border-zinc-800/80 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-zinc-200 block">Deterministic Policy Precedence</span>
                    <span className="text-[11px] text-zinc-400">Locked evaluation order</span>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-zinc-900 text-cyan-400 border border-zinc-700 font-bold text-[11px]">
                    DENY &gt; REQUIRE_MFA &gt; REQUIRE_APPROVAL &gt; ALLOW
                  </span>
                </div>

                <div className="p-3.5 bg-zinc-950/50 rounded border border-zinc-800/80 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-zinc-200 block">Single-Use Execution Tokens</span>
                    <span className="text-[11px] text-zinc-400">Replay &amp; race condition prevention via atomic consumption</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold text-[10px]">
                    ATOMIC ONCE-ONLY
                  </span>
                </div>

                <div className="p-3.5 bg-zinc-950/50 rounded border border-zinc-800/80 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-zinc-200 block">Approval Token TTL</span>
                    <span className="text-[11px] text-zinc-400">Escrow sign-off expires if not executed within threshold</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-700 font-bold text-[11px]">
                    900 SECONDS (15 MIN)
                  </span>
                </div>

                <div className="p-3.5 bg-zinc-950/50 rounded border border-zinc-800/80 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-zinc-200 block">Secret Redaction Engine</span>
                    <span className="text-[11px] text-zinc-400">Tokens, database URLs, and passwords masked in audit ledger</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold text-[10px]">
                    ACTIVE (***REDACTED***)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 5. APPEARANCE */}
          {activeSection === "appearance" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <h2 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Palette className="w-4 h-4 text-cyan-400" />
                  OBSERVATORY DESIGN SYSTEM &amp; TOKENS
                </h2>
                <span className="text-[11px] font-mono text-cyan-400 font-bold">
                  HIGH LEGIBILITY
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-cyan-500/40 bg-zinc-950/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-cyan-400">Dark Observatory (Default)</span>
                    <Check className="w-4 h-4 text-cyan-400" />
                  </div>
                  <p className="text-xs text-zinc-400">
                    High-contrast obsidian background (#090B0E), 1px hairline zinc borders (#222834), and crisp typography optimized for security operations.
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#090B0E] border border-zinc-700" title="Obsidian Canvas" />
                    <span className="w-3.5 h-3.5 rounded-full bg-[#38BDF8]" title="Telemetry Cyan" />
                    <span className="w-3.5 h-3.5 rounded-full bg-[#10B981]" title="Enforced Emerald" />
                    <span className="w-3.5 h-3.5 rounded-full bg-[#FBBF24]" title="Approval Amber" />
                    <span className="w-3.5 h-3.5 rounded-full bg-[#F87171]" title="Quarantine Ruby" />
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-zinc-300">Light / Architectural</span>
                    <button
                      onClick={toggleTheme}
                      className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-zinc-300 cursor-pointer border border-zinc-700 transition-colors"
                    >
                      Toggle Mode
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Graphite and warm mineral light surfaces for high ambient lighting environments.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
