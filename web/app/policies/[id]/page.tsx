"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import {
  Sliders,
  ChevronLeft,
  Shield,
  FileCode,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Layers,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { POLICIES, PolicyDefinition } from "@/lib/sentinel-data";
import { RiskBadge } from "@/components/ui/Badges";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PolicyDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const policyId = resolvedParams.id;

  const policy: PolicyDefinition =
    POLICIES.find((p) => p.id === policyId) || POLICIES[0];

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"visual" | "yaml">("visual");

  const handleCopy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="pb-5 border-b border-[var(--border)] flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] mb-1">
            <Link href="/policies" className="hover:text-[var(--text-primary)] flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" />
              <span>POLICIES</span>
            </Link>
            <span>/</span>
            <span className="font-bold text-[var(--text-primary)] uppercase">{policy.id}</span>
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {policy.name}
            </h1>
            <span className="px-2 py-0.5 rounded-xs bg-[var(--risk-low-bg)] border border-[var(--risk-low-border)] font-mono-tnum text-[10px] font-bold text-[var(--risk-low)]">
              {policy.status}
            </span>
            <span className="font-mono-tnum text-[11px] text-[var(--text-muted)]">
              v{policy.version}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
            {policy.description}
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono-tnum text-xs">
          <Link
            href="/policies"
            className="px-3 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-2xs"
          >
            All Policies
          </Link>
        </div>
      </div>

      {/* Metadata Deck */}
      <div className="p-4 sm:p-5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono-tnum">
          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Scope</span>
            <span className="font-bold text-[var(--text-primary)] block truncate">{policy.scope}</span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Rules Enforced</span>
            <span className="font-bold text-[var(--accent)] block">{policy.ruleCount} Active Rules</span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Risk Threshold</span>
            <span className="font-bold text-[var(--risk-critical)] block">{policy.riskThreshold} / 100</span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Last Updated</span>
            <span className="text-[var(--text-primary)] block">{policy.lastUpdated}</span>
          </div>
        </div>
      </div>

      {/* Visual Logic vs YAML Representation Tabs */}
      <div className="p-4 sm:p-5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Policy Decision Logic Engine
          </h2>

          <div className="inline-flex rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] p-0.5 text-xs font-mono-tnum">
            <button
              onClick={() => setActiveTab("visual")}
              className={`px-3 py-1 rounded-xs transition-colors ${
                activeTab === "visual"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] font-bold shadow-2xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Visual Logic
            </button>
            <button
              onClick={() => setActiveTab("yaml")}
              className={`px-3 py-1 rounded-xs transition-colors ${
                activeTab === "yaml"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] font-bold shadow-2xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Technical YAML
            </button>
          </div>
        </div>

        {activeTab === "visual" ? (
          <div className="space-y-4">
            <p className="text-xs text-[var(--text-secondary)]">
              This policy executes deterministically during the Policy Evaluation stage before any tool call reaches an external application.
            </p>

            {/* HUMAN-READABLE VISUAL LOGIC BLOCKS */}
            <div className="space-y-2 font-mono-tnum text-xs">
              {/* IF Condition 1 */}
              <div className="p-3.5 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] space-y-1">
                <span className="px-2 py-0.5 rounded-xs bg-[var(--accent)] text-white text-[10px] font-bold">
                  IF
                </span>
                <div className="pt-2 text-xs">
                  <span className="text-[var(--text-muted)]">tool.is_destructive </span>
                  <span className="font-bold text-[var(--accent)]">EQUALS </span>
                  <span className="text-[var(--risk-critical)] font-bold">true</span>
                </div>
              </div>

              {/* AND Condition 2 */}
              <div className="p-3.5 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] space-y-1">
                <span className="px-2 py-0.5 rounded-xs bg-[var(--border)] text-[var(--text-primary)] text-[10px] font-bold">
                  AND
                </span>
                <div className="pt-2 text-xs">
                  <span className="text-[var(--text-muted)]">environment </span>
                  <span className="font-bold text-[var(--accent)]">EQUALS </span>
                  <span className="text-[var(--risk-critical)] font-bold">&quot;production&quot;</span>
                </div>
              </div>

              {/* THEN Output 1 */}
              <div className="p-3.5 rounded-xs bg-[var(--risk-critical-bg)]/40 border border-[var(--risk-critical-border)] space-y-1">
                <span className="px-2 py-0.5 rounded-xs bg-[var(--risk-critical)] text-white text-[10px] font-bold">
                  THEN
                </span>
                <div className="pt-2 text-xs">
                  <span className="text-[var(--text-muted)]">risk_assessment </span>
                  <span className="font-bold text-[var(--accent)]">= </span>
                  <span className="text-[var(--risk-critical)] font-bold">CRITICAL (Risk Score &ge; 80)</span>
                </div>
              </div>

              {/* AND Output 2 */}
              <div className="p-3.5 rounded-xs bg-[var(--risk-high-bg)]/40 border border-[var(--risk-high-border)] space-y-1">
                <span className="px-2 py-0.5 rounded-xs bg-[var(--risk-high)] text-white text-[10px] font-bold">
                  AND
                </span>
                <div className="pt-2 text-xs">
                  <span className="text-[var(--text-muted)]">human_approval </span>
                  <span className="font-bold text-[var(--accent)]">= </span>
                  <span className="text-[var(--risk-high)] font-bold">REQUIRED (Dual-Custody Sign-Off)</span>
                </div>
              </div>

              {/* AND Output 3 */}
              <div className="p-3.5 rounded-xs bg-[var(--risk-critical-bg)]/40 border border-[var(--risk-critical-border)] space-y-1">
                <span className="px-2 py-0.5 rounded-xs bg-[var(--risk-critical)] text-white text-[10px] font-bold">
                  AND
                </span>
                <div className="pt-2 text-xs">
                  <span className="text-[var(--text-muted)]">execution_gate </span>
                  <span className="font-bold text-[var(--accent)]">= </span>
                  <span className="text-[var(--risk-critical)] font-bold">BLOCKED_UNTIL_APPROVED</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-mono-tnum text-[var(--text-muted)] uppercase font-bold">
                Deterministic Policy Manifest (YAML)
              </span>
              <button
                onClick={() => handleCopy(policy.rawYaml)}
                className="inline-flex items-center gap-1 text-[11px] font-mono-tnum text-[var(--accent)] hover:underline"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[var(--risk-low)]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy YAML"}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] font-mono-tnum text-xs text-[var(--text-primary)] overflow-x-auto leading-relaxed">
              {policy.rawYaml}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
