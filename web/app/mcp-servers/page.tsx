"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Server,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  ExternalLink,
  Shield,
  Activity,
  Layers,
  ArrowRight,
  Terminal,
} from "lucide-react";
import { MCP_SERVERS, McpServer } from "@/lib/sentinel-data";
import { RiskBadge } from "@/components/ui/Badges";

export default function McpServersPage() {
  const [servers, setServers] = useState<McpServer[]>(MCP_SERVERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTransport, setSelectedTransport] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; latency: number } | null>(null);

  // New server form state
  const [newServerName, setNewServerName] = useState("");
  const [newEndpoint, setNewEndpoint] = useState("");
  const [newTransport, setNewTransport] = useState<"stdio" | "sse" | "stream-http">("stream-http");
  const [newAuth, setNewAuth] = useState<"None (Local stdio)" | "Bearer Token" | "Mutual TLS" | "OAuth 2.0">("Bearer Token");
  const [newEnv, setNewEnv] = useState<"Production" | "Staging" | "Development">("Production");

  const filteredServers = servers.filter((srv) => {
    if (selectedTransport !== "ALL" && srv.transport !== selectedTransport) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        srv.name.toLowerCase().includes(q) ||
        srv.endpoint.toLowerCase().includes(q) ||
        srv.transport.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleTestConnection = (id: string) => {
    setTestingId(id);
    setTestResult(null);
    setTimeout(() => {
      setTestingId(null);
      setTestResult({
        id,
        success: true,
        latency: Math.floor(Math.random() * 25) + 12,
      });
      setTimeout(() => setTestResult(null), 4000);
    }, 700);
  };

  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName || !newEndpoint) return;

    const newSrv: McpServer = {
      id: `srv_${Date.now()}`,
      name: newServerName,
      transport: newTransport,
      status: "ONLINE",
      endpoint: newEndpoint,
      toolsCount: 2,
      authMethod: newAuth,
      lastConnection: "Just now",
      riskProfile: "MEDIUM",
      environment: newEnv,
      latencyMs: 18,
      serverVersion: "1.0.0",
      protocolVersion: "2024-11-05",
    };

    setServers([newSrv, ...servers]);
    setShowAddModal(false);
    setNewServerName("");
    setNewEndpoint("");
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
            <span className="text-[var(--text-secondary)]">SERVER PROTOCOLS</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            MCP Server Registry
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
            All connected Model Context Protocol servers communicating via stdio, server-sent events (SSE), or streamed HTTP.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-95 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add MCP Server</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by server name, endpoint URL, or transport..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)]/50 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] font-mono-tnum"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-mono-tnum">
            {["ALL", "stdio", "sse", "stream-http"].map((trans) => (
              <button
                key={trans}
                onClick={() => setSelectedTransport(trans)}
                className={`px-2.5 py-1 rounded-xs transition-colors ${
                  selectedTransport === trans
                    ? "bg-[var(--accent)] text-white font-bold"
                    : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {trans}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Server Registry Table matching exact prompt columns */}
      <div className="rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-secondary)]/30">
                <th className="py-3 px-4">Server</th>
                <th className="py-3 px-4">Transport</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Tools</th>
                <th className="py-3 px-4">Auth</th>
                <th className="py-3 px-4">Last Connection</th>
                <th className="py-3 px-4">Risk</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-mono-tnum">
              {filteredServers.map((srv) => {
                const isTesting = testingId === srv.id;
                const hasResult = testResult && testResult.id === srv.id;

                return (
                  <tr
                    key={srv.id}
                    className="hover:bg-[var(--bg-secondary)]/40 transition-colors group"
                  >
                    {/* SERVER */}
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-bold text-xs text-[var(--text-primary)] block">
                          {srv.name}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] truncate block max-w-xs">
                          {srv.endpoint}
                        </span>
                      </div>
                    </td>

                    {/* TRANSPORT */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] text-[10px] font-bold text-[var(--text-primary)] uppercase">
                        {srv.transport}
                      </span>
                    </td>

                    {/* STATUS */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-[var(--risk-low-bg)] border border-[var(--risk-low-border)] text-[10px] font-bold text-[var(--risk-low)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--risk-low)] animate-pulse" />
                        {srv.status}
                      </span>
                    </td>

                    {/* TOOLS */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-[var(--text-primary)] text-xs">
                        {srv.toolsCount} registered
                      </span>
                    </td>

                    {/* AUTH */}
                    <td className="py-3 px-4">
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        {srv.authMethod}
                      </span>
                    </td>

                    {/* LAST CONNECTION */}
                    <td className="py-3 px-4 text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                      {srv.lastConnection} ({srv.latencyMs}ms)
                    </td>

                    {/* RISK */}
                    <td className="py-3 px-4">
                      <RiskBadge level={srv.riskProfile} />
                    </td>

                    {/* ACTIONS */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {hasResult && (
                          <span className="text-[10px] text-[var(--risk-low)] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {testResult.latency}ms OK
                          </span>
                        )}

                        <button
                          onClick={() => handleTestConnection(srv.id)}
                          disabled={isTesting}
                          className="px-2 py-1 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-[10px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
                        >
                          {isTesting ? "Pinging..." : "Test Connection"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between text-xs text-[var(--text-muted)] font-mono-tnum">
          <span>{filteredServers.length} Active MCP Server Protocols</span>
          <span>FastMCP Spec 2024-11-05 Enforced</span>
        </div>
      </div>

      {/* "ADD MCP SERVER" MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-xs bg-[var(--bg-card)] border border-[var(--border)] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Register MCP Server
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddServer} className="space-y-3 font-mono-tnum text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
                  Server Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. postgres-prod-mcp"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  className="w-full p-2 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
                  Endpoint / Command
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://mcp.internal/stream or subprocess: python -m ..."
                  value={newEndpoint}
                  onChange={(e) => setNewEndpoint(e.target.value)}
                  className="w-full p-2 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
                    Transport
                  </label>
                  <select
                    value={newTransport}
                    onChange={(e) => setNewTransport(e.target.value as "stdio" | "sse" | "stream-http")}
                    className="w-full p-2 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="stream-http">Streamed HTTP</option>
                    <option value="sse">Server-Sent Events (SSE)</option>
                    <option value="stdio">Standard I/O (stdio)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
                    Environment
                  </label>
                  <select
                    value={newEnv}
                    onChange={(e) => setNewEnv(e.target.value as "Production" | "Staging" | "Development")}
                    className="w-full p-2 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="Production">Production</option>
                    <option value="Staging">Staging</option>
                    <option value="Development">Development</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
                  Authentication Method
                </label>
                <select
                  value={newAuth}
                  onChange={(e) => setNewAuth(e.target.value as "None (Local stdio)" | "Bearer Token" | "Mutual TLS" | "OAuth 2.0")}
                  className="w-full p-2 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-xs text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="Bearer Token">Bearer Token Header</option>
                  <option value="Mutual TLS">Mutual TLS (mTLS)</option>
                  <option value="OAuth 2.0">OAuth 2.0 Client Credentials</option>
                  <option value="None (Local stdio)">None (Local stdio)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-xs font-semibold hover:bg-[var(--border-subtle)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xs bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-95 shadow-2xs"
                >
                  Save & Connect Server
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
