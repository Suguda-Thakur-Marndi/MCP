"use client";

import { useEffect, useState, useTransition } from "react";
import { api, HealthStatus } from "@/lib/api";

export default function SettingsPage() {
  const [, startTransition] = useTransition();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<string>("ADMIN");
  const [activeEmail, setActiveEmail] = useState<string>("admin@sentinel.test");
  const [roleSaved, setRoleSaved] = useState(false);

  useEffect(() => {
    api.health()
      .then((h) => {
        startTransition(() => {
          setHealth(h);
          setLoading(false);
        });
      })
      .catch(() => {
        startTransition(() => {
          setHealth({ status: "disconnected" });
          setLoading(false);
        });
      });

    if (typeof window !== "undefined") {
      const savedRole = localStorage.getItem("sentinel_role") || "ADMIN";
      const savedEmail = localStorage.getItem("sentinel_email") || "admin@sentinel.test";
      startTransition(() => {
        setActiveRole(savedRole);
        setActiveEmail(savedEmail);
      });
    }
  }, []);

  const handleRoleChange = (role: string, email: string) => {
    setActiveRole(role);
    setActiveEmail(email);
    if (typeof window !== "undefined") {
      localStorage.setItem("sentinel_role", role);
      localStorage.setItem("sentinel_email", email);
      setRoleSaved(true);
      setTimeout(() => setRoleSaved(false), 2000);
    }
  };

  const ROLES = [
    { role: "ADMIN", email: "admin@sentinel.test", desc: "Full permissions: all tools, approvals, evaluations, and configuration" },
    { role: "APPROVER", email: "approver@sentinel.test", desc: "Authorized to approve or deny human gating tickets" },
    { role: "SECURITY_ANALYST", email: "analyst@sentinel.test", desc: "Read-only audit inspection and security evaluation execution" },
    { role: "OPERATOR", email: "operator@sentinel.test", desc: "Standard AI agent usage and read/write customer operations" },
    { role: "VIEWER", email: "viewer@sentinel.test", desc: "Read-only dashboard and tool registry access" },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">Platform Configuration & Security</h1>
          <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-sky-950 text-sky-400 border border-sky-800">
            ENTERPRISE SETTINGS
          </span>
        </div>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Backend service telemetry, cryptographic parameter keys, and RBAC identity switcher for local security testing.
        </p>
      </div>

      {/* Grid of Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backend & Database Telemetry */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${health?.status === "ok" || health?.status === "healthy" ? "bg-green-500" : "bg-red-500"}`} />
              System Status
            </h2>
            <span className="text-xs font-mono text-slate-400">
              {loading ? "Checking..." : health?.status?.toUpperCase()}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
              <span style={{ color: "var(--text-secondary)" }}>FastAPI Gateway</span>
              <span className="font-mono text-white font-semibold">http://localhost:8000</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
              <span style={{ color: "var(--text-secondary)" }}>PostgreSQL 16 Connection</span>
              <span className="font-mono text-green-400 font-semibold">Pooled (asyncpg)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
              <span style={{ color: "var(--text-secondary)" }}>MCP Protocol</span>
              <span className="font-mono text-sky-400 font-semibold">FastMCP (In-Process)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
              <span style={{ color: "var(--text-secondary)" }}>LLM Engine</span>
              <span className="font-mono text-purple-400 font-semibold">Google Gemini 2.5 / Mock Fallback</span>
            </div>
          </div>
        </div>

        {/* Cryptographic Controls */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
              Cryptographic Policies
            </h2>
            <span className="text-xs font-mono text-sky-400">FIPS / Enterprise Ready</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Parameter Binding Algorithm</span>
              <span className="font-mono text-white font-semibold">SHA-256 (Canonical JSON)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Token Signing Key</span>
              <span className="font-mono text-slate-400">•••••••••••••••• (Redacted)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Token Lifetime</span>
              <span className="font-mono text-white font-semibold">60 Minutes</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Replay Mitigation</span>
              <span className="font-mono text-green-400 font-semibold">One-Time-Use State Gating</span>
            </div>
          </div>
        </div>
      </div>

      {/* RBAC Session Switcher (for testing role-based access control) */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
              Local RBAC Identity Switcher
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate requests under different roles to verify server-side permission enforcement and privilege boundaries. Active identity: <code className="text-sky-300">{activeEmail}</code>
            </p>
          </div>
          {roleSaved && (
            <span className="text-xs text-green-400 font-mono animate-fade-in">
              ✓ Active Identity Updated
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ROLES.map((r) => {
            const isCurrent = activeRole === r.role;
            return (
              <div
                key={r.role}
                onClick={() => handleRoleChange(r.role, r.email)}
                className={`p-4 rounded-xl cursor-pointer transition-all border ${
                  isCurrent
                    ? "border-sky-500 bg-sky-950/30 shadow-md"
                    : "border-slate-800 hover:border-slate-700 bg-slate-900/50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-white">
                    {r.role}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500 text-white font-mono font-bold">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-sky-400 mb-2 truncate">
                  {r.email}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {r.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
