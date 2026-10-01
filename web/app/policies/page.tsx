"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sliders,
  Shield,
  Plus,
  Search,
  CheckCircle2,
  Copy,
  Edit,
  Power,
  ChevronRight,
  ArrowRight,
  Lock,
} from "lucide-react";
import { POLICIES, PolicyDefinition } from "@/lib/sentinel-data";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<PolicyDefinition[]>(POLICIES);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = policies.filter((p) => {
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.scope.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleClone = (policy: PolicyDefinition) => {
    const cloned: PolicyDefinition = {
      ...policy,
      id: `${policy.id}_clone_${Date.now().toString().slice(-4)}`,
      name: `${policy.name} (Copy)`,
      status: "DRAFT",
      version: "0.1.0",
      lastUpdated: "Just now",
    };
    setPolicies([cloned, ...policies]);
  };

  const handleToggleStatus = (id: string) => {
    setPolicies((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const nextStatus = p.status === "DISABLED" ? "ENFORCING" : "DISABLED";
        return { ...p, status: nextStatus };
      })
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="pb-5 border-b border-[var(--border)] flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] mb-1">
            <span className="font-bold text-[var(--text-primary)]">MCP SENTINEL</span>
            <span>/</span>
            <span className="text-[var(--accent)] font-semibold">SECURITY</span>
            <span>/</span>
            <span className="text-[var(--text-secondary)]">POLICY ENGINE</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Security Policy Governance
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
            Deterministic rules and precedence matrices evaluated against every AI agent tool execution candidate.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/policies/pol_prod_data"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-95 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Policy</span>
          </Link>
        </div>
      </div>

      {/* Precedence Banner */}
      <div className="p-4 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-2">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
          <span className="text-[10px] font-mono-tnum uppercase font-bold text-[var(--text-muted)] tracking-wider">
            Deterministic Invariant Precedence Order
          </span>
          <span className="text-[10px] font-mono-tnum text-[var(--accent)] font-bold">
            DENY &gt; MFA &gt; APPROVAL &gt; ALLOW
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Rule conflicts are resolved deterministically: an explicit DENY always overrules an ALLOW. Approvals are strictly enforced before any destructive tool dispatch.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search policies by name, scope, or rule keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)]/50 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] font-mono-tnum"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-mono-tnum">
            {["ALL", "ENFORCING", "ACTIVE", "DISABLED"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 rounded-xs transition-colors ${
                  statusFilter === status
                    ? "bg-[var(--accent)] text-white font-bold"
                    : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Policies Table matching Section 15 specifications */}
      <div className="rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-secondary)]/30">
                <th className="py-3 px-4">Policy Name</th>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Scope</th>
                <th className="py-3 px-4">Rules</th>
                <th className="py-3 px-4">Risk Threshold</th>
                <th className="py-3 px-4">Last Updated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-mono-tnum">
              {filtered.map((policy) => (
                <tr
                  key={policy.id}
                  className="hover:bg-[var(--bg-secondary)]/40 transition-colors group"
                >
                  {/* POLICY NAME */}
                  <td className="py-3 px-4">
                    <Link
                      href={`/policies/${policy.id}`}
                      className="font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors block font-sans"
                    >
                      {policy.name}
                    </Link>
                    <span className="text-[10px] text-[var(--text-muted)] block truncate max-w-xs">
                      {policy.description}
                    </span>
                  </td>

                  {/* VERSION */}
                  <td className="py-3 px-4 text-[11px] text-[var(--text-secondary)]">
                    v{policy.version}
                  </td>

                  {/* STATUS */}
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-xs text-[10px] font-bold ${
                        policy.status === "ENFORCING"
                          ? "bg-[var(--risk-low-bg)] text-[var(--risk-low)] border border-[var(--risk-low-border)]"
                          : policy.status === "ACTIVE"
                          ? "bg-[var(--risk-low-bg)] text-[var(--risk-low)] border border-[var(--risk-low-border)]"
                          : "bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)]"
                      }`}
                    >
                      {policy.status}
                    </span>
                  </td>

                  {/* SCOPE */}
                  <td className="py-3 px-4 text-[11px] text-[var(--text-primary)] font-sans">
                    {policy.scope}
                  </td>

                  {/* RULES */}
                  <td className="py-3 px-4 font-bold text-xs text-[var(--text-primary)]">
                    {policy.ruleCount} rules
                  </td>

                  {/* RISK THRESHOLD */}
                  <td className="py-3 px-4 font-bold text-[var(--risk-critical)]">
                    &ge; {policy.riskThreshold}
                  </td>

                  {/* LAST UPDATED */}
                  <td className="py-3 px-4 text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                    {policy.lastUpdated}
                  </td>

                  {/* ACTIONS */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/policies/${policy.id}`}
                        className="p-1 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                        title="Edit policy visual logic and rules"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        onClick={() => handleClone(policy)}
                        className="p-1 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                        title="Clone policy"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleToggleStatus(policy.id)}
                        className={`p-1 rounded-xs border transition-colors ${
                          policy.status === "DISABLED"
                            ? "border-[var(--risk-low-border)] bg-[var(--risk-low-bg)] text-[var(--risk-low)]"
                            : "border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--danger)]"
                        }`}
                        title={policy.status === "DISABLED" ? "Enable policy" : "Disable policy"}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between text-xs text-[var(--text-muted)] font-mono-tnum">
          <span>{filtered.length} Authoritative Policies Enforcing</span>
          <span>Dual-Custody Gating Enabled</span>
        </div>
      </div>
    </div>
  );
}
