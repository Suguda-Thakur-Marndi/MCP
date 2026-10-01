"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Wrench,
  Search,
  Shield,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  X,
  FileCode,
  Copy,
  Check,
  Lock,
  ChevronRight,
  Clock,
  Activity,
} from "lucide-react";
import { INTEGRATIONS, IntegrationTool } from "@/lib/sentinel-data";
import { RiskBadge } from "@/components/ui/Badges";
import { prettyJson } from "@/lib/utils";

interface UnifiedToolRow {
  id: string;
  application: string;
  appLogo: string;
  toolName: string;
  description: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskScore: number;
  requiredApproval: boolean;
  isDestructive: boolean;
  policy: string;
  status: "ACTIVE" | "ENFORCING" | "RESTRICTED";
  allowedResources: string[];
  parametersSchema: Record<string, unknown>;
  recentExecutionsCount: number;
}

export default function ToolRegistryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState("ALL");
  const [selectedRisk, setSelectedRisk] = useState("ALL");
  const [selectedTool, setSelectedTool] = useState<UnifiedToolRow | null>(null);
  const [copied, setCopied] = useState(false);

  // Compile unified tools array across every connected application
  const allTools: UnifiedToolRow[] = useMemo(() => {
    const list: UnifiedToolRow[] = [];
    INTEGRATIONS.forEach((app) => {
      app.tools.forEach((t) => {
        list.push({
          id: `${app.id}_${t.name}`,
          application: app.name,
          appLogo: app.logo,
          toolName: t.name,
          description: t.description,
          riskLevel: t.riskLevel,
          riskScore: t.riskScore,
          requiredApproval: t.requiresApproval,
          isDestructive: t.isDestructive,
          policy: t.policy,
          status: t.isDestructive ? "RESTRICTED" : t.requiresApproval ? "ENFORCING" : "ACTIVE",
          allowedResources: t.allowedResources,
          parametersSchema: t.parametersSchema,
          recentExecutionsCount: t.recentExecutionsCount,
        });
      });
    });
    return list;
  }, []);

  const applications = useMemo(() => {
    return ["ALL", ...Array.from(new Set(allTools.map((t) => t.application)))];
  }, [allTools]);

  const filteredTools = useMemo(() => {
    return allTools.filter((t) => {
      if (selectedApp !== "ALL" && t.application !== selectedApp) return false;
      if (selectedRisk !== "ALL" && t.riskLevel !== selectedRisk) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          t.toolName.toLowerCase().includes(q) ||
          t.application.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.policy.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [allTools, selectedApp, selectedRisk, searchQuery]);

  const handleCopy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="pb-5 border-b border-[var(--border)] flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] mb-1">
            <span className="font-bold text-[var(--text-primary)]">MCP SENTINEL</span>
            <span>/</span>
            <span className="text-[var(--accent)] font-semibold">INTEGRATIONS</span>
            <span>/</span>
            <span className="text-[var(--text-secondary)]">TOOL INVENTORY</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Central Tool Registry
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
            Every callable tool across every connected application, monitored by schema validation, risk classification, and invariant approval policies.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono-tnum text-xs">
          <Link
            href="/integrations"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-medium border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-2xs"
          >
            <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Connected Software ({INTEGRATIONS.length})</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tools across Canva, GitHub, Slack, Drive, Jira, Notion, Postgres..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)]/50 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] font-mono-tnum"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tnum">
            {/* App filter */}
            <select
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              className="px-2.5 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-primary)] focus:outline-none"
            >
              <option value="ALL">All Applications ({allTools.length} tools)</option>
              {applications.filter((a) => a !== "ALL").map((app) => (
                <option key={app} value={app}>{app}</option>
              ))}
            </select>

            {/* Risk filter */}
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="px-2.5 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-primary)] focus:outline-none"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Central Tool Registry Table matching exact prompt columns */}
      <div className="rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-secondary)]/30">
                <th className="py-3 px-4">Application</th>
                <th className="py-3 px-4">Tool</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Risk</th>
                <th className="py-3 px-4">Approval</th>
                <th className="py-3 px-4">Policy</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-mono-tnum">
              {filteredTools.map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-[var(--bg-secondary)]/40 transition-colors group"
                >
                  {/* APPLICATION */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{t.appLogo}</span>
                      <span className="font-semibold text-xs text-[var(--text-primary)]">
                        {t.application}
                      </span>
                    </div>
                  </td>

                  {/* TOOL */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <code className="text-[11px] font-bold text-[var(--accent)]">
                      {t.toolName}
                    </code>
                  </td>

                  {/* DESCRIPTION */}
                  <td className="py-3 px-4 max-w-xs">
                    <p className="text-[11px] text-[var(--text-secondary)] font-sans line-clamp-1">
                      {t.description}
                    </p>
                  </td>

                  {/* RISK */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <RiskBadge level={t.riskLevel} score={t.riskScore} />
                  </td>

                  {/* APPROVAL */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {t.requiredApproval ? (
                      <span className="px-1.5 py-0.2 rounded-xs bg-[var(--risk-critical-bg)] border border-[var(--risk-critical-border)] text-[10px] font-bold text-[var(--risk-critical)]">
                        REQUIRED
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)] font-mono-tnum">
                        Automatic
                      </span>
                    )}
                  </td>

                  {/* POLICY */}
                  <td className="py-3 px-4 max-w-[140px] truncate">
                    <span className="text-[10px] text-[var(--text-primary)] font-semibold truncate block">
                      {t.policy}
                    </span>
                  </td>

                  {/* STATUS */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`px-1.5 py-0.2 rounded-xs text-[10px] font-bold ${
                        t.status === "ACTIVE"
                          ? "bg-[var(--risk-low-bg)] text-[var(--risk-low)] border border-[var(--risk-low-border)]"
                          : t.status === "RESTRICTED"
                          ? "bg-[var(--risk-critical-bg)] text-[var(--risk-critical)] border border-[var(--risk-critical-border)]"
                          : "bg-[var(--risk-high-bg)] text-[var(--risk-high)] border border-[var(--risk-high-border)]"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>

                  {/* INSPECT */}
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedTool(t)}
                      className="p-1 rounded-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                      title="Inspect tool parameters schema, permissions, and usage"
                      aria-label={`Inspect ${t.toolName}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between text-xs text-[var(--text-muted)] font-mono-tnum">
          <span>{filteredTools.length} Tools Configured in Central Registry</span>
          <span>Zero Unauthenticated Invocations Allowed</span>
        </div>
      </div>

      {/* TOOL DETAIL INSPECTION DRAWER */}
      {selectedTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg h-full bg-[var(--bg-card)] border-l border-[var(--border)] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono-tnum uppercase text-[var(--text-muted)]">
                    <span>{selectedTool.appLogo}</span>
                    <span>{selectedTool.application}</span>
                  </div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] font-mono-tnum">
                    {selectedTool.toolName}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTool(null)}
                  className="p-1 rounded-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {selectedTool.description}
              </p>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono-tnum">
                <div className="p-2.5 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase block">Risk Score</span>
                  <RiskBadge level={selectedTool.riskLevel} score={selectedTool.riskScore} />
                </div>
                <div className="p-2.5 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase block">Approval Status</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {selectedTool.requiredApproval ? "REQUIRED" : "AUTOMATIC"}
                  </span>
                </div>
                <div className="p-2.5 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase block">Destructive Action</span>
                  <span className={`font-bold ${selectedTool.isDestructive ? "text-[var(--risk-critical)]" : "text-[var(--risk-low)]"}`}>
                    {selectedTool.isDestructive ? "TRUE (PURGE)" : "FALSE"}
                  </span>
                </div>
                <div className="p-2.5 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase block">Usage History</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {selectedTool.recentExecutionsCount.toLocaleString()} calls
                  </span>
                </div>
              </div>

              {/* Allowed Resources & Permissions */}
              <div className="space-y-1.5 text-xs font-mono-tnum">
                <span className="text-[10px] uppercase text-[var(--text-muted)] font-bold block">
                  Allowed Resource Paths
                </span>
                <div className="p-2.5 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)]">
                  {selectedTool.allowedResources.join(", ")}
                </div>
              </div>

              {/* Policy Enforced */}
              <div className="space-y-1.5 text-xs font-mono-tnum">
                <span className="text-[10px] uppercase text-[var(--text-muted)] font-bold block">
                  Active Policy Binding
                </span>
                <div className="p-2.5 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)]">
                  {selectedTool.policy}
                </div>
              </div>

              {/* Schema and Parameters */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] uppercase font-mono-tnum text-[var(--text-muted)] font-bold">
                    Pydantic V2 Parameters Schema
                  </span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(selectedTool.parametersSchema, null, 2))}
                    className="inline-flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline font-mono-tnum"
                  >
                    {copied ? <Check className="w-3 h-3 text-[var(--risk-low)]" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Copied" : "Copy Schema"}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] text-[11px] font-mono-tnum text-[var(--text-primary)] overflow-x-auto max-h-48">
                  {prettyJson(selectedTool.parametersSchema)}
                </pre>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between">
              <Link
                href="/audit"
                className="text-xs text-[var(--accent)] font-semibold hover:underline inline-flex items-center gap-1"
              >
                <span>Recent Tool Audit Events</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setSelectedTool(null)}
                className="px-3.5 py-1.5 rounded-xs text-xs font-semibold bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)]"
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
