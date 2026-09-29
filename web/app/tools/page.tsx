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
} from "lucide-react";
import { api, ToolInfo } from "@/lib/api";
import { prettyJson } from "@/lib/utils";
import { RiskBadge, VerificationBadge } from "@/components/ui/Badges";
import { LoadingState, EmptyState } from "@/components/ui/FeedbackStates";

export default function ToolsRegistryPage() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null);
  const [copied, setCopied] = useState(false);
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

  const filteredTools = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.risk_level.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#243044]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
            <span>Server Architecture</span>
            <span>/</span>
            <span className="text-sky-400">FastMCP In-Process Provider</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
              MCP Tool Registry
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-sky-950/50 text-sky-400 border border-sky-800/60">
              {tools.length} ENTERPRISE TOOLS REGISTERED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Exposed tools hosted on the FastMCP server. Pre-execution hooks validate RBAC permissions, parameter constraints, and dual-custody approval gating before dispatch.
          </p>
        </div>

        <button
          onClick={fetchTools}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#111827] border border-[#243044] text-xs font-medium text-slate-300 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Reload Registry</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg text-xs border border-rose-900/50 bg-rose-950/30 text-rose-200">
          {error}
        </div>
      )}

      {/* Search Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search tools by function, name, or risk level..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-[#111827] border border-[#243044] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-sans"
          />
        </div>

        <span className="text-xs font-mono text-slate-400 hidden sm:inline">
          Showing {filteredTools.length} of {tools.length} tools
        </span>
      </div>

      {/* Grid of Tool Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 rounded-lg bg-[#111827] border border-[#243044] p-5 skeleton" />
          ))}
        </div>
      ) : filteredTools.length === 0 ? (
        <EmptyState
          title="No Tools Match Filter"
          message="No tools found matching your search term."
          icon={Wrench}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTools.map((tool) => (
            <div
              key={tool.name}
              className="p-5 rounded-lg bg-[#111827] border border-[#243044] hover:border-slate-600 transition-all flex flex-col justify-between space-y-4 group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-[#0F172A] border border-[#243044] text-sky-400 group-hover:text-sky-300">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <code className="text-sm font-bold text-white font-mono tracking-wide">
                      {tool.name}
                    </code>
                  </div>
                  <RiskBadge severity={tool.risk_level} />
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {tool.description}
                </p>
              </div>

              <div className="pt-3 border-t border-[#243044] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                <div className="flex flex-wrap items-center gap-1.5">
                  {tool.is_destructive && (
                    <span className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-800/60 font-semibold">
                      DESTRUCTIVE
                    </span>
                  )}
                  {tool.requires_approval ? (
                    <span className="px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/60 font-semibold">
                      HUMAN GATED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/60">
                      DIRECT EXECUTE
                    </span>
                  )}
                  {tool.read_only && (
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      READ ONLY
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setSelectedTool(tool)}
                  className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-sans text-xs font-semibold"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tool Inspection Modal */}
      {selectedTool && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedTool(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-[#0F172A] border border-[#243044] shadow-2xl overflow-hidden p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#243044]">
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-500 block">FastMCP Tool Definition</span>
                <h3 className="text-sm font-bold text-white font-mono">{selectedTool.name}</h3>
              </div>
              <button onClick={() => setSelectedTool(null)} className="p-1 rounded text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">{selectedTool.description}</p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded bg-[#111827] border border-[#243044]">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Base Risk Level</span>
                <RiskBadge severity={selectedTool.risk_level} />
              </div>
              <div className="p-2.5 rounded bg-[#111827] border border-[#243044]">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Governance Gate</span>
                <span className="font-mono text-amber-400 font-semibold">
                  {selectedTool.requires_approval ? "Human Approval Required" : "Automated Permitted"}
                </span>
              </div>
              <div className="p-2.5 rounded bg-[#111827] border border-[#243044]">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Operation Type</span>
                <span className="font-mono text-slate-200 uppercase">{selectedTool.is_destructive ? "Mutation (Purge)" : selectedTool.read_only ? "Projection (Read)" : "State Transition"}</span>
              </div>
              <div className="p-2.5 rounded bg-[#111827] border border-[#243044]">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Parameter Binding</span>
                <span className="font-mono text-emerald-400 font-semibold">SHA-256 Validated</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">Sample Parameter Payload Schema:</span>
                <button
                  onClick={() => handleCopy(prettyJson({ tool: selectedTool.name, parameters: { id: "CUST-0001" } }))}
                  className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-mono"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy Schema"}</span>
                </button>
              </div>
              <pre className="p-3 rounded bg-[#0B0F14] border border-[#243044] text-[11px] font-mono text-sky-300">
                {prettyJson({
                  tool: selectedTool.name,
                  target_resource: "customer_db",
                  requires_mfa: selectedTool.is_destructive,
                  requires_approval: selectedTool.requires_approval,
                })}
              </pre>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedTool(null)}
                className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition-colors"
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
