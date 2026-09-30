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
  CheckCircle2,
} from "lucide-react";
import { api, PolicyResponse, PolicyRule } from "@/lib/api";
import { DecisionBadge } from "@/components/ui/Badges";
import { DataTable, Column } from "@/components/ui/DataTable";
import { LoadingState } from "@/components/ui/FeedbackStates";

const PRECEDENCE_ORDER = [
  { level: "01", name: "DENY", desc: "Absolute override on threat detection", color: "text-[var(--danger)]" },
  { level: "02", name: "REQUIRE_MFA", desc: "Secondary identity challenge", color: "text-[var(--warning)]" },
  { level: "03", name: "REQUIRE_APPROVAL", desc: "Dual-custody human sign-off", color: "text-[var(--accent)]" },
  { level: "04", name: "ALLOW", desc: "Permitted operation dispatch", color: "text-[var(--success)]" },
];

const RISK_TIERS = [
  {
    tier: "LOW",
    range: "0 – 29",
    desc: "Read-only queries on non-sensitive customer or order records.",
    action: "ALLOW",
    variant: "low",
  },
  {
    tier: "MEDIUM",
    range: "30 – 59",
    desc: "Controlled updates, non-destructive audit log notes, or bounded queries.",
    action: "ALLOW WITH LOG",
    variant: "medium",
  },
  {
    tier: "HIGH",
    range: "60 – 79",
    desc: "Broad bulk queries, sensitive parameter alterations, or elevated scope.",
    action: "REQUIRE APPROVAL",
    variant: "high",
  },
  {
    tier: "CRITICAL",
    range: "80 – 100",
    desc: "Destructive deletions, customer purges, or adversarial prompt injections.",
    action: "BLOCK / GATED",
    variant: "critical",
  },
];

const INITIAL_POLICIES: PolicyResponse = {
  status: "success",
  policy_id: "sentinel-core-policy",
  policy_version: "1.0.0",
  precedence: ["DENY", "REQUIRE_MFA", "REQUIRE_APPROVAL", "ALLOW"],
  rule_count: 10,
  rules: [
    {
      rule_id: "RULE-006",
      name: "fail_closed_missing_context",
      description: "Fails closed when security context is incomplete, missing, or malformed.",
      priority: 1100,
      action: "DENY",
      target_decision: "DENY",
      reason: "Security context is missing or invalid. Failing closed.",
    },
    {
      rule_id: "RULE-003",
      name: "deny_unauthorized_operation",
      description: "Denies operations where the actor lacks authorization.",
      priority: 1000,
      action: "DENY",
      target_decision: "DENY",
      reason: "Actor is not authorized for this operation.",
    },
    {
      rule_id: "RULE-004",
      name: "deny_unauthorized_restricted_resource",
      description: "Denies access to RESTRICTED resources when actor lacks specific credentials.",
      priority: 950,
      action: "DENY",
      target_decision: "DENY",
      reason: "Actor lacks authorized credentials for RESTRICTED data.",
    },
    {
      rule_id: "RULE-007",
      name: "fail_closed_unknown_high_risk_tool",
      description: "Denies unknown tools that are marked destructive or have high risk.",
      priority: 900,
      action: "DENY",
      target_decision: "DENY",
      reason: "Unknown tool cannot be executed safely. Fails closed.",
    },
    {
      rule_id: "RULE-005",
      name: "bulk_critical_operation_requires_approval",
      description: "Requires human approval when operation scope exceeds critical bulk threshold.",
      priority: 850,
      action: "REQUIRE_APPROVAL",
      target_decision: "REQUIRE_APPROVAL",
      reason: "Operation affects critical bulk record volume; requires human approval.",
    },
    {
      rule_id: "RULE-001",
      name: "destructive_requires_approval",
      description: "High-risk destructive operations strictly require verified server-side approval.",
      priority: 800,
      action: "REQUIRE_APPROVAL",
      target_decision: "REQUIRE_APPROVAL",
      reason: "Access Denied: Destructive operations require verified human-in-the-loop approval.",
    },
    {
      rule_id: "RULE-002",
      name: "production_critical_requires_approval",
      description: "Critical-risk operations in production require approval gating.",
      priority: 750,
      action: "REQUIRE_APPROVAL",
      target_decision: "REQUIRE_APPROVAL",
      reason: "Production operation classified as CRITICAL risk requires approval.",
    },
    {
      rule_id: "RULE-010",
      name: "allow_verified_approved_destructive",
      description: "Allows destructive operation when server has verified an authentic approval ticket.",
      priority: 300,
      action: "ALLOW",
      target_decision: "ALLOW",
      reason: "Destructive operation verified with authentic server approval ticket.",
    },
    {
      rule_id: "RULE-008",
      name: "allow_safe_low_risk_read",
      description: "Allows read-only queries with low risk scores.",
      priority: 200,
      action: "ALLOW",
      target_decision: "ALLOW",
      reason: "Read-only operation with LOW risk is permitted.",
    },
    {
      rule_id: "RULE-009",
      name: "allow_controlled_write_dev",
      description: "Allows non-destructive mutations with low/medium risk in non-production.",
      priority: 100,
      action: "ALLOW",
      target_decision: "ALLOW",
      reason: "Controlled non-destructive update permitted in current environment.",
    },
  ],
};

