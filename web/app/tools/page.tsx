"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  Wrench,
  Search,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Eye,
  X,
  FileCode,
  Copy,
  Check,
  Lock,
  Layers,
  CheckCircle2,
  Database,
  ArrowRight,
} from "lucide-react";
import { api, ToolInfo } from "@/lib/api";
import { prettyJson } from "@/lib/utils";
import { RiskBadge, VerificationBadge } from "@/components/ui/Badges";
import { LoadingState, EmptyState } from "@/components/ui/FeedbackStates";

const INITIAL_TOOLS: ToolInfo[] = [
  {
    tool_name: "query_customer_records",
    name: "query_customer_records",
    description: "Queries customer records with row-level security and field authorization.",
    risk_level: "LOW",
    base_risk: "10/100",
    is_destructive: false,
    destructive: false,
    requires_approval: false,
    read_only: true,
    operation_type: "read",
    resource_type: "customer",
    data_sensitivity: "CONFIDENTIAL",
    parameters: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Filter criteria" },
        limit: { type: "integer", default: 10 },
      },
    },
  },
  {
    tool_name: "get_customer",
    name: "get_customer",
    description: "Retrieves customer record by ID with authorized field projection.",
    risk_level: "LOW",
    base_risk: "10/100",
    is_destructive: false,
    destructive: false,
    requires_approval: false,
    read_only: true,
    operation_type: "read",
    resource_type: "customer",
    data_sensitivity: "CONFIDENTIAL",
    parameters: {
      type: "object",
      required: ["customer_id"],
      properties: {
        customer_id: { type: "string", description: "Customer primary identifier" },
      },
    },
  },
  {
    tool_name: "get_customer_orders",
    name: "get_customer_orders",
    description: "Retrieves customer purchase history, fulfillment statuses, and order lines.",
    risk_level: "LOW",
    base_risk: "15/100",
    is_destructive: false,
    destructive: false,
    requires_approval: false,
    read_only: true,
    operation_type: "read",
    resource_type: "order",
    data_sensitivity: "SENSITIVE",
    parameters: {
      type: "object",
      required: ["customer_id"],
      properties: {
        customer_id: { type: "string" },
        status: { type: "string" },
      },
    },
  },
  {
    tool_name: "append_customer_audit_note",
    name: "append_customer_audit_note",
    description: "Appends verified operational audit notes to customer ledger.",
    risk_level: "MEDIUM",
    base_risk: "20/100",
    is_destructive: false,
    destructive: false,
    requires_approval: false,
    read_only: false,
    operation_type: "create",
    resource_type: "audit_note",
    data_sensitivity: "CONFIDENTIAL",
    parameters: {
      type: "object",
      required: ["customer_id", "note"],
      properties: {
        customer_id: { type: "string" },
        note: { type: "string" },
      },
    },
  },
  {
    tool_name: "update_customer",
    name: "update_customer",
    description: "Updates customer fields subject to schema validation and policy logging.",
    risk_level: "MEDIUM",
    base_risk: "25/100",
    is_destructive: false,
    destructive: false,
    requires_approval: false,
    read_only: false,
    operation_type: "update",
    resource_type: "customer",
    data_sensitivity: "CONFIDENTIAL",
    parameters: {
      type: "object",
      required: ["customer_id", "updates"],
      properties: {
        customer_id: { type: "string" },
        updates: { type: "object" },
      },
    },
  },
  {
    tool_name: "delete_customer",
    name: "delete_customer",
    description: "Deletes customer and purges associated records. Strict human-approval gated.",
    risk_level: "HIGH",
    base_risk: "30/100",
    is_destructive: true,
    destructive: true,
    requires_approval: true,
    read_only: false,
    operation_type: "delete",
    resource_type: "customer",
    data_sensitivity: "CONFIDENTIAL",
    parameters: {
      type: "object",
      required: ["customer_id"],
      properties: {
        customer_id: { type: "string" },
        purge_orders: { type: "boolean", default: false },
      },
    },
  },
  {
    tool_name: "purge_inactive_customer_data",
    name: "purge_inactive_customer_data",
    description: "Permanently purges inactive customer data. Mandatory dual-custody gated.",
    risk_level: "CRITICAL",
    base_risk: "45/100",
    is_destructive: true,
    destructive: true,
    requires_approval: true,
    read_only: false,
    operation_type: "purge",
    resource_type: "customer",
    data_sensitivity: "CONFIDENTIAL",
    parameters: {
      type: "object",
      required: ["inactive_days_threshold"],
      properties: {
        inactive_days_threshold: { type: "integer", default: 365 },
        batch_size: { type: "integer", default: 100 },
      },
    },
  },
];

