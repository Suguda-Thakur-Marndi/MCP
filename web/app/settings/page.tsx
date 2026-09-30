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
  Cpu,
  Copy,
  Terminal,
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
  const [pinging, setPinging] = useState(false);
  const [activeRole, setActiveRole] = useState<string>("ADMIN");
  const [activeEmail, setActiveEmail] = useState<string>("admin@sentinel.test");
  const [roleSaved, setRoleSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchHealth = () => {
    setPinging(true);
    api.health()
      .then((h) => {
        startTransition(() => {
          setHealth(h);
          setLoading(false);
          setPinging(false);
        });
      })
      .catch(() => {
        startTransition(() => {
          setHealth({ status: "disconnected" });
          setLoading(false);
          setPinging(false);
        });
      });
  };

  useEffect(() => {
    fetchHealth();

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

  const copyDiagnostics = () => {
    const diag = {
      gateway: "http://localhost:8000",
      status: health?.status || "unknown",
      protocol: "FastMCP 4.0 In-Process",
      database: "PostgreSQL 16 (asyncpg pool)",
      model: "Google Gemini 2.5 Flash",
      activeRole,
      activeEmail,
      timestamp: new Date().toISOString(),
    };
    navigator.clipboard.writeText(JSON.stringify(diag, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] mb-1">
            <span>Administration</span>
            <span>/</span>
            <span className="text-[var(--primary)]">Configuration</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--foreground)] font-sans">
              Platform Configuration & Invariants
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--surface-elevated)] text-[var(--foreground)] border border-[var(--border)]">
              ACTIVE NODE
            </span>
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-2xl leading-relaxed">
            Service connectivity telemetry, cryptographic protocol parameters, and role-based test harness for human-in-the-loop dual custody.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {roleSaved && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono">
              <Check className="w-3.5 h-3.5" />
              <span>Identity Updated</span>
            </div>
          )}
          <button
            onClick={copyDiagnostics}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--surface-elevated)] text-[var(--foreground)] transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />}
            <span>{copied ? "Copied" : "Copy Diagnostics"}</span>
          </button>
          <button
            onClick={fetchHealth}
            disabled={pinging}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium border border-[var(--border)] bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${pinging ? "animate-spin" : ""}`} />
            <span>Ping Gateway</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System & Telemetry Card */}
        <div className="rounded border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-elevated)]">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[var(--primary)]" />
              <h2 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
                System Diagnostics & Services
              </h2>
            </div>
            <span className="flex items-center gap-1.5 text-[11px] font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  health?.status === "ok" || health?.status === "healthy"
                    ? "bg-emerald-500"
                    : "bg-rose-500"
                }`}
              />
              <span className="font-semibold uppercase text-[var(--foreground)]">
                {loading ? "Probing..." : health?.status || "ONLINE"}
              </span>
            </span>
          </div>

          <div className="p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded bg-[var(--surface-elevated)]/60 border border-[var(--border)]">
              <span className="text-[var(--muted-foreground)]">FastAPI Core Gateway:</span>
              <span className="font-mono text-[var(--primary)] font-semibold">http://127.0.0.1:8000</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-[var(--surface-elevated)]/60 border border-[var(--border)]">
              <span className="text-[var(--muted-foreground)]">PostgreSQL Storage Engine:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">Pooled (asyncpg, port 5000)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-[var(--surface-elevated)]/60 border border-[var(--border)]">
              <span className="text-[var(--muted-foreground)]">FastMCP Protocol Mode:</span>
              <span className="font-mono text-[var(--foreground)] font-semibold">In-Process FastMCP 4.0</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-[var(--surface-elevated)]/60 border border-[var(--border)]">
              <span className="text-[var(--muted-foreground)]">AI Reasoning Core:</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">Google Gemini 2.5 Flash</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-[var(--surface-elevated)]/60 border border-[var(--border)]">
              <span className="text-[var(--muted-foreground)]">Cryptographic Integrity Seal:</span>
              <span className="font-mono text-[var(--foreground)] font-semibold">SHA-256 Parameter Hash</span>
            </div>
          </div>
        </div>

        {/* Security Parameters & Invariants */}
        <div className="rounded border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-elevated)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
                Cryptographic Invariants
              </h2>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
              ENFORCED
            </span>
          </div>

          <div className="p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded bg-[var(--surface-elevated)]/60 border border-[var(--border)]">
              <span className="text-[var(--muted-foreground)]">JWT Token Signature:</span>
              <span className="font-mono text-[var(--foreground)]">HS256 (32+ Byte Key)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-[var(--surface-elevated)]/60 border border-[var(--border)]">
              <span className="text-[var(--muted-foreground)]">Session Cookie Guard:</span>
              <span className="font-mono text-[var(--foreground)]">HttpOnly, SameSite=Lax</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-[var(--surface-elevated)]/60 border border-[var(--border)]">
              <span className="text-[var(--muted-foreground)]">Approval Ticket Lifetime (TTL):</span>
              <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">3,600s (1 Hour Window)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-[var(--surface-elevated)]/60 border border-[var(--border)]">
              <span className="text-[var(--muted-foreground)]">CSRF Header Validation:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">X-Requested-With Enforced</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-[var(--surface-elevated)]/60 border border-[var(--border)]">
              <span className="text-[var(--muted-foreground)]">Replay Protection:</span>
              <span className="font-mono text-[var(--primary)]">One-Time Token Invalidation</span>
            </div>
          </div>
        </div>
      </div>

      {/* RBAC Testing Identity Switcher */}
      <div className="rounded border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-elevated)]">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[var(--primary)]" />
              <h2 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
                RBAC Test Harness & Identity Simulation
              </h2>
              <RoleBadge role={activeRole} />
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
              Simulate enterprise roles in this browser session to test dual-custody approval gating, policy constraints, and tool execution boundaries.
            </p>
          </div>
          <span className="text-[11px] font-mono text-[var(--muted-foreground)]">
            Active: <span className="font-semibold text-[var(--foreground)]">{activeEmail}</span>
          </span>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ROLES.map((r) => {
            const isSelected = activeRole === r.role;
            return (
              <button
                key={r.role}
                type="button"
                onClick={() => handleRoleChange(r.role, r.email)}
                className={`p-3.5 rounded border text-left transition-all flex flex-col justify-between space-y-2.5 ${
                  isSelected
                    ? "bg-[var(--surface-elevated)] border-[var(--primary)] shadow-sm"
                    : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--muted-foreground)]/40 hover:bg-[var(--surface-elevated)]/40"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <RoleBadge role={r.role} />
                  {isSelected ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      <Check className="w-3 h-3" />
                      ACTIVE
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                      CLICK TO ACTIVATE
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--foreground)] leading-relaxed">{r.desc}</p>
                <span className="font-mono text-[10px] text-[var(--muted-foreground)] block truncate pt-1 border-t border-[var(--border)]/60">
                  {r.email}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
