"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sliders,
  Shield,
  Search,
  CheckCircle2,
  Copy,
  Terminal,
  Lock,
  ArrowRight,
  Filter,
  Check,
  AlertTriangle,
} from "lucide-react";
import { api, PolicyResponse, PolicyRule } from "@/lib/api";

export default function PoliciesPage() {
  const [policyData, setPolicyData] = useState<PolicyResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    api.policies.list().then(setPolicyData).catch(() => {});
  }, []);

  const defaultRules: PolicyRule[] = [
    {
      rule_id: "RULE-REPO-GUARD",
      name: "Production Repository Destruction Defense",
      description: "Require human dual-custody approval and Admin role for repository deletion",
      action: "REQUIRE_APPROVAL",
      target_decision: "REQUIRE_APPROVAL",
      priority: 100,
      reason: "High-impact destructive resource change",
      conditions: { tool: "github.delete_repository", min_role: "ADMIN" },
    },
    {
      rule_id: "RULE-PR-MERGE",
      name: "GitHub Pull Request Dual Custody",
      description: "Gate pull request merging with cryptographic parameter verification",
      action: "REQUIRE_APPROVAL",
      target_decision: "REQUIRE_APPROVAL",
      priority: 85,
      reason: "Production branch mutation requires review",
      conditions: { tool: "github.merge_pull_request", require_hash: true },
    },
    {
      rule_id: "RULE-DATA-EXFIL",
      name: "PII & Cross-Boundary Exfiltration Quarantine",
      description: "Intercept document exports and sensitive downloads from autonomous agents",
      action: "REQUIRE_APPROVAL",
      target_decision: "REQUIRE_APPROVAL",
      priority: 90,
      reason: "Cross-boundary data transmission detected",
      conditions: { data_boundary: "STRICT_RESTRICTED", dest_ip_check: true },
    },
    {
      rule_id: "RULE-VIEWER-MUTATION",
      name: "Viewer Role Mutation Quarantine",
      description: "Immediately reject any mutating or destructive tool calls issued by Viewer role",
      action: "DENY",
      target_decision: "DENY",
      priority: 95,
      reason: "Unauthorized privilege escalation attempt",
      conditions: { user_role: "VIEWER", mutation_types: ["CREATE", "UPDATE", "DELETE"] },
    },
    {
      rule_id: "RULE-PROMPT-INJ",
      name: "Adversarial Prompt Override Drop",
      description: "Detect system prompt injection attempts and abort agent execution immediately",
      action: "DENY",
      target_decision: "DENY",
      priority: 99,
      reason: "System prompt boundary evasion detected",
      conditions: { intent: "OVERRIDE_RULES", pattern: "system_override" },
    },
  ];

  const rulesToDisplay = policyData?.rules && policyData.rules.length > 0 ? policyData.rules : defaultRules;

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

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 font-sans select-none animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase tracking-widest">
              MISSION CONTROL // INVARIANT POLICY RULES
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-container)] animate-pulse" />
            <span className="font-code-sm text-[10px] text-[var(--primary-container)] font-bold">DETERMINISTIC EVALUATION</span>
          </div>
          <h1 className="font-headline-md text-lg sm:text-xl font-bold tracking-tight text-[var(--primary)]">
            SECURITY POLICY GOVERNANCE ENGINE
          </h1>
          <p className="font-body-sm text-xs text-[var(--text-secondary)] mt-0.5">
            Strict invariant rules evaluated at Stage 4 of the 9-stage Gateway Security Pipeline. Precedence order: DENY &gt; MFA &gt; REQUIRE_APPROVAL &gt; ALLOW.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[var(--surface-container-high)] border border-[var(--border)] font-code-sm text-xs">
            <Sliders className="w-3.5 h-3.5 text-[var(--primary-container)]" />
            <span className="text-[var(--text-primary)] font-semibold">{policyData?.rule_count || rulesToDisplay.length} Active Rules</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[var(--surface-container-high)] border border-[var(--border)] font-code-sm text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-container)]" />
            <span className="text-[var(--primary-container)] font-semibold">MODE: ENFORCING</span>
          </div>
        </div>
      </div>

      {/* Precedence Banner */}
      <div className="p-3 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)]">
        <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase tracking-wider block mb-2">
          EVALUATION PRECEDENCE MATRIX // ZERO-TRUST ARBITRATION
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-code-sm">
          <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--error)]/40 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[var(--error)]">1. DENY</span>
            </div>
            <span className="font-label-caps text-[8px] text-[var(--error)]">ABSOLUTE DROP</span>
          </div>
          <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--tertiary-fixed-dim)]/40 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[var(--tertiary-fixed-dim)]">2. ESCROW</span>
            </div>
            <span className="font-label-caps text-[8px] text-[var(--tertiary-fixed-dim)]">DUAL CUSTODY</span>
          </div>
          <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--secondary-container)]/40 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[var(--secondary-container)]">3. MFA</span>
            </div>
            <span className="font-label-caps text-[8px] text-[var(--secondary)]">STEP-UP AUTH</span>
          </div>
          <div className="p-2 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--primary-container)]/40 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[var(--primary-container)]">4. ALLOW</span>
            </div>
            <span className="font-label-caps text-[8px] text-[var(--primary-container)]">SANDBOX DISPATCH</span>
          </div>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="p-2.5 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search policies by name, ID, or condition..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] font-code-sm text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--secondary-container)]"
          />
        </div>
        <span className="font-code-sm text-[10px] text-[var(--text-muted)]">
          {filtered.length} Rules Enforced
        </span>
      </div>

      {/* Visual Rule Grid: IF-THEN Invariant Blocks */}
      <div className="space-y-3">
        {filtered.map((rule) => {
          const isDeny = rule.action === "DENY" || rule.action === "BLOCK";
          const isEscrow = rule.action === "REQUIRE_APPROVAL" || rule.action === "GATED";
          return (
            <div
              key={rule.rule_id}
              className="p-3 sm:p-4 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] hover:border-[var(--border-interactive)] transition-all shadow-sm space-y-2.5"
            >
              <div className="flex items-start justify-between flex-wrap gap-2 border-b border-[var(--border)] pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isDeny ? "bg-[var(--error)]" : isEscrow ? "bg-[var(--tertiary-fixed-dim)]" : "bg-[var(--primary-container)]"
                    }`}
                  />
                  <h3 className="font-bold text-xs sm:text-sm text-[var(--primary)] font-mono">
                    {rule.name || rule.rule_id}
                  </h3>
                  <button
                    onClick={() => handleCopy(rule.rule_id)}
                    className="font-code-sm text-[10px] text-[var(--secondary-container)] hover:underline flex items-center gap-1 font-mono"
                  >
                    <span>{rule.rule_id}</span>
                    {copiedId === rule.rule_id ? <Check className="w-3 h-3 text-[var(--primary-container)]" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-xs font-label-caps text-[9px] font-bold ${
                      isDeny
                        ? "bg-[var(--error-container)] text-[var(--on-error-container)]"
                        : isEscrow
                        ? "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)]"
                        : "bg-[var(--primary-container)]/20 text-[var(--primary-container)]"
                    }`}
                  >
                    ACTION: {rule.action}
                  </span>
                  <span className="font-code-sm text-[10px] text-[var(--text-muted)] font-mono">
                    Priority: {rule.priority ?? 50}
                  </span>
                </div>
              </div>

              <p className="font-body-sm text-xs text-[var(--text-secondary)] leading-relaxed">
                {rule.description}
              </p>

              {/* IF-THEN Tactical Box */}
              <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] font-code-sm text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[var(--secondary-container)] font-mono">IF:</span>
                  <span className="text-[var(--text-primary)] font-mono">
                    {JSON.stringify(rule.conditions || { tool: "governed", risk: ">= HIGH" })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[var(--primary-container)] font-mono">THEN:</span>
                  <span
                    className={`font-mono font-bold ${
                      isDeny ? "text-[var(--error)]" : isEscrow ? "text-[var(--tertiary-fixed-dim)]" : "text-[var(--primary-container)]"
                    }`}
                  >
                    {isDeny ? "ABORT EXECUTION & QUARANTINE AGENT" : isEscrow ? "HALT FOR HUMAN DUAL-CUSTODY ESCROW" : "ALLOW DISPATCH TO MCP SERVER"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
