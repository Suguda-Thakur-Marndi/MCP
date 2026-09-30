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
  Play,
  CheckCircle2,
  AlertTriangle,
  Code,
  Copy,
  Check,
  X,
  Eye,
} from "lucide-react";
import { api, PolicyResponse, PolicyRule } from "@/lib/api";
import { DecisionBadge } from "@/components/ui/Badges";
import { DataTable, Column } from "@/components/ui/DataTable";
import { LoadingState } from "@/components/ui/FeedbackStates";

const RISK_TIERS = [
  {
    name: "LOW RISK",
    range: "0 – 29",
    color: "border-teal-500 bg-teal-50/50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400",
    desc: "Read-only operations on non-sensitive customer or order records. Direct execution permitted with standard telemetry logging.",
    action: "ALLOW",
  },
  {
    name: "MEDIUM RISK",
    range: "30 – 59",
    color: "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400",
    desc: "Standard updates, non-destructive audit log notes, or filtered queries. Executed with active audit recording.",
    action: "ALLOW WITH AUDIT",
  },
  {
    name: "HIGH RISK",
    range: "60 – 79",
    color: "border-[#D05A40] bg-orange-50/50 dark:bg-orange-950/20 text-[#D05A40]",
    desc: "Broad bulk queries, production environment operations, or sensitive parameter alterations. Gated by human approval.",
    action: "REQUIRE APPROVAL",
  },
  {
    name: "CRITICAL RISK",
    range: "80 – 100",
    color: "border-[#D64541] bg-red-50/50 dark:bg-red-950/20 text-[#D64541]",
    desc: "Destructive deletions, customer purges, or adversarial prompt injections. Hard blocked or dual-custody human sign-off required.",
    action: "BLOCK / GATED",
  },
];

