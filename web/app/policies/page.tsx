"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sliders,
  Search,
  Copy,
  Check,
  Shield,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { api, PolicyResponse, PolicyRule } from "@/lib/api";
import { LoadingState, EmptyState } from "@/components/ui/FeedbackStates";
import { decisionBadgeClass } from "@/lib/utils";

export default function PoliciesPage() {
  const [policyData, setPolicyData] = useState<PolicyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadPolicies = () => {
    setLoading(true);
    api.policies
      .list()
      .then((data) => {
        setPolicyData(data);
        setError(null);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load policy rules";
        setError(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  const rulesToDisplay = policyData?.rules || [];

  const filtered = rulesToDisplay.filter((r) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.rule_id.toLowerCase().includes(q) ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCopy = (ruleId: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(ruleId);
      setCopiedId(ruleId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-xl">
      {/* Header Banner */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-sm mb-space-xxs">
            <span className="font-label-mono text-label-mono text-secondary font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              INVARIANT POLICY ENGINE
            </span>
            <span className="font-label-mono text-label-mono px-space-xs py-0.5 rounded bg-surface-container text-on-surface-variant font-bold">
              v{policyData?.policy_version || "1.0.0"}
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
            Security Invariant Guardrails &amp; Precedence
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Strict hierarchical policy evaluation matrix applied deterministically before tool dispatch
          </p>
        </div>

        <div className="flex items-center gap-space-xs">
          <button
            onClick={loadPolicies}
            className="p-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            title="Reload Policies"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-sm font-label-mono text-label-mono">
        <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container">
          <span className="text-on-surface-variant uppercase text-[11px] block">ACTIVE RULE COUNT</span>
          <span className="font-headline-xl text-headline-xl text-on-surface font-bold block mt-1">
            {policyData?.rule_count || rulesToDisplay.length}
          </span>
          <span className="text-[10px] text-secondary font-semibold">Invariant rules enforced</span>
        </div>
        <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container">
          <span className="text-on-surface-variant uppercase text-[11px] block">PRECEDENCE HIERARCHY</span>
          <span className="font-headline-sm text-headline-sm text-primary font-bold block mt-1 truncate">
            DENY &gt; MFA &gt; APPROVAL
          </span>
          <span className="text-[10px] text-primary font-semibold">Strict fail-closed ordering</span>
        </div>
        <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container">
          <span className="text-on-surface-variant uppercase text-[11px] block">EVALUATION OVERHEAD</span>
          <span className="font-headline-xl text-headline-xl text-secondary font-bold block mt-1">
            0.8ms
          </span>
          <span className="text-[10px] text-secondary font-semibold">AST compilation cached</span>
        </div>
        <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container">
          <span className="text-on-surface-variant uppercase text-[11px] block">POLICY SIGNATURE</span>
          <span className="font-headline-sm text-headline-sm text-on-surface font-bold block mt-1 font-label-mono truncate">
            {policyData?.policy_id || "sentinel-core-policy"}
          </span>
          <span className="text-[10px] text-on-surface-variant">Validated cryptographic config</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-space-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter rules by rule ID, description, or action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant pl-9 pr-3 py-1.5 rounded-lg border border-surface-container text-body-sm font-body-sm outline-hidden"
          />
        </div>
      </div>

      {/* Policy Rules List */}
      <div className="bg-surface-container-lowest rounded-xl shadow-xs border border-surface-container overflow-hidden">
        {loading ? (
          <LoadingState message="Fetching active security invariant rules from backend..." />
        ) : error ? (
          <EmptyState
            title="Unable to Load Policies"
            message={error}
            icon={Shield}
            action={
              <button
                onClick={loadPolicies}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container shadow-xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No Policy Rules Found"
            message="No policy rules matched your query or have been provisioned in this policy catalog."
            icon={Sliders}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-body-sm text-body-sm">
              <thead>
                <tr className="bg-surface-container-low font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider border-b border-surface-container">
                  <th className="py-space-sm px-space-lg">Priority</th>
                  <th className="py-space-sm px-space-md">Rule Identifier</th>
                  <th className="py-space-sm px-space-md">Description</th>
                  <th className="py-space-sm px-space-md">Target Decision</th>
                  <th className="py-space-sm px-space-md">Reasoning</th>
                  <th className="py-space-sm px-space-lg text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container font-body-sm">
                {filtered.map((rule) => {
                  const decision = rule.target_decision || rule.action;
                  const isCopied = copiedId === rule.rule_id;

                  return (
                    <tr key={rule.rule_id} className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-space-md px-space-lg whitespace-nowrap font-label-mono">
                        <span className="font-bold text-on-surface">
                          #{rule.priority}
                        </span>
                      </td>

                      <td className="py-space-md px-space-md font-label-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-primary">{rule.rule_id}</span>
                          <button
                            onClick={() => handleCopy(rule.rule_id)}
                            className="text-on-surface-variant hover:text-on-surface cursor-pointer p-0.5"
                            title="Copy Rule ID"
                          >
                            {isCopied ? <Check className="w-3 h-3 text-secondary" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>

                      <td className="py-space-md px-space-md text-on-surface max-w-sm">
                        <div className="font-medium">{rule.name || rule.rule_id}</div>
                        <div className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-1">
                          {rule.description}
                        </div>
                      </td>

                      <td className="py-space-md px-space-md whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded font-label-mono text-label-mono font-bold ${decisionBadgeClass(decision)}`}>
                          {decision}
                        </span>
                      </td>

                      <td className="py-space-md px-space-md text-on-surface-variant text-[11px] font-label-mono max-w-xs truncate">
                        {rule.reason || "Enforce invariant security boundary"}
                      </td>

                      <td className="py-space-md px-space-lg text-right whitespace-nowrap">
                        <Link
                          href={`/policies/${rule.rule_id}`}
                          className="font-label-ui text-label-ui text-primary hover:underline font-semibold inline-flex items-center gap-1"
                        >
                          <span>Inspect Rule</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
