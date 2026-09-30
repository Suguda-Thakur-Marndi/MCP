"use client";

import React, { useState } from "react";
import {
  Bot,
  Wrench,
  Sliders,
  Gauge,
  UserCheck,
  Database,
  Lock,
  ChevronRight,
  Fingerprint,
  ArrowRight,
  Play,
  RotateCcw,
  Layers,
} from "lucide-react";

export interface SecurityMachineProps {
  systemHealthy?: boolean;
  pendingCount?: number;
  blockedCount?: number;
  toolCount?: number;
  policyCount?: number;
  auditCount?: number;
}

interface MachineStage {
  id: "agent" | "mcp" | "policy" | "risk" | "approval" | "action";
  stepNumber: string;
  name: string;
  label: string;
  category: string;
  status: "NORMAL" | "VERIFIED" | "GATED" | "ACTIVE";
  icon: React.ElementType;
  mechanism: string;
  inputContract: string;
  outputContract: string;
  invariantRule: string;
  cryptographicProof: string;
  typicalLatency: string;
  techStack: string;
  specSummary: string;
}

const MACHINE_STAGES: MachineStage[] = [
  {
    id: "agent",
    stepNumber: "01",
    name: "Agent",
    label: "Cognitive Reasoner",
    category: "LLM EXECUTION",
    status: "ACTIVE",
    icon: Bot,
    mechanism: "Cyclic ReAct state graph with 10-step iteration limit",
    inputContract: "Authenticated user prompt + isolated advisory context",
    outputContract: "Structured FastMCP tool invocation intent",
    invariantRule: "Strict delimiter isolation. Prompt injections neutralized before reaching protocol bus.",
    cryptographicProof: "Advisory-only tagging; LLM carries 0 direct DB credentials",
    typicalLatency: "320ms",
    techStack: "Gemini 2.5 Flash · LangGraph 1.2+",
    specSummary: "The AI reasoning agent operates strictly within an isolated supervisory boundary, producing tool execution intents without write authority.",
  },
  {
    id: "mcp",
    stepNumber: "02",
    name: "MCP",
    label: "Protocol Gateway",
    category: "TOOL DISPATCH",
    status: "VERIFIED",
    icon: Wrench,
    mechanism: "FastMCP typed contract serializer & parameter schema validator",
    inputContract: "Raw tool dispatch candidate with keyword arguments",
    outputContract: "Strongly typed Pydantic V2 validated parameters",
    invariantRule: "Zero raw SQL queries permitted. Bounded read projections (max 100 records per tool invocation).",
    cryptographicProof: "Schema hash validation against registered tool manifest",
    typicalLatency: "0.6ms",
    techStack: "FastMCP 4.0 · Pydantic V2",
    specSummary: "Validates and bounds incoming tool arguments against strict declarative contracts before policy evaluation.",
  },
  {
    id: "policy",
    stepNumber: "03",
    name: "Policy",
    label: "Invariant Engine",
    category: "FORMAL GOVERNANCE",
    status: "VERIFIED",
    icon: Sliders,
    mechanism: "Deterministic hierarchical precedence evaluator",
    inputContract: "Validated tool dispatch + actor role + environment profile",
    outputContract: "Binding governance verdict: DENY | REQUIRE_MFA | REQUIRE_APPROVAL | ALLOW",
    invariantRule: "Precedence guarantee: DENY > REQUIRE_MFA > REQUIRE_APPROVAL > ALLOW. Server-side rule order is absolute; zero LLM overrides.",
    cryptographicProof: "Policy version hash binding (v1.0.0-immutable)",
    typicalLatency: "0.4ms",
    techStack: "Deterministic Python 3.12 Engine",
    specSummary: "Applies non-overridable enterprise invariants, failing closed whenever context or permissions are incomplete.",
  },
  {
    id: "risk",
    stepNumber: "04",
    name: "Risk",
    label: "Impact Scorer",
    category: "TELEMETRIC SCORING",
    status: "NORMAL",
    icon: Gauge,
    mechanism: "Deterministic multi-factor risk matrix (0–100 scale)",
    inputContract: "Tool definition + parameter payload + resource sensitivity",
    outputContract: "Calibrated risk score (0-100) + threshold escalation trigger",
    invariantRule: "Destructive actions and sensitive resource mutations >= 70 risk strictly mandate dual-custody approval gating.",
    cryptographicProof: "Deterministic scoring formula; identical inputs yield identical score",
    typicalLatency: "0.3ms",
    techStack: "Algorithmic Risk Kernel",
    specSummary: "Quantifies blast radius and data sensitivity, auto-escalating high-impact dispatches to dual-custody gating.",
  },
  {
    id: "approval",
    stepNumber: "05",
    name: "Approval",
    label: "Dual-Custody Gate",
    category: "HITL GOVERNANCE",
    status: "GATED",
    icon: UserCheck,
    mechanism: "Stateful human-in-the-loop review ledger with cryptographic argument sealing",
    inputContract: "Escalated approval request + immutable parameter bundle",
    outputContract: "Signed single-use authorization token or explicit denial audit",
    invariantRule: "SHA-256 parameter hash binding prevents in-flight argument tampering. Single-use token prevents replay attacks.",
    cryptographicProof: "HMAC-SHA256 parameter seal + dual-custody separation of duties",
    typicalLatency: "Async / On-Demand",
    techStack: "HMAC-SHA256 Token Vault",
    specSummary: "Enforces dual-custody authorization for high-risk operations, cryptographically binding decisions to exact tool arguments.",
  },
  {
    id: "action",
    stepNumber: "06",
    name: "Action",
    label: "Atomic Commit",
    category: "PERSISTENCE & AUDIT",
    status: "VERIFIED",
    icon: Database,
    mechanism: "Parameterized database transaction + append-only immutable audit entry",
    inputContract: "Authorized execution token + verified parameter seal",
    outputContract: "Committed transaction payload + tamper-evident audit record",
    invariantRule: "100% parameterized SQL ($1, $2). Zero dynamic string concatenation. Immediate append to cryptographic audit ledger.",
    cryptographicProof: "Cryptographic audit ledger ID + SHA-256 verification hash",
    typicalLatency: "1.2ms",
    techStack: "PostgreSQL 16 · asyncpg",
    specSummary: "Atomically commits approved mutations and logs an immutable audit event for continuous compliance.",
  },
];

