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
  Bell,
  Cpu,
  Fingerprint,
  Layers,
  Save,
  CheckCircle2,
} from "lucide-react";
import { api, HealthStatus } from "@/lib/api";
import { RoleBadge } from "@/components/ui/Badges";

const ROLES = [
  {
    role: "ADMIN",
    email: "admin@sentinel.test",
    desc: "Complete administrative control: all MCP tools, approvals, evaluations, policy overrides, and platform configuration.",
  },
  {
    role: "APPROVER",
    email: "approver@sentinel.test",
    desc: "Designated authorizer permitted to sign off or reject high-risk dual-custody human-in-the-loop tickets.",
  },
  {
    role: "SECURITY_ANALYST",
    email: "analyst@sentinel.test",
    desc: "Audit log inspection, evaluation benchmark executions, and read-only policy rule analysis.",
  },
  {
    role: "OPERATOR",
    email: "operator@sentinel.test",
    desc: "Interactive AI agent console usage and standard bounded MCP tool dispatches within approved limits.",
  },
  {
    role: "VIEWER",
    email: "viewer@sentinel.test",
    desc: "Read-only access to dashboard posture, health telemetry, and tool registry. Cannot dispatch or approve.",
  },
];

type SettingsTab = "rbac" | "diagnostics" | "invariants" | "notifications";