export default function PolicyEnginePage() {
  const [policyData, setPolicyData] = useState<PolicyResponse>(INITIAL_POLICIES);
  const [loading, setLoading] = useState(false);
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

  const rules = policyData?.rules ? [...policyData.rules].sort((a, b) => b.priority - a.priority) : [];

  const filteredRules = rules.filter(
    (r) =>
      r.rule_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.name && r.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.reason && r.reason.toLowerCase().includes(searchQuery.toLowerCase())) ||
      ((r.target_decision || r.action || "").toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const columns: Column<PolicyRule>[] = [
    {
      key: "priority",
      header: "Priority",
      width: "80px",
      align: "center",
      render: (row) => (
        <span className="font-mono-tnum text-xs font-bold text-[var(--text-primary)] px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
          #{row.priority}
        </span>
      ),
    },
    {
      key: "rule_id",
      header: "Rule Identifier",
      width: "220px",
      render: (row) => (
        <div>
          <code className="text-xs font-mono-tnum font-bold text-[var(--text-primary)] block">
            {row.rule_id}
          </code>
          {row.name && (
            <span className="text-[10px] text-[var(--text-muted)] font-mono-tnum">
              {row.name}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "description",
      header: "Condition & Enforcement Logic",
      render: (row) => (
        <div className="space-y-1">
          <span className="text-xs font-semibold text-[var(--text-primary)] block leading-snug">
            {row.description}
          </span>
          {row.reason && (
            <p className="text-[11px] text-[var(--text-muted)] leading-tight">
              <span className="font-medium text-[var(--text-secondary)]">Rationale:</span> {row.reason}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "action",
      header: "Target Decision",
      width: "180px",
      render: (row) => <DecisionBadge decision={row.target_decision || row.action || "ALLOW"} />,
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono-tnum font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Governance & Invariants
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
            <span className="text-[10px] font-mono-tnum text-[var(--success)] font-semibold">DETERMINISTIC MATRIX</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Policy Engine & Risk Governance
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Deterministic pre-execution policy rules, precedence hierarchy, and multi-factor risk scoring evaluated independently of LLM reasoning.
          </p>
        </div>

        <button
          onClick={fetchPolicies}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Reload Rules</span>
        </button>
      </div>

      {/* Precedence Hierarchy Bar */}
      <div className="p-4 rounded bg-[var(--bg-card)] border border-[var(--border)] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Authoritative Precedence Hierarchy (Strict Override)
          </span>
          <span className="text-[10px] font-mono-tnum text-[var(--text-muted)]">
            Higher precedence strictly supersedes lower
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 font-mono-tnum">
          {PRECEDENCE_ORDER.map((item, idx) => (
            <div
              key={item.level}
              className="p-2.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">{item.level}.</span>
                <div>
                  <span className={`text-xs font-bold ${item.color} block`}>{item.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)] block line-clamp-1">{item.desc}</span>
                </div>
              </div>
              {idx < PRECEDENCE_ORDER.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] hidden lg:block flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Multi-Factor Risk Scoring Thresholds */}
      <div className="rounded bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Multi-Factor Risk Scoring Matrix (0 – 100 Scale)
          </span>
          <span className="text-[10px] font-mono-tnum text-[var(--text-muted)]">
            FastMCP Dynamic Evaluation
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono-tnum">
          {RISK_TIERS.map((tier) => {
            const isCritical = tier.variant === "critical";
            const isHigh = tier.variant === "high";
            const isMedium = tier.variant === "medium";

            return (
              <div
                key={tier.tier}
                className={`p-3 rounded border border-[var(--border)] bg-[var(--bg-secondary)]/50 border-l-2 ${
                  isCritical
                    ? "border-l-[var(--danger)]"
                    : isHigh
                    ? "border-l-[var(--risk-high)]"
                    : isMedium
                    ? "border-l-[var(--warning)]"
                    : "border-l-[var(--success)]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[var(--text-primary)]">{tier.tier} RISK</span>
                  <span className="text-[11px] text-[var(--text-muted)] font-semibold">{tier.range}</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-2 font-sans">
                  {tier.desc}
                </p>
                <div className="pt-1.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px]">
                  <span className="text-[var(--text-muted)]">Decision:</span>
                  <span className={`font-bold ${isCritical ? "text-[var(--danger)]" : isHigh ? "text-[var(--risk-high)]" : isMedium ? "text-[var(--warning)]" : "text-[var(--success)]"}`}>
                    {tier.action}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Configured Policy Rules Table */}
      <div className="rounded bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--border)]">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Active Security Rules ({rules.length})
            </h3>
            <span className="text-[10px] font-mono-tnum text-[var(--text-muted)]">
              Evaluated in ascending priority order (#100 to #900)
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search policy rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {loading && filteredRules.length === 0 ? (
          <LoadingState message="Loading policy rules from backend..." />
        ) : (
          <DataTable
            data={filteredRules}
            columns={columns}
            keyExtractor={(row) => row.rule_id}
            pageSize={10}
            emptyMessage="No policy rules match your search."
          />
        )}
      </div>
    </div>
  );
}