export default function ToolsRegistryPage() {
  const [tools, setTools] = useState<ToolInfo[]>(INITIAL_TOOLS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRisk, setSelectedRisk] = useState<string>("ALL");
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(INITIAL_TOOLS[0]);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();

  const fetchTools = () => {
    setLoading(true);
    setError(null);
    api.policies
      .tools()
      .then((data) => {
        startTransition(() => {
          if (data && data.length > 0) {
            setTools(data);
            setSelectedTool((prev) => prev ? (data.find(d => d.name === prev.name) || data[0]) : data[0]);
          }
          setLoading(false);
        });
      })
      .catch((err: unknown) => {
        startTransition(() => {
          setError(err instanceof Error ? err.message : "Failed to load FastMCP tools");
          setLoading(false);
        });
      });
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredTools = tools.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk =
      selectedRisk === "ALL" || t.risk_level.toUpperCase() === selectedRisk.toUpperCase();
    return matchesSearch && matchesRisk;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono-tnum font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Tool Governance
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
            <span className="text-[10px] font-mono-tnum text-[var(--success)] font-semibold">FASTMCP PROTOCOL</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            FastMCP Tool Registry & Contracts
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Registered tool bus. Parameter validation hooks, risk classifications, and dual-custody approval gating enforced prior to database execution.
          </p>
        </div>

        <button
          onClick={fetchTools}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Reload Registry</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by tool name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--accent)]"
          />
        </div>

        <div className="flex items-center gap-1.5 font-mono-tnum text-xs overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] mr-1">Risk Tier:</span>
          {["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRisk(r)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                selectedRisk === r
                  ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                  : "bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Master-Detail Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Master List (5 Cols) */}
        <div className="lg:col-span-5 rounded bg-[var(--bg-card)] border border-[var(--border)] p-3 shadow-xs space-y-2">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
            <span>Registered Tool Inventory</span>
            <span className="font-mono-tnum">{filteredTools.length} Tools</span>
          </div>

          <div className="space-y-1.5">
            {loading ? (
              <LoadingState message="Discovering FastMCP tool schemas..." />
            ) : filteredTools.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)] font-mono-tnum">
                No FastMCP tools match your current filter.
              </div>
            ) : (
              filteredTools.map((t) => {
                const isSelected = selectedTool?.name === t.name;

                return (
                  <div
                    key={t.name}
                    onClick={() => setSelectedTool(t)}
                    className={`p-3 rounded border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[var(--bg-primary)] border-[var(--accent)] shadow-xs ring-1 ring-[var(--accent)]/30"
                        : "bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-primary)]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold font-mono-tnum text-[var(--text-primary)]">
                        {t.name}
                      </span>
                      <RiskBadge severity={t.risk_level} />
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                      {t.description}
                    </p>
                    <div className="mt-2 pt-1.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] font-mono-tnum text-[var(--text-muted)]">
                      <span>Transport: in-process</span>
                      <span className="text-[var(--text-primary)] font-semibold flex items-center gap-1">
                        View Schema <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Detail Panel: Schema & Guardrails Inspector (7 Cols) */}
        <div className="lg:col-span-7">
          {selectedTool ? (
            <div className="rounded bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-xs space-y-5">
              {/* Tool Header */}
              <div className="pb-3 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono-tnum font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      FastMCP Contract Definition
                    </span>
                    <RiskBadge severity={selectedTool.risk_level} />
                  </div>
                  <h3 className="text-lg font-bold font-mono-tnum text-[var(--text-primary)]">
                    {selectedTool.name}
                  </h3>
                </div>

                <button
                  onClick={() => handleCopy(prettyJson(selectedTool.parameters || {}))}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors self-start font-mono-tnum"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied" : "Copy JSON Schema"}</span>
                </button>
              </div>

              {/* Functional Description */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                  Tool Purpose & Operational Function
                </label>
                <p className="text-xs text-[var(--text-primary)] leading-relaxed p-3 rounded bg-[var(--bg-primary)]/50 border border-[var(--border)]">
                  {selectedTool.description}
                </p>
              </div>

              {/* Security Guardrail Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono-tnum">
                <div className="p-2.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[9px] uppercase font-semibold text-[var(--text-muted)] block">Database SQL</span>
                  <span className="text-xs font-bold text-[var(--risk-low)]">100% Parameterized</span>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[9px] uppercase font-semibold text-[var(--text-muted)] block">Dual Custody</span>
                  <span className={`text-xs font-bold ${selectedTool.risk_level.toUpperCase() === "CRITICAL" ? "text-[var(--danger)]" : "text-[var(--text-secondary)]"}`}>
                    {selectedTool.risk_level.toUpperCase() === "CRITICAL" ? "GATED MANDATORY" : "Standard Policy"}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[9px] uppercase font-semibold text-[var(--text-muted)] block">Audit Logging</span>
                  <span className="text-xs font-bold text-[var(--text-primary)]">Cryptographic Ledger</span>
                </div>
              </div>

              {/* Parameter Contracts & Types */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Pydantic V2 Typed Parameter Contract
                  </label>
                  <span className="text-[10px] font-mono-tnum text-[var(--text-muted)]">
                    Strict Type Coercion Active
                  </span>
                </div>

                <div className="rounded bg-[var(--bg-primary)] border border-[var(--border)] p-3 overflow-x-auto">
                  <pre className="text-[11px] font-mono-tnum text-[var(--text-primary)] leading-relaxed">
                    {prettyJson(selectedTool.parameters || { properties: {}, required: [] })}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded bg-[var(--bg-card)] border border-[var(--border)] p-12 text-center text-xs text-[var(--text-muted)] font-mono-tnum">
              Select a tool on the left to inspect its FastMCP parameter contract and security invariants.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
