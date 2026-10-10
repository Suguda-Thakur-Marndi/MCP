"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Copy,
  Check,
  Shield,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { api, PolicyRule } from "@/lib/api";
import { LoadingState, EmptyState } from "@/components/ui/FeedbackStates";
import { decisionBadgeClass } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PolicyDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const policyId = resolvedParams.id;

  const [rule, setRule] = useState<PolicyRule | null>(null);
  const [policyMeta, setPolicyMeta] = useState<{ id: string; version: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"visual" | "json">("visual");

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.policies
      .get(policyId)
      .then((data) => {
        if (active) {
          setRule(data.rule);
          setPolicyMeta({
            id: data.policy_id || "sentinel-core-policy",
            version: data.policy_version || "1.0.0",
          });
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg = err instanceof Error ? err.message : `Policy rule "${policyId}" not found.`;
          setError(msg);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [policyId]);

  const handleCopy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-xl max-w-5xl mx-auto">
      {/* Breadcrumb Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-xs font-label-mono text-[11px] text-on-surface-variant mb-space-xxs">
            <Link href="/policies" className="hover:text-on-surface flex items-center gap-0.5">
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>POLICIES</span>
            </Link>
            <span>/</span>
            <span className="font-bold text-primary uppercase">{policyId}</span>
          </div>

          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
            {rule?.name || rule?.rule_id || policyId}
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            {rule?.description || "Invariant boundary rule evaluated on all FastMCP tool dispatches."}
          </p>
        </div>

        {rule && (
          <div className="flex items-center gap-space-xs">
            <span className={`px-space-sm py-1 rounded font-label-mono text-label-mono font-bold ${decisionBadgeClass(rule.target_decision || rule.action)}`}>
              {rule.target_decision || rule.action}
            </span>
            <span className="font-label-mono text-[11px] text-on-surface-variant px-space-xs py-1 rounded bg-surface-container border border-surface-container">
              PRIORITY: {rule.priority}
            </span>
          </div>
        )}
      </section>

      {loading ? (
        <LoadingState message="Loading policy rule definition from invariant engine..." />
      ) : error || !rule ? (
        <EmptyState
          title="Policy Rule Not Found"
          message={error || `Rule ID "${policyId}" does not exist in the active policy catalog.`}
          icon={Shield}
          action={
            <Link
              href="/policies"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container shadow-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Return to Policies</span>
            </Link>
          }
        />
      ) : (
        <div className="space-y-space-lg">
          {/* Rule Metadata Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm font-label-mono text-label-mono">
            <div className="p-space-sm bg-surface-container-lowest rounded-lg border border-surface-container">
              <span className="text-[10px] text-on-surface-variant uppercase">Policy Set</span>
              <div className="font-bold text-on-surface mt-0.5 truncate">{policyMeta?.id}</div>
            </div>
            <div className="p-space-sm bg-surface-container-lowest rounded-lg border border-surface-container">
              <span className="text-[10px] text-on-surface-variant uppercase">Version</span>
              <div className="font-bold text-secondary mt-0.5">v{policyMeta?.version}</div>
            </div>
            <div className="p-space-sm bg-surface-container-lowest rounded-lg border border-surface-container">
              <span className="text-[10px] text-on-surface-variant uppercase">Target Decision</span>
              <div className="font-bold text-primary mt-0.5">{rule.target_decision || rule.action}</div>
            </div>
            <div className="p-space-sm bg-surface-container-lowest rounded-lg border border-surface-container">
              <span className="text-[10px] text-on-surface-variant uppercase">Enforcement Priority</span>
              <div className="font-bold text-on-surface mt-0.5">{rule.priority} / 100</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center justify-between border-b border-surface-container">
            <div className="flex gap-space-sm">
              <button
                onClick={() => setActiveTab("visual")}
                className={`pb-2.5 font-label-ui text-label-ui font-semibold transition-colors cursor-pointer border-b-2 -mb-px ${
                  activeTab === "visual"
                    ? "border-primary text-primary"
                    : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Structured Rule Specification
              </button>
              <button
                onClick={() => setActiveTab("json")}
                className={`pb-2.5 font-label-ui text-label-ui font-semibold transition-colors cursor-pointer border-b-2 -mb-px ${
                  activeTab === "json"
                    ? "border-primary text-primary"
                    : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Cryptographic Rule JSON
              </button>
            </div>

            <button
              onClick={() => handleCopy(JSON.stringify(rule, null, 2))}
              className="flex items-center gap-1 font-label-mono text-[11px] text-on-surface-variant hover:text-on-surface pb-2 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-secondary" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy Payload"}</span>
            </button>
          </div>

          {activeTab === "visual" ? (
            <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container space-y-space-md">
              <div>
                <span className="font-label-mono text-[10px] text-on-surface-variant uppercase font-semibold block mb-1">
                  Enforcement Logic &amp; Precedence Reason
                </span>
                <p className="font-body-sm text-body-sm text-on-surface bg-surface-container-low p-space-md rounded-lg border border-surface-container leading-relaxed">
                  {rule.reason || rule.description}
                </p>
              </div>

              {rule.conditions && Object.keys(rule.conditions).length > 0 && (
                <div>
                  <span className="font-label-mono text-[10px] text-on-surface-variant uppercase font-semibold block mb-1">
                    Evaluation Conditions
                  </span>
                  <div className="bg-surface-container p-space-md rounded-lg font-label-mono text-code-sm text-on-surface border border-surface-container overflow-x-auto">
                    <pre>{JSON.stringify(rule.conditions, null, 2)}</pre>
                  </div>
                </div>
              )}

              <div className="p-space-md rounded-lg bg-surface-container-low border border-surface-container flex items-center justify-between text-body-sm font-label-mono">
                <span className="text-on-surface-variant">Precedence Hierarchy:</span>
                <span className="font-bold text-on-surface">DENY &gt; REQUIRE_MFA &gt; REQUIRE_APPROVAL &gt; ALLOW</span>
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container">
              <pre className="p-space-md bg-surface-container rounded-lg font-label-mono text-code-sm text-on-surface overflow-x-auto border border-surface-container">
                {JSON.stringify(rule, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