export function SecurityCore3D({
  systemHealthy = true,
  pendingCount = 0,
  blockedCount = 0,
  toolCount = 8,
  policyCount = 10,
  auditCount = 1166,
}: SecurityMachineProps) {
  const [selectedStage, setSelectedStage] = useState<MachineStage>(MACHINE_STAGES[0]);
  const [simulating, setSimulating] = useState(false);
  const [activePulseStage, setActivePulseStage] = useState<number | null>(null);

  // Simulation traversal through the machine: Agent -> MCP -> Policy -> Risk -> Approval -> Action
  const runSimulation = () => {
    if (simulating) return;
    setSimulating(true);
    setActivePulseStage(0);
    setSelectedStage(MACHINE_STAGES[0]);

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      if (step < MACHINE_STAGES.length) {
        setActivePulseStage(step);
        setSelectedStage(MACHINE_STAGES[step]);
      } else {
        clearInterval(interval);
        setActivePulseStage(null);
        setSimulating(false);
      }
    }, 700);
  };

  return (
    <div
      className="rounded-sm border border-[var(--border)] bg-[var(--bg-card)] shadow-xs overflow-hidden transition-colors"
      role="region"
      aria-label="The Security Machine: AI Invariant Execution Engine"
    >
      {/* 1. ARCHITECTURAL MACHINE HEADER */}
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xs bg-[var(--color-bg-primary)] border border-[var(--border)] text-[var(--accent)] flex items-center justify-center flex-shrink-0 shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono-tnum tracking-widest text-[var(--text-muted)] uppercase">
                ENGINEERED MECHANISM // MCPS-06
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--risk-low)]" />
              <span className="text-[10px] font-mono-tnum font-bold text-[var(--risk-low)] uppercase">
                INVARIANTS ACTIVE
              </span>
            </div>
            <h2 className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
              The Security Machine: Deterministic Invariant Pipeline
            </h2>
          </div>
        </div>

        {/* Machine Telemetry Gauges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tnum">
          <div className="px-2.5 py-1 rounded-xs bg-[var(--bg-primary)] border border-[var(--border)] flex items-center gap-1.5">
            <span className="text-[10px] uppercase text-[var(--text-muted)]">Perimeter:</span>
            <span className={`font-semibold ${systemHealthy ? "text-[var(--risk-low)]" : "text-[var(--risk-critical)]"}`}>
              {systemHealthy ? "100% HEALTHY" : "DEGRADED"}
            </span>
          </div>

          <div className="px-2.5 py-1 rounded-xs bg-[var(--bg-primary)] border border-[var(--border)] flex items-center gap-1.5">
            <span className="text-[10px] uppercase text-[var(--text-muted)]">Blocked:</span>
            <span className="font-semibold text-[var(--risk-critical)]">
              {blockedCount}
            </span>
          </div>

          <div className="px-2.5 py-1 rounded-xs bg-[var(--bg-primary)] border border-[var(--border)] flex items-center gap-1.5">
            <span className="text-[10px] uppercase text-[var(--text-muted)]">Pending:</span>
            <span className="font-semibold text-[var(--text-primary)]">
              {pendingCount}
            </span>
          </div>

          <button
            onClick={runSimulation}
            disabled={simulating}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xs bg-[var(--accent)] text-white hover:opacity-95 font-semibold text-xs transition-opacity disabled:opacity-50 shadow-xs"
            title="Step an authorized tool execution packet through the security pipeline"
          >
            {simulating ? (
              <>
                <RotateCcw className="w-3 h-3 animate-spin" />
                <span>Traversing Stage 0{activePulseStage !== null ? activePulseStage + 1 : 1}...</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-white" />
                <span>Simulate Execution</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. THE SIX INTERLOCKING ARCHITECTURAL PLATES */}
      <div className="p-3 sm:p-4 bg-[var(--color-bg-primary)]/40 border-b border-[var(--border)] overflow-x-auto">
        <div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 min-w-[700px] lg:min-w-0"
          role="tablist"
          aria-label="Security Machine Stages"
        >
          {MACHINE_STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isSelected = selectedStage.id === stage.id;
            const isPulsing = activePulseStage === idx;

            return (
              <button
                key={stage.id}
                role="tab"
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => setSelectedStage(stage)}
                className={`relative group text-left p-3 rounded-xs border transition-all duration-150 focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)] ${
                  isSelected
                    ? "bg-[var(--bg-card)] border-[var(--accent)] shadow-sm ring-1 ring-[var(--accent)]/30"
                    : isPulsing
                    ? "bg-[var(--bg-card)] border-[var(--accent)] shadow-sm"
                    : "bg-[var(--bg-card)]/75 border-[var(--border)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-card)]"
                }`}
              >
                {/* Mechanical Caliper Markings */}
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)] text-[10px] font-mono-tnum">
                  <span className="font-bold text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">
                    STAGE {stage.stepNumber}
                  </span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      stage.status === "ACTIVE"
                        ? "bg-[var(--info)]"
                        : stage.status === "GATED"
                        ? "bg-[var(--risk-high)]"
                        : "bg-[var(--risk-low)]"
                    }`}
                  />
                </div>

                {/* Stage Title and Icon */}
                <div className="pt-2 flex items-start gap-2">
                  <div
                    className={`p-1.5 rounded-xs flex-shrink-0 transition-colors ${
                      isSelected
                        ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <span className="text-xs font-bold text-[var(--text-primary)] block truncate">
                      {stage.name}
                    </span>
                    <span className="text-[10px] font-mono-tnum text-[var(--text-muted)] uppercase tracking-wider block truncate">
                      {stage.category}
                    </span>
                  </div>
                </div>

                {/* Micro Invariant State */}
                <div className="mt-2.5 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] font-mono-tnum text-[var(--text-secondary)]">
                  <span>{stage.typicalLatency}</span>
                  <ChevronRight
                    className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${
                      isSelected ? "text-[var(--accent)] translate-x-0.5" : "group-hover:translate-x-0.5"
                    }`}
                  />
                </div>

                {/* Interlocking Coupling Arrow between columns */}
                {idx < MACHINE_STAGES.length - 1 && (
                  <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <div className="w-3.5 h-3.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center shadow-2xs">
                      <ArrowRight className="w-2 h-2 text-[var(--text-muted)]" />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. TECHNICAL BLUEPRINT & INVARIANT INSPECTION PANE */}
      <div className="p-4 sm:p-6 bg-[var(--bg-card)] grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Exploded Stage Blueprint (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xs bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                <selectedStage.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono-tnum font-bold text-[var(--accent)] uppercase">
                    STAGE {selectedStage.stepNumber} &mdash; BLUEPRINT SPECIFICATION
                  </span>
                  <span className="px-1.5 py-0.2 rounded-xs bg-[var(--bg-secondary)] text-[10px] font-mono-tnum border border-[var(--border)] text-[var(--text-secondary)]">
                    {selectedStage.techStack}
                  </span>
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  {selectedStage.name} Engine: {selectedStage.label}
                </h3>
              </div>
            </div>

            <div className="text-right font-mono-tnum hidden sm:block">
              <span className="text-[10px] text-[var(--text-muted)] uppercase block">Execution Overhead</span>
              <span className="text-xs font-bold text-[var(--text-primary)]">{selectedStage.typicalLatency}</span>
            </div>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {selectedStage.specSummary}
          </p>

          {/* Enforced Invariant Guarantee Box */}
          <div className="p-3.5 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold font-mono-tnum uppercase tracking-wider text-[var(--text-primary)]">
              <Lock className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Enforced Invariant Guarantee</span>
            </div>
            <p className="text-xs font-mono-tnum text-[var(--text-primary)] bg-[var(--bg-card)] p-2.5 rounded-xs border border-[var(--border-subtle)] leading-relaxed">
              {selectedStage.invariantRule}
            </p>
          </div>

          {/* Data Contract Transformation: Input -> Invariant Mechanism -> Output */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono-tnum">
            <div className="p-3 rounded-xs bg-[var(--color-bg-primary)]/50 border border-[var(--border)]">
              <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] block mb-1">
                Input Verification Contract
              </span>
              <span className="text-[var(--text-secondary)] leading-normal block">
                {selectedStage.inputContract}
              </span>
            </div>

            <div className="p-3 rounded-xs bg-[var(--color-bg-primary)]/50 border border-[var(--border)]">
              <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] block mb-1">
                Output Invariant Guarantee
              </span>
              <span className="text-[var(--text-secondary)] leading-normal block">
                {selectedStage.outputContract}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Mechanical Cryptographic Rig & Live Status (5 Cols) */}
        <div className="lg:col-span-5 p-4 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-1.5">
              <Fingerprint className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Cryptographic Rig
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded-xs bg-[var(--risk-low-bg)] text-[var(--risk-low)] border border-[var(--risk-low-border)] text-[10px] font-mono-tnum font-semibold">
              UNCOMPROMISED
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                Integrity Seal & Proof
              </span>
              <div className="p-2.5 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] font-mono-tnum text-[11px] text-[var(--text-primary)] leading-relaxed">
                {selectedStage.cryptographicProof}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono-tnum pt-1">
              <div className="p-2 rounded-xs bg-[var(--bg-card)] border border-[var(--border)]">
                <span className="text-[10px] text-[var(--text-muted)] uppercase block">Mechanism</span>
                <span className="text-xs font-semibold text-[var(--text-primary)] line-clamp-2">
                  {selectedStage.mechanism}
                </span>
              </div>
              <div className="p-2 rounded-xs bg-[var(--bg-card)] border border-[var(--border)]">
                <span className="text-[10px] text-[var(--text-muted)] uppercase block">Fail-Safe Path</span>
                <span className="text-xs font-semibold text-[var(--risk-critical)]">
                  FAIL-CLOSED (DENY)
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xs bg-[var(--color-bg-primary)] border border-[var(--border)] text-[11px] font-mono-tnum text-[var(--text-secondary)] space-y-1">
              <div className="flex items-center justify-between">
                <span>Active Tools Regulated:</span>
                <span className="font-bold text-[var(--text-primary)]">{toolCount} FastMCP Tools</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Active Invariant Rules:</span>
                <span className="font-bold text-[var(--text-primary)]">{policyCount} Declarative Rules</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total Audit Ledger Entries:</span>
                <span className="font-bold text-[var(--text-primary)]">{auditCount.toLocaleString()} Verified</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[10px] font-mono-tnum text-[var(--text-muted)]">
            <span>Deterministic Machine Protocol</span>
            <span className="text-[var(--accent)] font-semibold">Strict Boundary</span>
          </div>
        </div>
      </div>
    </div>
  );
}
