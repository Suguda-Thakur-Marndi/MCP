"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  Sliders,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Ban,
  Clock,
  RefreshCw,
  Search,
  Layers,
  ArrowRight,
  Lock,
} from "lucide-react";
import { api, PolicyResponse, PolicyRule } from "@/lib/api";
import { DecisionBadge } from "@/components/ui/Badges";
import { DataTable, Column } from "@/components/ui/DataTable";
import { LoadingState } from "@/components/ui/FeedbackStates";

const RISK_TIERS = [
  {
    name: "LOW RISK",
    range: "0 – 29",
    color: "border-emerald-500 bg-emerald-950/20 text-emerald-400",
    desc: "Read-only operations on non-sensitive customer or order records. Direct execution permitted with standard telemetry logging.",
    action: "ALLOW",
  },
  {
    name: "MEDIUM RISK",
    range: "30 – 59",
    color: "border-amber-500 bg-amber-950/20 text-amber-400",
    desc: "Standard updates, non-destructive audit log notes, or filtered queries. Executed with active audit recording.",
    action: "ALLOW WITH LOGGING",
  },
  {
    name: "HIGH RISK",
    range: "60 – 79",
    color: "border-orange-500 bg-orange-950/20 text-orange-400",
    desc: "Broad bulk queries, production environment operations, or sensitive parameter alterations. Gated by human approval.",
    action: "REQUIRE APPROVAL",
  },
  {
    name: "CRITICAL RISK",
    range: "80 – 100",
    color: "border-rose-500 bg-rose-950/20 text-rose-400",
    desc: "Destructive deletions, customer purges, or adversarial prompt injections. Hard blocked or dual-custody human sign-off required.",
    action: "BLOCK / GATED",
  },
];

export default function PolicyEnginePage() {
  const [policyData, setPolicyData] = useState<PolicyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [, startTransition] = useTransition();

  const fetchPolicies = () => {
    setLoading(true);
    setError(null);
    api.policies
      .list()
      .then((data) => {
        startTransition(() => {
          setPolicyData(data);
          setLoading(false);
        });
      })
      .catch((err: unknown) => {
        startTransition(() => {
          setError(err instanceof Error ? err.message : "Failed to load policies");
          setLoading(false);
        });
      });
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const rules = policyData?.rules ? [...policyData.rules].sort((a, b) => a.priority - b.priority) : [];

  const filteredRules = rules.filter(
    (r) =>
      r.rule_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.name && r.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      r.action.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: Column<PolicyRule>[] = [
    {
      key: "priority",
      header: "Priority",
      width: "80px",
      align: "center",
      render: (row) => (
        <span className="font-mono text-xs font-bold text-sky-400 px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/60">
          #{row.priority}
        </span>
      ),
    },
    {
      key: "rule_id",
      header: "Rule Identifier",
      width: "200px",
      render: (row) => (
        <div>
          <code className="text-xs font-mono font-bold text-slate-200 block">
            {row.rule_id}
          </code>
          {row.name && <span className="text-[11px] text-slate-400">{row.name}</span>}
        </div>
      ),
    },
    {
      key: "description",
      header: "Condition & Rule Logic",
      render: (row) => (
        <div>
          <span className="text-xs text-slate-200 block">{row.description}</span>
          {row.reason && <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">{row.reason}</span>}
        </div>
      ),
    },
    {
      key: "target_decision",
      header: "Target Decision",
      width: "160px",
      render: (row) => <DecisionBadge decision={row.target_decision || row.action} />,
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#243044]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
            <span>Governance</span>
            <span>/</span>
            <span className="text-sky-400">Deterministic Evaluation Matrix</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
              Policy Engine & Risk Matrix
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-sky-950/50 text-sky-400 border border-sky-800/60">
              {policyData ? `${policyData.policy_id} v${policyData.policy_version}` : "SENTINEL POLICY v1.0.0"}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Deterministic pre-execution policy rules, decision precedence order, and multi-factor risk scoring matrix evaluated on every tool invocation.
          </p>
        </div>

        <button
          onClick={fetchPolicies}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#111827] border border-[#243044] text-xs font-medium text-slate-300 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Reload Rules</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg text-xs border border-rose-900/50 bg-rose-950/30 text-rose-200">
          {error}
        </div>
      )}

      {/* Precedence Hierarchy Flow */}
      <div className="p-5 rounded-lg bg-[#111827] border border-[#243044] space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#243044]">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-500 block">Conflict Resolution</span>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Authoritative Precedence Hierarchy
            </h3>
          </div>
          <span className="text-[10px] font-mono text-sky-400">STRICT OVERRIDE</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {["DENY", "REQUIRE_MFA", "REQUIRE_APPROVAL", "ALLOW"].map((step, idx) => (
            <React.Fragment key={step}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0F172A] border border-[#243044]">
                <span className="font-mono text-xs font-bold text-slate-400">0{idx + 1}.</span>
                <DecisionBadge decision={step} />
              </div>
              {idx < 3 && <ArrowRight className="w-3.5 h-3.5 text-slate-600" />}
            </React.Fragment>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">
          When multiple policy rules evaluate to conflicting outcomes, higher precedence rules strictly supersede lower precedence rules.
        </p>
      </div>

      {/* Risk Scoring Thresholds Banner */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Multi-Factor Risk Scoring Thresholds (0 – 100 Scale)
          </h2>
          <span className="text-[11px] font-mono text-slate-500">FastMCP Dynamic Scoring</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {RISK_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`p-4 rounded-lg bg-[#111827] border border-l-4 ${tier.color} space-y-2`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold">{tier.name}</span>
                <span className="font-mono text-xs text-slate-300 font-semibold">{tier.range}</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">{tier.desc}</p>
              <div className="pt-2 border-t border-[#243044]/60 flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-400">Outcome:</span>
                <span className="font-semibold text-slate-200">{tier.action}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Rules DataTable */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Configured Security Rules ({rules.length})
            </h2>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
              Evaluated In Priority Order
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search policy rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#111827] border border-[#243044] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-sans"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredRules}
          isLoading={loading}
          emptyTitle="No Rules Match Filter"
          emptyMessage="No policy rules match your search query."
        />
      </div>
    </div>
  );
}
