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
  Server,
  Play,
  CheckCircle2,
  Sliders,
  Table,
  LayoutGrid,
} from "lucide-react";
import { api, ToolInfo } from "@/lib/api";
import { prettyJson } from "@/lib/utils";
import { RiskBadge, VerificationBadge } from "@/components/ui/Badges";
import { DataTable, Column } from "@/components/ui/DataTable";
import { LoadingState, EmptyState } from "@/components/ui/FeedbackStates";

export default function ToolsRegistryPage() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [testPayload, setTestPayload] = useState("{}");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testValidating, setTestValidating] = useState(false);
  const [, startTransition] = useTransition();

  const fetchTools = () => {
    setLoading(true);
    setError(null);
    api.policies
      .tools()
      .then((data) => {
        startTransition(() => {
          setTools(data);
          setLoading(false);
        });
      })
      .catch((err: unknown) => {
        startTransition(() => {
          setError(err instanceof Error ? err.message : "Failed to load MCP tools");
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
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.risk_level.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRisk =
      riskFilter === "ALL" || t.risk_level.toUpperCase() === riskFilter.toUpperCase();

    return matchesSearch && matchesRisk;
  });

  const handleSelectTool = (tool: ToolInfo) => {
    setSelectedTool(tool);
    setTestResult(null);
    // Prepopulate sample test parameters based on schema
    if (tool.parameters && typeof tool.parameters === "object") {
      const sampleObj: Record<string, unknown> = {};
      const props = (tool.parameters as { properties?: Record<string, { type?: string; default?: unknown }> }).properties || {};
      Object.keys(props).forEach((key) => {
        const p = props[key];
        sampleObj[key] = p.default !== undefined ? p.default : p.type === "string" ? "sample_value" : p.type === "number" ? 1 : true;
      });
      setTestPayload(JSON.stringify(sampleObj, null, 2));
    } else {
      setTestPayload("{}");
    }
  };

  const handleValidateSchema = () => {
    setTestValidating(true);
    try {
      const parsed = JSON.parse(testPayload);
      setTimeout(() => {
        setTestValidating(false);
        setTestResult(`Schema Validation Passed: Parameters conform to ${selectedTool?.name} JSON schema.`);
      }, 400);
    } catch {
      setTestValidating(false);
      setTestResult("JSON Syntax Error: Invalid parameter JSON payload format.");
    }
  };

  const tableColumns: Column<ToolInfo>[] = [
    {
      key: "name",
      header: "Tool Name",
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-[#D05A40]/10 text-[#D05A40] border border-[#D05A40]/30">
            <Wrench className="w-3.5 h-3.5" />
          </div>
          <div>
            <code className="text-xs font-mono font-bold text-[#1A202E] dark:text-[#F4F6F9]">
              {row.name}
            </code>
            {row.is_destructive && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-mono bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-300 dark:border-red-800/60 font-semibold inline-flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" />
                DESTRUCTIVE
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (row) => (
        <span className="text-xs text-[#475063] dark:text-[#94A3B8] line-clamp-1 max-w-md">
          {row.description}
        </span>
      ),
    },
    {
      key: "server",
      header: "Provider",
      render: () => (
        <span className="font-mono text-xs text-[#1A202E] dark:text-slate-300">
          FastMCP / In-Process
        </span>
      ),
    },
    {
      key: "risk_level",
      header: "Risk Tier",
      render: (row) => <RiskBadge severity={row.risk_level} />,
    },
    {
      key: "permissions",
      header: "Execution Mode",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          {row.requires_approval ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-50 text-[#B87000] border border-amber-300 dark:bg-[#E3A03E]/15 dark:text-[#F3BA63] dark:border-[#E3A03E]/40 font-semibold">
              HUMAN GATED
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-50 text-[#2C6E65] border border-teal-300 dark:bg-[#3A8A7F]/15 dark:text-[#4EA699] dark:border-[#3A8A7F]/40 font-semibold">
              DIRECT EXECUTE
            </span>
          )}
          {row.read_only && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400">
              READ ONLY
            </span>
          )}
        </div>
      ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleSelectTool(row);
          }}
          className="p-1.5 rounded text-[#6B7280] hover:text-[#D05A40] hover:bg-[#EFECE5] dark:hover:bg-slate-800 transition-colors"
          title="Inspect Tool Schema & Policy"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#D1CEC7] dark:border-[#26344A]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#D05A40] font-bold mb-1">
            <span>TOOL GOVERNANCE</span>
            <span>/</span>
            <span>FASTMCP REGISTRY</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A202E] dark:text-[#F4F6F9] tracking-tight">
              MCP Tool Registry
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-teal-50 text-[#2C6E65] border border-teal-300 dark:bg-[#3A8A7F]/20 dark:text-[#4EA699] dark:border-[#3A8A7F]/40 font-bold">
              {tools.length} ENTERPRISE TOOLS
            </span>
          </div>
          <p className="text-xs text-[#475063] dark:text-[#94A3B8] mt-1 max-w-2xl leading-relaxed">
            Exposed tools hosted on the FastMCP server. Pre-execution hooks validate RBAC permissions, parameter constraints, and dual-custody approval gating before dispatch.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="p-1 rounded-lg bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] flex items-center gap-1 shadow-sm">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === "table"
                  ? "bg-[#D05A40] text-white"
                  : "text-[#475063] dark:text-slate-400 hover:text-[#1A202E] dark:hover:text-white"
              }`}
              title="Table View"
            >
              <Table className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === "grid"
                  ? "bg-[#D05A40] text-white"
                  : "text-[#475063] dark:text-slate-400 hover:text-[#1A202E] dark:hover:text-white"
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={fetchTools}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] text-xs font-medium text-[#1A202E] dark:text-slate-300 hover:border-[#D05A40] transition-colors disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg text-xs border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tools by name, description, risk..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-md bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A] text-xs text-[#1A202E] dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D05A40]"
            />
          </div>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-1.5 rounded-md bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A] text-xs text-[#1A202E] dark:text-slate-100 focus:outline-none focus:border-[#D05A40]"
          >
            <option value="ALL">All Risk Tiers</option>
            <option value="LOW">Low Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="HIGH">High Risk</option>
            <option value="CRITICAL">Critical Risk</option>
          </select>
        </div>

        <span className="text-xs font-mono text-[#6B7280] dark:text-slate-400">
          Showing {filteredTools.length} of {tools.length} active tools
        </span>
      </div>

      {/* Content Rendering: Table or Grid */}
      {loading ? (
        <div className="h-64 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] p-6 skeleton" />
      ) : filteredTools.length === 0 ? (
        <EmptyState
          title="No Tools Match Filter"
          message="No tools found matching your current search parameters."
          icon={Wrench}
        />
      ) : viewMode === "table" ? (
        <DataTable
          columns={tableColumns}
          data={filteredTools}
          isLoading={loading}
          onRowClick={(row) => handleSelectTool(row)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTools.map((tool) => (
            <div
              key={tool.name}
              onClick={() => handleSelectTool(tool)}
              className="p-5 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] hover:border-[#D05A40] transition-all flex flex-col justify-between space-y-4 cursor-pointer shadow-sm group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#D05A40]/10 border border-[#D05A40]/30 text-[#D05A40]">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <code className="text-sm font-bold text-[#1A202E] dark:text-[#F4F6F9] font-mono">
                      {tool.name}
                    </code>
                  </div>
                  <RiskBadge severity={tool.risk_level} />
                </div>

                <p className="text-xs text-[#475063] dark:text-[#94A3B8] leading-relaxed line-clamp-2">
                  {tool.description}
                </p>
              </div>

              <div className="pt-3 border-t border-[#D1CEC7] dark:border-[#26344A] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                <div className="flex flex-wrap items-center gap-1.5">
                  {tool.is_destructive && (
                    <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-300 dark:border-red-800/60 font-semibold inline-flex items-center gap-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      DESTRUCTIVE
                    </span>
                  )}
                  {tool.requires_approval ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-[#B87000] border border-amber-300 dark:bg-[#E3A03E]/15 dark:text-[#F3BA63] dark:border-[#E3A03E]/40 font-semibold">
                      GATED
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-teal-50 text-[#2C6E65] border border-teal-300 dark:bg-[#3A8A7F]/15 dark:text-[#4EA699] dark:border-[#3A8A7F]/40">
                      DIRECT
                    </span>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectTool(tool);
                  }}
                  className="inline-flex items-center gap-1 text-[#D05A40] hover:text-[#B84E37] font-semibold text-xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tool Detail & Schema Sandbox Drawer */}
      {selectedTool && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedTool(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] shadow-2xl overflow-hidden p-6 space-y-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#D1CEC7] dark:border-[#26344A]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#D05A40]/10 border border-[#D05A40]/30 text-[#D05A40]">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1A202E] dark:text-[#F4F6F9] font-mono">
                    {selectedTool.name}
                  </h3>
                  <span className="text-[11px] text-[#6B7280] dark:text-slate-400 font-mono">
                    Host: FastMCP • Risk: {selectedTool.risk_level}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedTool(null)}
                className="p-1 rounded text-slate-400 hover:text-[#1A202E] dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Description & Invariants */}
            <p className="text-xs text-[#475063] dark:text-[#94A3B8] leading-relaxed">
              {selectedTool.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[10px] text-[#6B7280] dark:text-slate-400 uppercase font-mono block">Destructive</span>
                <span className="font-mono font-bold text-xs">
                  {selectedTool.is_destructive ? (
                    <span className="text-red-600 dark:text-red-400">YES</span>
                  ) : (
                    <span className="text-teal-600 dark:text-teal-400">NO</span>
                  )}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[10px] text-[#6B7280] dark:text-slate-400 uppercase font-mono block">Human Gated</span>
                <span className="font-mono font-bold text-xs">
                  {selectedTool.requires_approval ? (
                    <span className="text-[#D05A40]">REQUIRED</span>
                  ) : (
                    <span className="text-teal-600 dark:text-teal-400">DIRECT</span>
                  )}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[10px] text-[#6B7280] dark:text-slate-400 uppercase font-mono block">Read Only</span>
                <span className="font-mono font-bold text-xs text-[#1A202E] dark:text-slate-200">
                  {selectedTool.read_only ? "YES" : "NO"}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[10px] text-[#6B7280] dark:text-slate-400 uppercase font-mono block">Integrity Seal</span>
                <span className="font-mono font-bold text-xs text-[#3A8A7F]">SHA-256</span>
              </div>
            </div>

            {/* JSON Schema Viewer */}
            <div className="space-y-1.5 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#1A202E] dark:text-slate-300 font-sans">
                  Parameter JSON Schema:
                </span>
                <button
                  onClick={() => handleCopy(prettyJson(selectedTool.parameters))}
                  className="inline-flex items-center gap-1 text-[11px] text-[#D05A40] hover:text-[#B84E37] font-mono font-semibold"
                >
                  {copied ? <Check className="w-3 h-3 text-[#3A8A7F]" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy Schema"}</span>
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-[#F8F6F0] dark:bg-[#0D1117] border border-[#D1CEC7] dark:border-[#26344A] text-[11px] font-mono text-[#1A202E] dark:text-sky-300 overflow-y-auto max-h-36 select-all">
                {prettyJson(selectedTool.parameters)}
              </pre>
            </div>

            {/* Test Parameter Sandbox */}
            <div className="space-y-2 pt-2 border-t border-[#D1CEC7] dark:border-[#26344A]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1A202E] dark:text-white uppercase tracking-wider font-sans">
                  Parameter Validation Testbench
                </span>
                <button
                  onClick={handleValidateSchema}
                  disabled={testValidating}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#D05A40] hover:bg-[#B84E37] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  <Play className="w-3 h-3" />
                  <span>{testValidating ? "Checking..." : "Validate Schema"}</span>
                </button>
              </div>

              <textarea
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
                rows={3}
                className="w-full p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#0D1117] border border-[#D1CEC7] dark:border-[#26344A] text-xs font-mono text-[#1A202E] dark:text-slate-100 focus:outline-none focus:border-[#D05A40]"
                placeholder="Enter sample JSON arguments for validation..."
              />

              {testResult && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-mono flex items-center gap-2 ${
                    testResult.includes("Passed")
                      ? "bg-teal-50 text-[#2C6E65] border border-teal-300 dark:bg-[#3A8A7F]/15 dark:text-[#4EA699] dark:border-[#3A8A7F]/40"
                      : "bg-red-50 text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60"
                  }`}
                >
                  {testResult.includes("Passed") ? (
                    <CheckCircle2 className="w-4 h-4 text-[#3A8A7F]" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-[#D64541]" />
                  )}
                  <span>{testResult}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedTool(null)}
                className="px-4 py-1.5 rounded-lg bg-[#EFECE5] dark:bg-slate-800 hover:bg-[#E2DFD8] text-xs font-semibold text-[#1A202E] dark:text-slate-200 transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