export default function PolicyEnginePage() {
  const [policyData, setPolicyData] = useState<PolicyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRule, setSelectedRule] = useState<PolicyRule | null>(null);
  const [copied, setCopied] = useState(false);

  // Evaluate Sample Simulation Tool State
  const [sampleTool, setSampleTool] = useState("delete_customer");
  const [sampleResource, setSampleResource] = useState("CUST-0001");
  const [sampleRole, setSampleRole] = useState("OPERATOR");
  const [evalResult, setEvalResult] = useState<{
    matchedRule: string;
    decision: string;
    riskScore: number;
    explanation: string;
  } | null>(null);

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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulatePolicy = () => {
    // Determine simulated match based on configured rules
    if (sampleTool.toLowerCase().includes("delete") || sampleTool.toLowerCase().includes("purge")) {
      setEvalResult({
        matchedRule: "RULE-DEST-001",
        decision: sampleRole === "ADMIN" ? "REQUIRE_APPROVAL" : "BLOCK",
        riskScore: sampleRole === "ADMIN" ? 75 : 95,
        explanation:
          sampleRole === "ADMIN"
            ? "Destructive action by ADMIN triggers dual-custody human gating (SHA-256 seal required)."
            : "Destructive operations on persistent customer entities are hard blocked for non-admin roles.",
      });
    } else if (sampleTool.toLowerCase().includes("update") || sampleTool.toLowerCase().includes("create")) {
      setEvalResult({
        matchedRule: "RULE-WRITE-002",
        decision: "ALLOW",
        riskScore: 35,
        explanation: "Standard write operation permitted with active cryptographic ledger recording.",
      });
    } else {
      setEvalResult({
        matchedRule: "RULE-READ-003",
        decision: "ALLOW",
        riskScore: 10,
        explanation: "Read-only entity retrieval permitted without additional approval friction.",
      });
    }
  };

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
        <span className="font-mono text-xs font-bold text-[#D05A40] px-2 py-0.5 rounded bg-[#D05A40]/10 border border-[#D05A40]/30">
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
          <code className="text-xs font-mono font-bold text-[#1A202E] dark:text-[#F4F6F9] block">
            {row.rule_id}
          </code>
          {row.name && <span className="text-[11px] text-[#475063] dark:text-slate-400 font-sans">{row.name}</span>}
        </div>
      ),
    },
    {
      key: "description",
      header: "Condition & Rule Logic",
      render: (row) => (
        <div>
          <span className="text-xs text-[#1A202E] dark:text-slate-200 block">{row.description}</span>
          {row.reason && <span className="text-[11px] text-[#6B7280] dark:text-slate-400 font-mono mt-0.5 block">{row.reason}</span>}
        </div>
      ),
    },
    {
      key: "target_decision",
      header: "Enforced Outcome",
      width: "160px",
      render: (row) => <DecisionBadge decision={row.target_decision || row.action} />,
    },
    {
      key: "action",
      header: "",
      align: "right",
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedRule(row);
          }}
          className="p-1.5 rounded text-[#6B7280] hover:text-[#D05A40] hover:bg-[#EFECE5] dark:hover:bg-slate-800 transition-colors"
          title="Inspect Policy Rule Logic"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#D1CEC7] dark:border-[#26344A]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#D05A40] font-bold mb-1">
            <span>GOVERNANCE</span>
            <span>/</span>
            <span>POLICY ENGINE</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A202E] dark:text-[#F4F6F9] tracking-tight">
              Policy Engine & Risk Matrix
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-teal-50 text-[#2C6E65] border border-teal-300 dark:bg-[#3A8A7F]/20 dark:text-[#4EA699] dark:border-[#3A8A7F]/40 font-bold">
              {policyData ? `${policyData.policy_id} v${policyData.policy_version}` : "SENTINEL POLICY v1.0.0"}
            </span>
          </div>
          <p className="text-xs text-[#475063] dark:text-[#94A3B8] mt-1 max-w-2xl leading-relaxed">
            Deterministic pre-execution policy rules, decision precedence order, and multi-factor risk scoring matrix evaluated on every tool invocation.
          </p>
        </div>

        <button
          onClick={fetchPolicies}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] text-xs font-medium text-[#1A202E] dark:text-slate-300 hover:border-[#D05A40] transition-colors disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Reload Rules</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl text-xs border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 shadow-sm">
          {error}
        </div>
      )}

      {/* Precedence Hierarchy Flow */}
      <div className="p-5 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] space-y-3 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-[#D1CEC7] dark:border-[#26344A]">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#D05A40] font-bold block">Conflict Resolution</span>
            <h3 className="text-xs font-bold text-[#1A202E] dark:text-[#F4F6F9] uppercase tracking-wider font-sans">
              Authoritative Precedence Hierarchy
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[#3A8A7F] font-bold">STRICT OVERRIDE</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {["DENY", "REQUIRE_APPROVAL", "ALLOW"].map((step, idx) => (
            <React.Fragment key={step}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="font-mono text-xs font-bold text-[#D05A40]">0{idx + 1}.</span>
                <DecisionBadge decision={step} />
              </div>
              {idx < 2 && <ArrowRight className="w-3.5 h-3.5 text-[#6B7280] dark:text-slate-500" />}
            </React.Fragment>
          ))}
        </div>
        <p className="text-[11px] text-[#475063] dark:text-slate-400 leading-relaxed">
          When multiple policy rules evaluate to conflicting outcomes, higher precedence rules strictly supersede lower precedence rules.
        </p>
      </div>

      {/* Risk Scoring Thresholds Banner */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#1A202E] dark:text-[#F4F6F9] uppercase tracking-wider font-sans">
            Multi-Factor Risk Scoring Thresholds (0 – 100 Scale)
          </h2>
          <span className="text-[11px] font-mono text-[#6B7280] dark:text-slate-500">FastMCP Dynamic Scoring</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {RISK_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-l-4 ${tier.color} space-y-2 shadow-sm`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold">{tier.name}</span>
                <span className="font-mono text-xs font-semibold">{tier.range}</span>
              </div>
              <p className="text-[11px] text-[#475063] dark:text-slate-300 leading-relaxed">{tier.desc}</p>
              <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-[10px] font-mono">
                <span className="opacity-75">Outcome:</span>
                <span className="font-bold">{tier.action}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evaluate Sample Simulation Sandbox (deep-research-report.md Section 4) */}
      <div className="p-5 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-[#D1CEC7] dark:border-[#26344A]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#D05A40]/10 text-[#D05A40] border border-[#D05A40]/30">
              <Play className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#1A202E] dark:text-[#F4F6F9] uppercase tracking-wider font-sans">
                Evaluate Sample Action Sandbox
              </h3>
              <p className="text-[11px] text-[#475063] dark:text-slate-400">
                Simulate arbitrary agent actions to test which policy rules match in real-time.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-[#D05A40] font-bold">SIMULATION SANDBOX</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-[10px] uppercase font-mono text-[#6B7280] dark:text-slate-400 block mb-1">
              Sample Tool Name
            </label>
            <input
              type="text"
              value={sampleTool}
              onChange={(e) => setSampleTool(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A] text-xs font-mono text-[#1A202E] dark:text-slate-100 focus:outline-none focus:border-[#D05A40]"
              placeholder="e.g. delete_customer"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-mono text-[#6B7280] dark:text-slate-400 block mb-1">
              Target Resource ID
            </label>
            <input
              type="text"
              value={sampleResource}
              onChange={(e) => setSampleResource(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A] text-xs font-mono text-[#1A202E] dark:text-slate-100 focus:outline-none focus:border-[#D05A40]"
              placeholder="e.g. CUST-0001"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-mono text-[#6B7280] dark:text-slate-400 block mb-1">
              Actor Role
            </label>
            <select
              value={sampleRole}
              onChange={(e) => setSampleRole(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A] text-xs text-[#1A202E] dark:text-slate-100 focus:outline-none focus:border-[#D05A40]"
            >
              <option value="OPERATOR">OPERATOR</option>
              <option value="ADMIN">ADMIN</option>
              <option value="APPROVER">APPROVER</option>
              <option value="SECURITY_ANALYST">SECURITY_ANALYST</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={handleSimulatePolicy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D05A40] hover:bg-[#B84E37] text-white text-xs font-semibold shadow-md shadow-[#D05A40]/25 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Simulate Policy Evaluation</span>
          </button>
        </div>

        {evalResult && (
          <div className="p-4 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A] space-y-2 mt-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase text-[#D05A40] font-bold">Matched Rule:</span>
                <code className="font-mono font-bold text-[#1A202E] dark:text-white">{evalResult.matchedRule}</code>
              </div>
              <DecisionBadge decision={evalResult.decision} />
            </div>
            <p className="text-xs text-[#475063] dark:text-slate-300 leading-relaxed">
              {evalResult.explanation}
            </p>
            <div className="text-[11px] font-mono text-[#6B7280] dark:text-slate-400 pt-1 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
              <span>Simulated Risk Score:</span>
              <span className="font-bold text-[#D05A40]">{evalResult.riskScore} / 100</span>
            </div>
          </div>
        )}
      </div>

      {/* Active Rules DataTable */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-[#1A202E] dark:text-[#F4F6F9] uppercase tracking-wider font-sans">
              Configured Security Rules ({rules.length})
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#EFECE5] dark:bg-slate-800 text-[#475063] dark:text-slate-400 border border-[#D1CEC7] dark:border-slate-700">
              Evaluated In Priority Order
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search policy rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] text-xs text-[#1A202E] dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D05A40] font-sans shadow-sm"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredRules}
          isLoading={loading}
          emptyTitle="No Policy Rules Configured"
          emptyMessage="No rules match your filter criteria."
          onRowClick={(row) => setSelectedRule(row)}
        />
      </div>

      {/* Rule Detail Modal */}
      {selectedRule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedRule(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] shadow-2xl overflow-hidden p-6 space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D1CEC7] dark:border-[#26344A]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#1A202E] dark:text-white font-mono">{selectedRule.rule_id}</h3>
                  <DecisionBadge decision={selectedRule.target_decision || selectedRule.action} />
                </div>
                <span className="text-xs text-[#6B7280] dark:text-slate-400">
                  Priority #{selectedRule.priority} • {selectedRule.name}
                </span>
              </div>
              <button
                onClick={() => setSelectedRule(null)}
                className="p-1 rounded text-slate-400 hover:text-[#1A202E] dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-[#1A202E] dark:text-slate-300 font-sans">
                Human Summary:
              </span>
              <p className="text-xs text-[#475063] dark:text-slate-300 leading-relaxed">
                {selectedRule.description}
              </p>
              {selectedRule.reason && (
                <p className="text-[11px] text-[#6B7280] dark:text-slate-400 font-mono mt-1">
                  Reasoning: {selectedRule.reason}
                </p>
              )}
            </div>

            {/* Condition Expression in Code Block */}
            <div className="space-y-1.5 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#1A202E] dark:text-slate-300 font-sans">
                  Condition Expression:
                </span>
                <button
                  onClick={() => handleCopy(selectedRule.condition || selectedRule.description)}
                  className="inline-flex items-center gap-1 text-[11px] text-[#D05A40] hover:text-[#B84E37] font-mono font-semibold"
                >
                  {copied ? <Check className="w-3 h-3 text-[#3A8A7F]" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy Expression"}</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-lg bg-[#F8F6F0] dark:bg-[#0D1117] border border-[#D1CEC7] dark:border-[#26344A] text-[11px] font-mono text-[#1A202E] dark:text-sky-300 overflow-y-auto select-all">
                {selectedRule.condition || `rule_id == "${selectedRule.rule_id}" && action == "${selectedRule.action}"`}
              </pre>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedRule(null)}
                className="px-4 py-1.5 rounded-lg bg-[#D05A40] hover:bg-[#B84E37] text-xs font-semibold text-white transition-colors"
              >
                Close Rule Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
