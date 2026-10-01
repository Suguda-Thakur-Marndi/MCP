"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Layers,
  Search,
  ExternalLink,
  Shield,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Server,
  Lock,
  Plus,
  RefreshCw,
  Key,
} from "lucide-react";
import { INTEGRATIONS, Integration } from "@/lib/sentinel-data";
import { RiskBadge } from "@/components/ui/Badges";

export default function IntegrationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRisk, setSelectedRisk] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const categories = useMemo(() => {
    const cats = Array.from(new Set(INTEGRATIONS.map((i) => i.category)));
    return ["ALL", ...cats];
  }, []);

  const filtered = useMemo(() => {
    return INTEGRATIONS.filter((item) => {
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
  }, [searchQuery, selectedRisk, selectedCategory]);

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
            <span className="text-[var(--text-secondary)]">CONNECTED SOFTWARE</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Connected Software Registry
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
            Enterprise applications and custom MCP servers connected through Sentinel. Every tool call and permission boundary is evaluated in real time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/mcp-servers"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-medium border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-2xs"
          >
            <Server className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>MCP Server Protocols</span>
          </Link>
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-95 shadow-2xs"
          >
            <span>All Tools Inventory</span>
            <ArrowRight className="w-3.5 h-3.5" />
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
              placeholder="Search connected software, tools, or permissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)]/50 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] font-mono-tnum"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tnum">
            {/* Category pills */}
            <div className="flex items-center gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-1 rounded-xs transition-colors text-[11px] ${
                    selectedCategory === cat
                      ? "bg-[var(--accent)] text-white font-bold"
                      : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Risk filter */}
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="px-2.5 py-1 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-primary)] focus:outline-none"
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

      {/* Structured Integration Registry Table / Cards */}
      <div className="rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-secondary)]/30">
                <th className="py-3 px-4">Software</th>
                <th className="py-3 px-4">Connection Status</th>
                <th className="py-3 px-4">Authentication</th>
                <th className="py-3 px-4">Available Tools</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4">Risk Level</th>
                <th className="py-3 px-4">Granted Permissions</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-mono-tnum">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-[var(--bg-secondary)]/40 transition-colors group"
                >
                  {/* Logo and Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl flex-shrink-0">{item.logo}</span>
                      <div>
                        <Link
                          href={`/integrations/${item.id}`}
                          className="font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors block"
                        >
                          {item.name}
                        </Link>
                        <span className="text-[10px] text-[var(--text-muted)] block font-sans">
                          {item.category}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-[var(--risk-low-bg)] border border-[var(--risk-low-border)] text-[10px] font-bold text-[var(--risk-low)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--risk-low)] animate-pulse" />
                      {item.status}
                    </span>
                  </td>

                  {/* Auth */}
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-primary)]">
                      {item.authType}
                    </span>
                  </td>

                  {/* Available tools */}
                  <td className="py-3 px-4">
                    <span className="font-bold text-[var(--text-primary)] text-xs">
                      {item.toolsCount} Tools
                    </span>
                  </td>

                  {/* Last activity */}
                  <td className="py-3 px-4 text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                    {item.lastActivity}
                  </td>

                  {/* Risk */}
                  <td className="py-3 px-4">
                    <RiskBadge level={item.riskLevel} />
                  </td>

                  {/* Permissions */}
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {item.permissions.slice(0, 2).map((perm) => (
                        <span
                          key={perm}
                          className="px-1.5 py-0.2 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)] font-mono-tnum"
                        >
                          {perm}
                        </span>
                      ))}
                      {item.permissions.length > 2 && (
                        <span className="text-[10px] text-[var(--text-muted)]">
                          +{item.permissions.length - 2}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Action */}
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/integrations/${item.id}`}
                      className="p-1 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors inline-flex items-center"
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

        <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between text-xs text-[var(--text-muted)] font-mono-tnum">
          <span>{filtered.length} Enterprise Integrations Active</span>
          <span>Zero Unauthenticated Invocations Allowed</span>
        </div>
      </div>
    </div>
  );
}
