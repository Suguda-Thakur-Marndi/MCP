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
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 font-sans select-none animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase tracking-widest">
              GATEWAY INFRASTRUCTURE // PROTOCOL BUS
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-container)] animate-pulse" />
            <span className="font-code-sm text-[10px] text-[var(--primary-container)] font-bold">
              {servers.length} ACTIVE RPC SERVERS
            </span>
          </div>
          <h1 className="font-headline-md text-lg sm:text-xl font-bold tracking-tight text-[var(--primary)]">
            MCP SERVER REGISTRY & PROTOCOL ROUTER
          </h1>
          <p className="font-body-sm text-xs text-[var(--text-secondary)] mt-0.5">
            Model Context Protocol endpoints communicating across isolated stdio, SSE eventstreams, or secure HTTP transports with mutual TLS.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-[var(--primary-container)] text-[var(--surface-container-lowest)] font-code-sm text-xs font-bold hover:brightness-110 active:scale-98 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>REGISTER MCP SERVER</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-2.5 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex-1 relative max-w-md">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by server name, endpoint URI, or transport protocol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] font-code-sm text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--secondary-container)]"
            />
          </div>

          <div className="flex items-center gap-1.5 font-code-sm text-xs">
            {["ALL", "stdio", "sse", "stream-http"].map((trans) => (
              <button
                key={trans}
                onClick={() => setSelectedTransport(trans)}
                className={`px-2 py-0.5 rounded-xs border transition-all cursor-pointer ${
                  selectedTransport === trans
                    ? "bg-[var(--secondary-container)]/20 text-[var(--secondary-container)] border-[var(--secondary-container)] font-bold"
                    : "bg-[var(--surface-container-lowest)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-primary)]"
                }`}
              >
                {trans.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Server Registry Table */}
      <div className="rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="bg-[var(--surface-container-lowest)] border-b border-[var(--border)] font-label-caps text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
                <th className="px-3 py-2">SERVER NAME & ENDPOINT</th>
                <th className="px-3 py-2">TRANSPORT</th>
                <th className="px-3 py-2">LINK STATUS</th>
                <th className="px-3 py-2">CAPABILITIES</th>
                <th className="px-3 py-2">AUTHENTICATION</th>
                <th className="px-3 py-2">TELEMETRY</th>
                <th className="px-3 py-2">RISK</th>
                <th className="px-3 py-2 text-right">DIAGNOSTICS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-code-sm">
              {filteredServers.map((srv) => {
                const isTesting = testingId === srv.id;
                const hasResult = testResult && testResult.id === srv.id;

                return (
                  <tr
                    key={srv.id}
                    className="hover:bg-[var(--surface-container-high)]/50 transition-colors"
                  >
                    {/* SERVER */}
                    <td className="px-3 py-2">
                      <div>
                        <span className="font-bold text-xs text-[var(--primary)] block font-mono">
                          {srv.name}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] truncate block max-w-xs font-mono">
                          {srv.endpoint}
                        </span>
                      </div>
                    </td>

                    {/* TRANSPORT */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-[9px] font-bold text-[var(--secondary-container)] uppercase font-mono">
                        {srv.transport}
                      </span>
                    </td>

                    {/* STATUS */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-xs bg-[var(--primary-container)]/20 border border-[var(--primary-container)]/30 text-[9px] font-bold text-[var(--primary-container)] font-label-caps">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-container)] animate-pulse" />
                        {srv.status}
                      </span>
                    </td>

                    {/* TOOLS */}
                    <td className="px-3 py-2 whitespace-nowrap font-mono">
                      <span className="font-bold text-[var(--text-primary)] text-xs">
                        {srv.toolsCount} Tools
                      </span>
                    </td>

                    {/* AUTH */}
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px] text-[var(--text-secondary)]">
                      {srv.authMethod}
                    </td>

                    {/* TELEMETRY */}
                    <td className="px-3 py-2 text-[10px] text-[var(--text-muted)] whitespace-nowrap font-mono">
                      {srv.lastConnection} ({srv.latencyMs}ms)
                    </td>

                    {/* RISK */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded-xs font-label-caps text-[9px] font-bold ${
                          srv.riskProfile === "CRITICAL"
                            ? "bg-[var(--error-container)] text-[var(--on-error-container)] border border-[var(--error)]/40"
                            : srv.riskProfile === "HIGH"
                            ? "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] border border-[var(--tertiary-fixed-dim)]/40"
                            : "bg-[var(--secondary-container)]/20 text-[var(--secondary-container)] border border-[var(--secondary-container)]/30"
                        }`}
                      >
                        {srv.riskProfile}
                      </span>
                    </td>

                    {/* ACTIONS */}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {hasResult && (
                          <span className="text-[10px] text-[var(--primary-container)] font-bold flex items-center gap-1 font-mono">
                            <CheckCircle2 className="w-3 h-3" />
                            {testResult.latency}ms OK
                          </span>
                        )}

                        <button
                          onClick={() => handleTestConnection(srv.id)}
                          disabled={isTesting}
                          className="px-2 py-0.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-high)] text-[10px] font-mono font-semibold text-[var(--text-primary)] hover:border-[var(--secondary-container)] hover:text-[var(--secondary-container)] transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isTesting ? "Pinging..." : "TEST ECHO"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD SERVER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs">
          <div className="bg-[var(--surface-container-low)] border border-[var(--border-interactive)] rounded-xs max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-3 font-sans">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[var(--secondary-container)]" />
                <h3 className="font-headline-sm text-xs sm:text-sm font-bold text-[var(--primary)] font-mono">
                  REGISTER MODEL CONTEXT PROTOCOL SERVER
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddServer} className="space-y-3 font-code-sm text-xs">
              <div>
                <label className="font-label-caps text-[8px] uppercase text-[var(--text-muted)] block mb-1">
                  SERVER IDENTIFIER
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GitHub Enterprise MCP Gateway"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--secondary-container)] font-mono"
                />
              </div>

              <div>
                <label className="font-label-caps text-[8px] uppercase text-[var(--text-muted)] block mb-1">
                  ENDPOINT URI OR STDIO COMMAND
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. https://mcp.internal.corp/sse or npx -y @modelcontextprotocol/server"
                  value={newEndpoint}
                  onChange={(e) => setNewEndpoint(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--secondary-container)] font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-label-caps text-[8px] uppercase text-[var(--text-muted)] block mb-1">
                    TRANSPORT
                  </label>
                  <select
                    value={newTransport}
                    onChange={(e) => setNewTransport(e.target.value as any)}
                    className="w-full px-2 py-1.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-hidden"
                  >
                    <option value="stream-http">stream-http</option>
                    <option value="sse">sse</option>
                    <option value="stdio">stdio</option>
                  </select>
                </div>

                <div>
                  <label className="font-label-caps text-[8px] uppercase text-[var(--text-muted)] block mb-1">
                    AUTHENTICATION
                  </label>
                  <select
                    value={newAuth}
                    onChange={(e) => setNewAuth(e.target.value as any)}
                    className="w-full px-2 py-1.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-hidden"
                  >
                    <option value="Bearer Token">Bearer Token</option>
                    <option value="Mutual TLS">Mutual TLS</option>
                    <option value="OAuth 2.0">OAuth 2.0</option>
                    <option value="None (Local stdio)">None (Local stdio)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1 rounded-xs bg-[var(--surface-container-high)] border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded-xs bg-[var(--primary-container)] text-[var(--surface-container-lowest)] font-bold text-xs hover:brightness-110"
                >
                  REGISTER SERVER
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
