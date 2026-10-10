"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  ArrowRight,
  Server,
} from "lucide-react";
import { INTEGRATIONS, Integration } from "@/lib/sentinel-data";
import { api } from "@/lib/api";

export default function IntegrationsPage() {
  const [items, setItems] = useState<Integration[]>(INTEGRATIONS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRisk, setSelectedRisk] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  useEffect(() => {
    api.integrations
      .list()
      .then((liveList) => {
        if (Array.isArray(liveList) && liveList.length > 0) {
          setItems((prev) =>
            prev.map((staticItem) => {
              const live = liveList.find((l) => l.id === staticItem.id);
              if (live) {
                return {
                  ...staticItem,
                  status: ((live.live_status || live.status) === "CONNECTED" ? "CONNECTED" : (live.live_status || live.status) === "DISCONNECTED" ? "DISCONNECTED" : (live.live_status || live.status) === "ERROR" ? "ERROR" : "WARNING") as Integration["status"],
                  toolsCount: live.tools_count ?? staticItem.toolsCount,
                };
              }
              return staticItem;
            })
          );
        }
      })
      .catch(() => {});
  }, []);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map((i) => i.category)));
    return ["ALL", ...cats];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (selectedRisk !== "ALL" && item.riskLevel !== selectedRisk) return false;
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.tools.some((t) => t.name.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [items, searchQuery, selectedRisk, selectedCategory]);

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 font-sans select-none animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase tracking-widest">
              MISSION CONTROL // INTEGRATION BOUNDARIES
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-container)] animate-pulse" />
            <span className="font-code-sm text-[10px] text-[var(--primary-container)] font-bold">
              {items.length} MONITORED PLATFORMS
            </span>
          </div>
          <h1 className="font-headline-md text-lg sm:text-xl font-bold tracking-tight text-[var(--primary)]">
            CONNECTED SOFTWARE & BOUNDARY REGISTRY
          </h1>
          <p className="font-body-sm text-xs text-[var(--text-secondary)] mt-0.5">
            Enterprise integrations and custom MCP servers connected through Sentinel. Every tool call and permission boundary is evaluated in real time.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs self-start sm:self-auto">
          <Link
            href="/mcp-servers"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-[var(--surface-container-high)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--secondary-container)] transition-all font-code-sm text-xs"
          >
            <Server className="w-3.5 h-3.5 text-[var(--secondary-container)]" />
            <span>MCP SERVERS</span>
          </Link>
          <Link
            href="/tools"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-[var(--primary-container)] text-[var(--surface-container-lowest)] font-bold font-code-sm text-xs hover:brightness-110 transition-all"
          >
            <span>ALL TOOLS INVENTORY</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-2.5 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex-1 relative max-w-md">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search connected software, tools, or permissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] font-code-sm text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--secondary-container)]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 font-code-sm text-xs">
            {/* Category pills */}
            <div className="flex items-center gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded-xs border transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-[var(--secondary-container)]/20 text-[var(--secondary-container)] border-[var(--secondary-container)] font-bold"
                      : "bg-[var(--surface-container-lowest)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {cat.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Risk filter */}
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="px-2 py-1 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-hidden"
            >
              <option value="ALL">All Risk Tiers</option>
              <option value="LOW">Low Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="HIGH">High Risk</option>
              <option value="CRITICAL">Critical Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Integration Registry Table */}
      <div className="rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="bg-[var(--surface-container-lowest)] border-b border-[var(--border)] font-label-caps text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
                <th className="px-3 py-2">SOFTWARE / PLATFORM</th>
                <th className="px-3 py-2">LINK STATUS</th>
                <th className="px-3 py-2">AUTHENTICATION VAULT</th>
                <th className="px-3 py-2">CAPABILITIES</th>
                <th className="px-3 py-2">LAST TELEMETRY</th>
                <th className="px-3 py-2">THREAT PROFILE</th>
                <th className="px-3 py-2">SCOPES & PERMISSIONS</th>
                <th className="px-3 py-2 text-right">INSPECT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-code-sm">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-[var(--surface-container-high)]/50 transition-colors cursor-pointer"
                >
                  {/* Logo and Name */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.logo}</span>
                      <div>
                        <Link
                          href={`/integrations/${item.id}`}
                          className="font-bold text-xs text-[var(--primary)] hover:text-[var(--secondary-container)] transition-colors block font-mono"
                        >
                          {item.name}
                        </Link>
                        <span className="font-label-caps text-[8px] text-[var(--text-muted)] block uppercase">
                          {item.category}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-xs text-[9px] font-bold font-label-caps ${
                        item.status === "CONNECTED"
                          ? "bg-[var(--primary-container)]/20 border border-[var(--primary-container)]/30 text-[var(--primary-container)]"
                          : "bg-[var(--error-container)] border border-[var(--error)]/40 text-[var(--on-error-container)]"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.status === "CONNECTED" ? "bg-[var(--primary-container)] animate-pulse" : "bg-[var(--error)]"
                        }`}
                      />
                      {item.status}
                    </span>
                  </td>

                  {/* Auth */}
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px] text-[var(--text-primary)]">
                    {item.authType}
                  </td>

                  {/* Available tools */}
                  <td className="px-3 py-2 whitespace-nowrap font-mono">
                    <span className="font-bold text-[var(--secondary-container)] text-xs">
                      {item.toolsCount} Tools
                    </span>
                  </td>

                  {/* Last activity */}
                  <td className="px-3 py-2 text-[10px] text-[var(--text-muted)] whitespace-nowrap font-mono">
                    {item.lastActivity}
                  </td>

                  {/* Risk */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`px-1.5 py-0.5 rounded-xs font-label-caps text-[9px] font-bold ${
                        item.riskLevel === "CRITICAL"
                          ? "bg-[var(--error-container)] text-[var(--on-error-container)] border border-[var(--error)]/40"
                          : item.riskLevel === "HIGH"
                          ? "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] border border-[var(--tertiary-fixed-dim)]/40"
                          : "bg-[var(--primary-container)]/20 text-[var(--primary-container)] border border-[var(--primary-container)]/30"
                      }`}
                    >
                      {item.riskLevel}
                    </span>
                  </td>

                  {/* Permissions */}
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1 max-w-xs font-mono text-[10px]">
                      {item.permissions.slice(0, 2).map((perm) => (
                        <span
                          key={perm}
                          className="px-1 py-0.2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-[9px] text-[var(--text-secondary)]"
                        >
                          {perm}
                        </span>
                      ))}
                      {item.permissions.length > 2 && (
                        <span className="text-[9px] text-[var(--text-muted)]">
                          +{item.permissions.length - 2}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Action */}
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Link
                      href={`/integrations/${item.id}`}
                      className="p-1 rounded-xs border border-[var(--border)] bg-[var(--surface-container-high)] text-[var(--text-primary)] hover:border-[var(--secondary-container)] hover:text-[var(--secondary-container)] transition-colors inline-flex items-center"
                      title={`Inspect ${item.name} tools and security policy`}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-2.5 border-t border-[var(--border)] bg-[var(--surface-container-lowest)] flex items-center justify-between text-xs text-[var(--text-muted)] font-code-sm">
          <span>{filtered.length} Enterprise Integrations Active</span>
          <span className="text-[var(--primary-container)] font-bold">Encrypted Fernet Credential Vault Sealed</span>
        </div>
      </div>
    </div>
  );
}
