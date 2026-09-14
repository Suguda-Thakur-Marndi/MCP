"use client";

import { useEffect, useState } from "react";
import { api, ToolInfo } from "@/lib/api";
import { riskBadgeClass } from "@/lib/utils";

export default function ToolsRegistryPage() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    api.policies.tools()
      .then((data) => setTools(data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load MCP tools"))
      .finally(() => setLoading(false));
  }, []);

  const filteredTools = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">MCP Tool Registry</h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-sky-950 text-sky-400 border border-sky-800">
              8 ACTIVE ENTERPRISE TOOLS
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Registered tools on the FastMCP server. Pre-execution hooks validate permissions and risk boundaries before invocation.
          </p>
        </div>

        {/* Search input */}
        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="Search tools by name or purpose..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg text-white font-sans focus:outline-none focus:border-sky-500"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(239, 68, 68, 0.12)", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="glass-card p-5 h-44 skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTools.map((tool) => (
            <div key={tool.name} className="glass-card p-5 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white tracking-wide">
                      {tool.name}
                    </span>
                  </div>
                  <span className={riskBadgeClass(tool.risk_level)}>
                    {tool.risk_level} RISK
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {tool.description}
                </p>
              </div>

              <div className="pt-3 border-t flex flex-wrap items-center gap-2 text-[11px]" style={{ borderColor: "var(--border)" }}>
                {tool.read_only && (
                  <span className="px-2 py-0.5 rounded font-mono" style={{ background: "rgba(34, 197, 94, 0.1)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
                    READ ONLY
                  </span>
                )}
                {tool.is_destructive && (
                  <span className="px-2 py-0.5 rounded font-mono" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                    DESTRUCTIVE
                  </span>
                )}
                {tool.requires_approval ? (
                  <span className="px-2 py-0.5 rounded font-mono" style={{ background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                    APPROVAL GATED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded font-mono text-slate-400" style={{ background: "var(--bg-secondary)" }}>
                    DIRECT EXECUTION
                  </span>
                )}
                <span className="ml-auto font-mono text-[10px] text-slate-500">
                  FastMCP Protocol
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
