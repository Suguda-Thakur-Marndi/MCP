"use client";

import React, { useState, useMemo, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Search,
  Layers,
  Eye,
  X,
  Copy,
  Check,
  Lock,
  ChevronRight,
  RefreshCw,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import { api, ToolInfo } from "@/lib/api";
import { prettyJson, formatNumber, riskBadgeClass } from "@/lib/utils";
import { LoadingState, EmptyState } from "@/components/ui/FeedbackStates";

interface UnifiedToolRow {
  id: string;
  application: string;
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
}

export default function ToolRegistryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState("ALL");
  const [selectedRisk, setSelectedRisk] = useState("ALL");
  const [selectedTool, setSelectedTool] = useState<UnifiedToolRow | null>(null);
  const [copied, setCopied] = useState(false);
  const [liveTools, setLiveTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  const loadTools = () => {
    setLoading(true);
    api.policies
      .tools()
      .then((data) => {
        startTransition(() => {
          if (Array.isArray(data)) {
            setLiveTools(data);
          } else {
            setLiveTools([]);
          }
          setLoading(false);
        });
      })
      .catch(() => {
        startTransition(() => {
          setLiveTools([]);
          setLoading(false);
        });
      });
  };

  useEffect(() => {
    loadTools();
  }, []);

  const allTools: UnifiedToolRow[] = useMemo(() => {
    return liveTools.map((t) => {
      const name = t.tool_name || t.name;
      let app = "FastMCP Core";
      if (name.startsWith("github.") || name.includes("github")) {
        app = "GitHub";
      } else if (name.startsWith("postgres.") || name.startsWith("customer.") || name.startsWith("order.") || name.startsWith("database.")) {
        app = "PostgreSQL DB";
      } else if (name.startsWith("k8s.") || name.includes("kubernetes")) {
        app = "Kubernetes";
      } else if (name.startsWith("aws.") || name.includes("iam")) {
        app = "AWS IAM";
      } else if (name.startsWith("audit.")) {
        app = "Audit WORM";
      }

      const rawScore = parseInt(t.base_risk?.replace("/100", "") || "0", 10);
      const score = rawScore > 0 ? rawScore : t.risk_level === "CRITICAL" ? 95 : t.risk_level === "HIGH" ? 75 : t.risk_level === "MEDIUM" ? 45 : 15;
      const riskLevel = (t.risk_level as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") || (t.is_destructive ? "CRITICAL" : "MEDIUM");

      return {
        id: `live_${name}`,
        application: app,
        toolName: name,
        description: t.description || `FastMCP governed capability: ${name}`,
        riskLevel,
        riskScore: score,
        requiredApproval: Boolean(t.requires_approval || t.is_destructive),
        isDestructive: Boolean(t.is_destructive),
        policy: t.is_destructive ? "Destructive Operation Quarantine" : t.requires_approval ? "Dual-Custody Gated" : "Standard Invariant Guardrail",
        status: t.is_destructive ? "RESTRICTED" : t.requires_approval ? "ENFORCING" : "ACTIVE",
        allowedResources: [t.resource_type || "default", "cluster/prod"],
        parametersSchema: (t.parameters || {}) as Record<string, unknown>,
      };
    });
  }, [liveTools]);

  const uniqueApplications = useMemo(() => {
    return Array.from(new Set(allTools.map((t) => t.application)));
  }, [allTools]);

  const filteredTools = useMemo(() => {
    return allTools.filter((tool) => {
      if (selectedApp !== "ALL" && tool.application !== selectedApp) return false;
      if (selectedRisk !== "ALL" && tool.riskLevel !== selectedRisk) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          tool.toolName.toLowerCase().includes(q) ||
          tool.description.toLowerCase().includes(q) ||
          tool.application.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allTools, selectedApp, selectedRisk, searchQuery]);

  const handleCopySchema = (schema: Record<string, unknown>) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(prettyJson(schema));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-xl">
      {/* Header Banner */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-sm mb-space-xxs">
            <span className="font-label-mono text-label-mono text-secondary font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              CAPABILITY GOVERNANCE
            </span>
            <span className="font-label-mono text-label-mono px-space-xs py-0.5 rounded bg-surface-container text-on-surface-variant font-bold">
              FASTMCP AUTHORITATIVE
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
            Governed Tool Registry &amp; Capabilities
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Cryptographically bounded tool schemas, parameter validations, and risk thresholds
          </p>
        </div>

        <div className="flex items-center gap-space-xs">
          <button
            onClick={loadTools}
            className="p-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            title="Reload Tool Registry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-sm font-label-mono text-label-mono">
        <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container">
          <span className="text-on-surface-variant uppercase text-[11px] block">BOUND TOOLS</span>
          <span className="font-headline-xl text-headline-xl text-on-surface font-bold block mt-1">
            {allTools.length}
          </span>
          <span className="text-[10px] text-secondary font-semibold">FastMCP registered endpoints</span>
        </div>
        <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container">
          <span className="text-on-surface-variant uppercase text-[11px] block">APPROVAL GATED</span>
          <span className="font-headline-xl text-headline-xl text-primary font-bold block mt-1">
            {allTools.filter((t) => t.requiredApproval).length}
          </span>
          <span className="text-[10px] text-primary font-semibold">Strict dual-custody enforced</span>
        </div>
        <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container">
          <span className="text-on-surface-variant uppercase text-[11px] block">DESTRUCTIVE ACTIONS</span>
          <span className="font-headline-xl text-headline-xl text-error font-bold block mt-1">
            {allTools.filter((t) => t.isDestructive).length}
          </span>
          <span className="text-[10px] text-error font-semibold">Zero auto-execution quarantine</span>
        </div>
        <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container">
          <span className="text-on-surface-variant uppercase text-[11px] block">SUBSYSTEM SOURCES</span>
          <span className="font-headline-xl text-headline-xl text-on-surface font-bold block mt-1">
            {uniqueApplications.length || 1}
          </span>
          <span className="text-[10px] text-on-surface-variant">Connected tool providers</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-space-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tools by name, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant pl-9 pr-3 py-1.5 rounded-lg border border-surface-container text-body-sm font-body-sm outline-hidden"
          />
        </div>

        <div className="flex items-center gap-space-xs w-full sm:w-auto">
          <select
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value)}
            className="bg-surface-container-lowest text-on-surface px-space-md py-1.5 rounded-lg border border-surface-container text-body-sm font-body-sm outline-hidden cursor-pointer"
          >
            <option value="ALL">All Application Sources</option>
            {uniqueApplications.map((app) => (
              <option key={app} value={app}>
                {app}
              </option>
            ))}
          </select>

          <select
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="bg-surface-container-lowest text-on-surface px-space-md py-1.5 rounded-lg border border-surface-container text-body-sm font-body-sm outline-hidden cursor-pointer"
          >
            <option value="ALL">All Risk Ratings</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>
      </div>

      {/* Tool Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-xs border border-surface-container overflow-hidden">
        {loading ? (
          <LoadingState message="Querying authoritative FastMCP capability registry..." />
        ) : filteredTools.length === 0 ? (
          <EmptyState
            title="No Governed Tools Found"
            message="No registered tools matched your query filters or have been published by active MCP daemons."
            icon={Wrench}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-body-sm text-body-sm">
              <thead>
                <tr className="bg-surface-container-low font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider border-b border-surface-container">
                  <th className="py-space-sm px-space-lg">Tool Name</th>
                  <th className="py-space-sm px-space-md">Application</th>
                  <th className="py-space-sm px-space-md">Risk Score</th>
                  <th className="py-space-sm px-space-md">Approval Gating</th>
                  <th className="py-space-sm px-space-md">Governing Policy</th>
                  <th className="py-space-sm px-space-lg text-right">Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container font-body-sm">
                {filteredTools.map((tool) => (
                  <tr key={tool.id} className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-space-md px-space-lg">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-on-surface font-label-mono text-body-sm">
                            {tool.toolName}
                          </span>
                          {tool.isDestructive && (
                            <span className="px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-label-mono text-[9px] font-bold">
                              DESTRUCTIVE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-on-surface-variant line-clamp-1 mt-0.5">
                          {tool.description}
                        </div>
                      </div>
                    </td>

                    <td className="py-space-md px-space-md whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-mono text-[10px] font-bold">
                        {tool.application}
                      </span>
                    </td>

                    <td className="py-space-md px-space-md whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded font-label-mono text-[10px] font-semibold ${riskBadgeClass(tool.riskLevel)}`}>
                        {tool.riskLevel} ({tool.riskScore})
                      </span>
                    </td>

                    <td className="py-space-md px-space-md whitespace-nowrap font-label-mono">
                      {tool.requiredApproval ? (
                        <span className="px-2 py-0.5 rounded bg-primary text-on-primary font-bold text-[10px] flex items-center gap-1 w-fit">
                          <Lock className="w-3 h-3" />
                          <span>MANDATORY GATED</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-secondary font-semibold">
                          Permitted (Guarded)
                        </span>
                      )}
                    </td>

                    <td className="py-space-md px-space-md text-[11px] font-label-mono text-on-surface-variant max-w-xs truncate">
                      {tool.policy}
                    </td>

                    <td className="py-space-md px-space-lg text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedTool(tool)}
                        className="px-2.5 py-1 rounded bg-surface-container text-on-surface hover:bg-surface-container-high font-label-ui text-label-ui font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Schema</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schema Drawer Modal */}
      {selectedTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-2xl w-full p-space-xl border border-surface-container shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between pb-space-sm border-b border-surface-container mb-space-md">
              <div>
                <div className="flex items-center gap-space-xs font-label-mono text-[11px] text-on-surface-variant mb-1">
                  <span className="font-bold text-primary">{selectedTool.application}</span>
                  <span>•</span>
                  <span>{selectedTool.riskLevel} Risk</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                  {selectedTool.toolName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTool(null)}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-space-md pr-1">
              <div>
                <span className="font-label-mono text-[10px] text-on-surface-variant uppercase font-semibold block mb-1">
                  Purpose &amp; Security Boundary
                </span>
                <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                  {selectedTool.description}
                </p>
              </div>

              <div className="p-space-md rounded-lg bg-surface-container-low border border-surface-container font-label-mono text-label-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Policy Invariant:</span>
                  <span className="font-semibold text-on-surface">{selectedTool.policy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Dual-Custody Sign-Off:</span>
                  <span className="font-semibold text-primary">
                    {selectedTool.requiredApproval ? "Enforced" : "Not Required"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Destructive Vector:</span>
                  <span className="font-semibold text-error">
                    {selectedTool.isDestructive ? "Yes (Irreversible)" : "No (Safe/Scoped)"}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-mono text-[10px] text-on-surface-variant uppercase font-semibold">
                    Input Parameters Schema (JSONSchema)
                  </span>
                  <button
                    onClick={() => handleCopySchema(selectedTool.parametersSchema)}
                    className="flex items-center gap-1 font-label-mono text-[10px] text-primary hover:underline cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-secondary" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Copied" : "Copy Schema"}</span>
                  </button>
                </div>
                <pre className="p-space-md bg-surface-container rounded-lg font-label-mono text-code-sm text-on-surface overflow-x-auto border border-surface-container max-h-60">
                  {prettyJson(selectedTool.parametersSchema)}
                </pre>
              </div>
            </div>

            <div className="pt-space-md border-t border-surface-container flex justify-end">
              <button
                onClick={() => setSelectedTool(null)}
                className="px-space-md py-1.5 rounded-lg bg-surface-container text-on-surface font-label-ui text-label-ui font-semibold hover:bg-surface-container-high transition-colors cursor-pointer"
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