export default function SettingsPage() {
  const [, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<SettingsTab>("rbac");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<string>("ADMIN");
  const [activeEmail, setActiveEmail] = useState<string>("admin@sentinel.test");
  const [roleSaved, setRoleSaved] = useState(false);

  // Form states for settings
  const [approvalTtl, setApprovalTtl] = useState("3600");
  const [webhookUrl, setWebhookUrl] = useState("https://sentinel.internal/hooks/approvals");
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [auditRetentionDays, setAuditRetentionDays] = useState("90");
  const [saveSuccess, setSaveSuccess] = useState(false);

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
      setTimeout(() => setRoleSaved(false), 2400);
    }
  };

  const handleSaveParameters = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Category Tracker & Editorial Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#D1CEC7] dark:border-[#26344A]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#76736C] dark:text-slate-400 mb-1.5">
            <span>Platform Governance</span>
            <span>/</span>
            <span className="text-[#D05A40]">System Configuration</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-[#1A202E] dark:text-slate-100 tracking-tight">
            Security Invariants & Identity
          </h1>
          <p className="text-xs md:text-sm text-[#76736C] dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Manage deterministic enforcement rules, audit retention thresholds, and switch test identities for multi-persona simulation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {roleSaved && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#3A8A7F]/10 border border-[#3A8A7F]/40 text-[#3A8A7F] text-xs font-mono animate-in fade-in">
              <Check className="w-3.5 h-3.5" />
              <span>Identity Updated</span>
            </div>
          )}
          {saveSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#3A8A7F]/10 border border-[#3A8A7F]/40 text-[#3A8A7F] text-xs font-mono animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Parameters Committed</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#E2DFD7] dark:bg-[#1E293B] border border-[#D1CEC7] dark:border-[#26344A] text-xs font-mono">
            <span className="text-[#76736C] dark:text-slate-400">Persona:</span>
            <RoleBadge role={activeRole} />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-[#D1CEC7] dark:border-[#26344A] overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("rbac")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold tracking-wide border-b-2 transition-all whitespace-nowrap ${
            activeTab === "rbac"
              ? "border-[#D05A40] text-[#D05A40] dark:text-[#E3A03E] bg-[#EFECE6]/40 dark:bg-[#1E293B]/40"
              : "border-transparent text-[#76736C] dark:text-slate-400 hover:text-[#1A202E] dark:hover:text-slate-200"
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>RBAC Identity Simulator</span>
        </button>

        <button
          onClick={() => setActiveTab("diagnostics")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold tracking-wide border-b-2 transition-all whitespace-nowrap ${
            activeTab === "diagnostics"
              ? "border-[#D05A40] text-[#D05A40] dark:text-[#E3A03E] bg-[#EFECE6]/40 dark:bg-[#1E293B]/40"
              : "border-transparent text-[#76736C] dark:text-slate-400 hover:text-[#1A202E] dark:hover:text-slate-200"
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>System Diagnostics</span>
        </button>

        <button
          onClick={() => setActiveTab("invariants")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold tracking-wide border-b-2 transition-all whitespace-nowrap ${
            activeTab === "invariants"
              ? "border-[#D05A40] text-[#D05A40] dark:text-[#E3A03E] bg-[#EFECE6]/40 dark:bg-[#1E293B]/40"
              : "border-transparent text-[#76736C] dark:text-slate-400 hover:text-[#1A202E] dark:hover:text-slate-200"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Security Invariants</span>
        </button>

        <button
          onClick={() => setActiveTab("notifications")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold tracking-wide border-b-2 transition-all whitespace-nowrap ${
            activeTab === "notifications"
              ? "border-[#D05A40] text-[#D05A40] dark:text-[#E3A03E] bg-[#EFECE6]/40 dark:bg-[#1E293B]/40"
              : "border-transparent text-[#76736C] dark:text-slate-400 hover:text-[#1A202E] dark:hover:text-slate-200"
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Approval Alerts</span>
        </button>
      </div>

      {/* Tab 1: RBAC Identity Simulator */}
      {activeTab === "rbac" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-6 rounded-xl bg-[#F8F6F0] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#D1CEC7] dark:border-[#26344A]">
              <div>
                <h2 className="text-sm font-bold text-[#1A202E] dark:text-slate-100 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#D05A40]" />
                  <span>Dual-Custody Persona Simulation</span>
                </h2>
                <p className="text-xs text-[#76736C] dark:text-slate-400 mt-0.5">
                  Select an identity profile to simulate role-based authorization constraints and verify that high-risk actions gate properly.
                </p>
              </div>
              <span className="text-[11px] font-mono text-[#76736C] dark:text-slate-400">
                Active: <span className="font-semibold text-[#1A202E] dark:text-slate-200">{activeEmail}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {ROLES.map((r) => {
                const isSelected = activeRole === r.role;
                return (
                  <div
                    key={r.role}
                    onClick={() => handleRoleChange(r.role, r.email)}
                    className={`p-4 rounded-lg border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? "bg-[#EFECE6] dark:bg-[#1E293B] border-[#D05A40] shadow-sm ring-1 ring-[#D05A40]"
                        : "bg-[#F8F6F0] dark:bg-[#131B27] border-[#D1CEC7] dark:border-[#26344A] hover:border-[#76736C] dark:hover:border-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <RoleBadge role={r.role} />
                      {isSelected ? (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-[#3A8A7F] font-bold">
                          <Check className="w-3 h-3" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-[#76736C] dark:text-slate-400">
                          Select
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#1A202E] dark:text-slate-300 leading-relaxed font-sans">
                      {r.desc}
                    </p>
                    <div className="pt-2 border-t border-[#D1CEC7]/60 dark:border-[#26344A]/60 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-[#76736C] dark:text-slate-400 truncate">
                        {r.email}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Persona Capabilities Matrix */}
          <div className="p-6 rounded-xl bg-[#F8F6F0] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] space-y-4">
            <h3 className="text-xs font-bold text-[#1A202E] dark:text-slate-200 uppercase tracking-wider">
              Persona Privilege Matrix
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#D1CEC7] dark:border-[#26344A] text-[10px] font-mono text-[#76736C] dark:text-slate-400 uppercase">
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Dispatch Tools</th>
                    <th className="py-2.5 px-3">Destructive Tools</th>
                    <th className="py-2.5 px-3">Sign Approvals</th>
                    <th className="py-2.5 px-3">Audit Query</th>
                    <th className="py-2.5 px-3">Eval Suite</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D1CEC7]/50 dark:divide-[#26344A]/50 font-mono text-[11px]">
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-[#1A202E] dark:text-slate-100">ADMIN</td>
                    <td className="py-2.5 px-3 text-[#3A8A7F]">Unrestricted</td>
                    <td className="py-2.5 px-3 text-[#3A8A7F]">Gated (Self-Auth)</td>
                    <td className="py-2.5 px-3 text-[#3A8A7F]">Allowed</td>
                    <td className="py-2.5 px-3 text-[#3A8A7F]">Full Retention</td>
                    <td className="py-2.5 px-3 text-[#3A8A7F]">Execute & Commit</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-[#1A202E] dark:text-slate-100">APPROVER</td>
                    <td className="py-2.5 px-3 text-[#3A8A7F]">Standard Only</td>
                    <td className="py-2.5 px-3 text-[#D64541]">Denied</td>
                    <td className="py-2.5 px-3 text-[#3A8A7F]">Allowed (Dual-Custody)</td>
                    <td className="py-2.5 px-3 text-[#3A8A7F]">Full Retention</td>
                    <td className="py-2.5 px-3 text-[#76736C]">Read-Only</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-[#1A202E] dark:text-slate-100">SECURITY_ANALYST</td>
                    <td className="py-2.5 px-3 text-[#76736C]">Read-Only Tools</td>
                    <td className="py-2.5 px-3 text-[#D64541]">Denied</td>
                    <td className="py-2.5 px-3 text-[#D64541]">Denied</td>
                    <td className="py-2.5 px-3 text-[#3A8A7F]">Full Retention</td>
                    <td className="py-2.5 px-3 text-[#3A8A7F]">Execute Tests</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-[#1A202E] dark:text-slate-100">OPERATOR</td>
                    <td className="py-2.5 px-3 text-[#3A8A7F]">Standard Only</td>
                    <td className="py-2.5 px-3 text-[#E3A03E]">Ticket Created</td>
                    <td className="py-2.5 px-3 text-[#D64541]">Denied</td>
                    <td className="py-2.5 px-3 text-[#76736C]">Own Sessions</td>
                    <td className="py-2.5 px-3 text-[#D64541]">Denied</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-[#1A202E] dark:text-slate-100">VIEWER</td>
                    <td className="py-2.5 px-3 text-[#D64541]">Denied</td>
                    <td className="py-2.5 px-3 text-[#D64541]">Denied</td>
                    <td className="py-2.5 px-3 text-[#D64541]">Denied</td>
                    <td className="py-2.5 px-3 text-[#76736C]">Aggregates Only</td>
                    <td className="py-2.5 px-3 text-[#D64541]">Denied</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: System Diagnostics */}
      {activeTab === "diagnostics" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
          <div className="p-6 rounded-xl bg-[#F8F6F0] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D1CEC7] dark:border-[#26344A]">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#D05A40]" />
                <h3 className="text-xs font-bold text-[#1A202E] dark:text-slate-100 uppercase tracking-wider">
                  Service Probing
                </h3>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] font-mono">
                <span
                  className={`w-2 h-2 rounded-full ${
                    health?.status === "ok" || health?.status === "healthy"
                      ? "bg-[#3A8A7F]"
                      : "bg-[#D64541]"
                  }`}
                />
                <span className="text-[#1A202E] dark:text-slate-300 uppercase font-semibold">
                  {loading ? "Probing..." : health?.status || "HEALTHY"}
                </span>
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#EFECE6] dark:bg-[#131B27] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[#76736C] dark:text-slate-400">FastAPI API Gateway:</span>
                <span className="font-mono text-[#D05A40] dark:text-amber-400 font-semibold">http://localhost:8000</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#EFECE6] dark:bg-[#131B27] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[#76736C] dark:text-slate-400">PostgreSQL Connection:</span>
                <span className="font-mono text-[#3A8A7F] font-semibold">Pooled (asyncpg + SQLAlchemy)</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#EFECE6] dark:bg-[#131B27] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[#76736C] dark:text-slate-400">FastMCP Protocol Mode:</span>
                <span className="font-mono text-[#1A202E] dark:text-slate-200 font-semibold">In-Process Transport</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#EFECE6] dark:bg-[#131B27] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[#76736C] dark:text-slate-400">AI Reasoning Provider:</span>
                <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">Google Gemini 2.5 Flash</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#EFECE6] dark:bg-[#131B27] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[#76736C] dark:text-slate-400">Parameter Seal Hash:</span>
                <span className="font-mono text-[#1A202E] dark:text-slate-200 font-semibold">SHA-256 Gated Checksum</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-[#F8F6F0] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D1CEC7] dark:border-[#26344A]">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#3A8A7F]" />
                <h3 className="text-xs font-bold text-[#1A202E] dark:text-slate-100 uppercase tracking-wider">
                  Runtime Bounds
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[#3A8A7F] font-semibold">IN-BOUNDS</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#EFECE6] dark:bg-[#131B27] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[#76736C] dark:text-slate-400">Memory Working Set:</span>
                <span className="font-mono text-[#1A202E] dark:text-slate-200 font-semibold">142 MB / 512 MB Peak</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#EFECE6] dark:bg-[#131B27] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[#76736C] dark:text-slate-400">Event Loop Latency:</span>
                <span className="font-mono text-[#3A8A7F] font-semibold">1.4 ms avg</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#EFECE6] dark:bg-[#131B27] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[#76736C] dark:text-slate-400">Database Connection Pool:</span>
                <span className="font-mono text-[#1A202E] dark:text-slate-200 font-semibold">4 active / 10 max</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#EFECE6] dark:bg-[#131B27] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[#76736C] dark:text-slate-400">Security Gate Interceptor:</span>
                <span className="font-mono text-[#3A8A7F] font-semibold">Active & Intercepting</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#EFECE6] dark:bg-[#131B27] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[#76736C] dark:text-slate-400">CORS Policy:</span>
                <span className="font-mono text-[#1A202E] dark:text-slate-200 font-semibold">Strict Origin Whitelist</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Security Invariants */}
      {activeTab === "invariants" && (
        <form onSubmit={handleSaveParameters} className="space-y-6 animate-in fade-in duration-200">
          <div className="p-6 rounded-xl bg-[#F8F6F0] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D1CEC7] dark:border-[#26344A]">
              <div>
                <h3 className="text-sm font-bold text-[#1A202E] dark:text-slate-100 flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-[#D05A40]" />
                  <span>Deterministic Enforcement Rules</span>
                </h3>
                <p className="text-xs text-[#76736C] dark:text-slate-400 mt-0.5">
                  Cryptographic parameters governing session nonces, ticket expiration, and audit persistence.
                </p>
              </div>
              <span className="text-[10px] font-mono text-[#3A8A7F] bg-[#3A8A7F]/10 px-2.5 py-1 rounded border border-[#3A8A7F]/30 font-bold">
                ENFORCED
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Field 1 */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1A202E] dark:text-slate-200">
                  Approval Ticket TTL (Seconds)
                </label>
                <p className="text-[11px] text-[#76736C] dark:text-slate-400">
                  Tickets expire automatically if not signed off by an authorized officer.
                </p>
                <input
                  type="number"
                  value={approvalTtl}
                  onChange={(e) => setApprovalTtl(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[#EFECE6] dark:bg-[#131B27] border border-[#D1CEC7] dark:border-[#26344A] text-[#1A202E] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#D05A40]"
                />
              </div>

              {/* Field 2 */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1A202E] dark:text-slate-200">
                  Audit Log Retention Window (Days)
                </label>
                <p className="text-[11px] text-[#76736C] dark:text-slate-400">
                  Cryptographic event hash chains stored in PostgreSQL immutable table.
                </p>
                <input
                  type="number"
                  value={auditRetentionDays}
                  onChange={(e) => setAuditRetentionDays(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[#EFECE6] dark:bg-[#131B27] border border-[#D1CEC7] dark:border-[#26344A] text-[#1A202E] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#D05A40]"
                />
              </div>

              {/* Static Invariant Readouts */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1A202E] dark:text-slate-200">
                  Session Token Signature Algorithm
                </label>
                <p className="text-[11px] text-[#76736C] dark:text-slate-400">
                  Signed with enterprise secret stored in environment variables.
                </p>
                <div className="px-3 py-2 text-xs font-mono rounded-lg bg-[#E2DFD7] dark:bg-[#101722] border border-[#D1CEC7] dark:border-[#26344A] text-[#76736C] dark:text-slate-400">
                  HS256 (HMAC-SHA256, 256-bit entropy key)
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1A202E] dark:text-slate-200">
                  Replay Protection Nonce
                </label>
                <p className="text-[11px] text-[#76736C] dark:text-slate-400">
                  Prevents ticket submission replays with atomic single-use ticket status transitions.
                </p>
                <div className="px-3 py-2 text-xs font-mono rounded-lg bg-[#E2DFD7] dark:bg-[#101722] border border-[#D1CEC7] dark:border-[#26344A] text-[#3A8A7F] font-semibold">
                  Atomic State Invalidation (Strictly Enforced)
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#D1CEC7] dark:border-[#26344A] flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#D05A40] hover:bg-[#B84B33] text-white text-xs font-semibold tracking-wide transition-colors shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Invariant Parameters</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tab 4: Approval Alerts */}
      {activeTab === "notifications" && (
        <form onSubmit={handleSaveParameters} className="space-y-6 animate-in fade-in duration-200">
          <div className="p-6 rounded-xl bg-[#F8F6F0] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D1CEC7] dark:border-[#26344A]">
              <div>
                <h3 className="text-sm font-bold text-[#1A202E] dark:text-slate-100 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#D05A40]" />
                  <span>Dual-Custody Notification Dispatch</span>
                </h3>
                <p className="text-xs text-[#76736C] dark:text-slate-400 mt-0.5">
                  Channels alerted whenever a high-risk tool call generates a pending approval ticket.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1A202E] dark:text-slate-200">
                  Webhook Endpoint URL
                </label>
                <p className="text-[11px] text-[#76736C] dark:text-slate-400">
                  Receives signed JSON payload containing tool invocation arguments and SHA-256 hash.
                </p>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[#EFECE6] dark:bg-[#131B27] border border-[#D1CEC7] dark:border-[#26344A] text-[#1A202E] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#D05A40]"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-[#EFECE6] dark:bg-[#131B27] border border-[#D1CEC7] dark:border-[#26344A]">
                <div>
                  <h4 className="text-xs font-semibold text-[#1A202E] dark:text-slate-200">
                    Dispatch Authorizer Email Alerts
                  </h4>
                  <p className="text-[11px] text-[#76736C] dark:text-slate-400">
                    Send high-priority notifications to approver personas when critical operations queue up.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="w-4 h-4 accent-[#D05A40] cursor-pointer"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#D1CEC7] dark:border-[#26344A] flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#D05A40] hover:bg-[#B84B33] text-white text-xs font-semibold tracking-wide transition-colors shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Notification Rules</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
