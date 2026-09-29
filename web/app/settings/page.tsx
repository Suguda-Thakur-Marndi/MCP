"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  Settings,
  ShieldCheck,
  UserCheck,
  Lock,
  Server,
  Key,
  Globe,
  Database,
  RefreshCw,
  Check,
  AlertCircle,
} from "lucide-react";
import { api, HealthStatus } from "@/lib/api";
import { RoleBadge } from "@/components/ui/Badges";

const ROLES = [
  {
    role: "ADMIN",
    email: "admin@sentinel.test",
    desc: "Complete administrative control: all MCP tools, approvals, evaluations, and platform settings.",
  },
  {
    role: "APPROVER",
    email: "approver@sentinel.test",
    desc: "Authorized to sign off on or reject gated high-risk human-in-the-loop tickets.",
  },
  {
    role: "SECURITY_ANALYST",
    email: "analyst@sentinel.test",
    desc: "Read-only audit inspection and security evaluation suite execution privileges.",
  },
  {
    role: "OPERATOR",
    email: "operator@sentinel.test",
    desc: "Interactive AI agent usage and read/write customer operations within standard limits.",
  },
  {
    role: "VIEWER",
    email: "viewer@sentinel.test",
    desc: "Read-only dashboard metrics and tool registry view. Cannot authorize actions.",
  },
];

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

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#243044]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
            <span>Administration</span>
            <span>/</span>
            <span className="text-sky-400">Environment Configuration</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
              Platform Configuration & RBAC
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-sky-950/50 text-sky-400 border border-sky-800/60">
              ENTERPRISE SETTINGS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Backend service connectivity telemetry, Google OAuth 2.0 configuration, and RBAC identity switcher for testing approval gating workflows.
          </p>
        </div>

        {roleSaved && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs font-mono">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Active Role Saved</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System & Telemetry Card */}
        <div className="p-5 rounded-lg bg-[#111827] border border-[#243044] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#243044]">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                System Diagnostics
              </h3>
            </div>
            <span className="flex items-center gap-1.5 text-[11px] font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  health?.status === "ok" || health?.status === "healthy"
                    ? "bg-emerald-400"
                    : "bg-rose-500"
                }`}
              />
              <span className="text-slate-300 uppercase">{loading ? "Probing..." : health?.status || "ONLINE"}</span>
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded bg-[#0F172A] border border-[#243044]">
              <span className="text-slate-400">FastAPI API Gateway:</span>
              <span className="font-mono text-sky-400 font-semibold">http://localhost:8000</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-[#0F172A] border border-[#243044]">
              <span className="text-slate-400">PostgreSQL Connection:</span>
              <span className="font-mono text-emerald-400 font-semibold">Pooled (asyncpg)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-[#0F172A] border border-[#243044]">
              <span className="text-slate-400">FastMCP Protocol Mode:</span>
              <span className="font-mono text-slate-200 font-semibold">In-Process Transport</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-[#0F172A] border border-[#243044]">
              <span className="text-slate-400">AI Reasoning Provider:</span>
              <span className="font-mono text-purple-400 font-semibold">Google Gemini 2.5 Flash</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-[#0F172A] border border-[#243044]">
              <span className="text-slate-400">Parameter Seal Hash:</span>
              <span className="font-mono text-slate-200 font-semibold">SHA-256 Gated</span>
            </div>
          </div>
        </div>

        {/* Security Parameters & Invariants */}
        <div className="p-5 rounded-lg bg-[#111827] border border-[#243044] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#243044]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Security Parameters
              </h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">ACTIVE</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded bg-[#0F172A] border border-[#243044]">
              <span className="text-slate-400">JWT Token Algorithm:</span>
              <span className="font-mono text-slate-200">HS256 (32+ char secret)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-[#0F172A] border border-[#243044]">
              <span className="text-slate-400">Session Cookie Policy:</span>
              <span className="font-mono text-slate-200">HTTPOnly, SameSite=Lax</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-[#0F172A] border border-[#243044]">
              <span className="text-slate-400">Approval Ticket TTL:</span>
              <span className="font-mono text-amber-400">3,600 seconds (1 hour)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-[#0F172A] border border-[#243044]">
              <span className="text-slate-400">CSRF Header Validation:</span>
              <span className="font-mono text-emerald-400 font-semibold">Enforced (X-Requested-With)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-[#0F172A] border border-[#243044]">
              <span className="text-slate-400">Replay Protection:</span>
              <span className="font-mono text-sky-400">One-Time Token Invalidation</span>
            </div>
          </div>
        </div>
      </div>

      {/* RBAC Testing Identity Switcher */}
      <div className="p-6 rounded-lg bg-[#111827] border border-[#243044] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#243044]">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                RBAC Local Identity Switcher
              </h3>
              <RoleBadge role={activeRole} />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate operational permissions to test human-in-the-loop approval gating and RBAC enforcement.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Current: {activeEmail}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ROLES.map((r) => {
            const isSelected = activeRole === r.role;
            return (
              <div
                key={r.role}
                onClick={() => handleRoleChange(r.role, r.email)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  isSelected
                    ? "bg-[#1A2332] border-sky-500/60 shadow-md shadow-sky-950/20"
                    : "bg-[#0F172A] border-[#243044] hover:border-slate-600 hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <RoleBadge role={r.role} />
                  {isSelected && (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-semibold">
                      <Check className="w-3 h-3" />
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{r.desc}</p>
                <span className="font-mono text-[10px] text-slate-500 block truncate">
                  {r.email}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
