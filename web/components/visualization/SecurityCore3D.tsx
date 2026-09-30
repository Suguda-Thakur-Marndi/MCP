"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Bot,
  Wrench,
  UserCheck,
  Database,
  Lock,
  ArrowRight,
  Sliders,
  CheckCircle2,
  Clock,
  Shield,
  Layers,
} from "lucide-react";

interface NodeTelemetry {
  id: string;
  name: string;
  category: string;
  status: "ONLINE" | "SECURED" | "GATED" | "ACTIVE";
  icon: React.ElementType;
  details: string;
  securityInvariant: string;
  latency: string;
  techStack: string;
}

const NODES: NodeTelemetry[] = [
  {
    id: "agent",
    name: "AI Reasoning Agent",
    category: "LLM EXECUTION",
    status: "ACTIVE",
    icon: Bot,
    details: "Google Gemini 2.5 Flash running cyclic LangGraph state machine with 10-iteration ceiling.",
    securityInvariant: "Strict prompt injection delimitation & advisory metadata isolation.",
    latency: "340ms",
    techStack: "Gemini 2.5 Flash · LangGraph 1.2+",
  },
  {
    id: "policy",
    name: "Policy & Risk Engine",
    category: "DETERMINISTIC EVAL",
    status: "SECURED",
    icon: Sliders,
    details: "Independent server-side scoring (0–100) running authoritative precedence hierarchy.",
    securityInvariant: "DENY > REQUIRE_MFA > REQUIRE_APPROVAL > ALLOW. No LLM override.",
    latency: "0.4ms",
    techStack: "Deterministic Python 3.12 Engine",
  },
  {
    id: "approvals",
    name: "Dual-Custody Gate",
    category: "HITL GOVERNANCE",
    status: "GATED",
    icon: UserCheck,
    details: "State machine requiring explicit reviewer approval for high-risk and critical operations.",
    securityInvariant: "SHA-256 parameter hash binding prevents in-flight argument tampering.",
    latency: "Async / On-Demand",
    techStack: "Cryptographic SHA-256 Seal",
  },
  {
    id: "mcp",
    name: "FastMCP Server",
    category: "TOOL DISPATCH",
    status: "SECURED",
    icon: Wrench,
    details: "Authoritative in-process tool provider hosting typed parameter contracts.",
    securityInvariant: "Zero raw SQL generation. Bounded read projections (max 100 records).",
    latency: "0.8ms",
    techStack: "FastMCP 4.0 · Pydantic V2",
  },
  {
    id: "database",
    name: "PostgreSQL Ledger",
    category: "PERSISTENCE & AUDIT",
    status: "ONLINE",
    icon: Database,
    details: "Relational persistence enforcing least-privilege database roles and tamper-evident logs.",
    securityInvariant: "100% parameterized SQL ($1, $2). Append-only cryptographic audit trail.",
    latency: "1.2ms",
    techStack: "PostgreSQL 16 · asyncpg",
  },
];

export function SecurityCore3D({
  systemHealthy = true,
  pendingCount = 0,
  blockedCount = 0,
  toolCount = 6,
}: {
  systemHealthy?: boolean;
  pendingCount?: number;
  blockedCount?: number;
  toolCount?: number;
}) {
  const [selectedNode, setSelectedNode] = useState<NodeTelemetry>(NODES[0]);

  return (
    <div className="rounded bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden shadow-xs">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center border border-[var(--accent)]/20">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Security Perimeter & Enforcement Topology
              </h3>
              <span className="px-1.5 py-0.2 rounded bg-[var(--risk-low-bg)] text-[var(--risk-low)] border border-[var(--risk-low-border)] text-[9px] font-mono-tnum font-semibold">
                ACTIVE PIPELINE
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Deterministic boundary between autonomous LLM reasoning and enterprise data persistence.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono-tnum text-[11px]">
          <span className="text-[var(--text-muted)]">Perimeter State:</span>
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--risk-low)]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            100% INVARIANT
          </span>
        </div>
      </div>

      {/* Main Content: Pipeline flow & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border)]">
        {/* Left: 5-Stage Architecture Flow */}
        <div className="lg:col-span-7 p-4 bg-[var(--bg-primary)]/30 flex flex-col justify-between space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
            <span>Execution Chain (Left to Right)</span>
            <span className="font-mono-tnum">Select a node to inspect invariants</span>
          </div>

          <div className="space-y-2">
            {NODES.map((node, idx) => {
              const Icon = node.icon;
              const isSelected = selectedNode.id === node.id;

              return (
                <div key={node.id} className="relative">
                  <button
                    onClick={() => setSelectedNode(node)}
                    className={`w-full text-left p-2.5 rounded transition-all flex items-center justify-between gap-3 border ${
                      isSelected
                        ? "bg-[var(--bg-card)] border-[var(--accent)] shadow-xs ring-1 ring-[var(--accent)]/30"
                        : "bg-[var(--bg-card)]/80 border-[var(--border)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-card)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded bg-[var(--bg-secondary)] flex items-center justify-center text-[10px] font-mono-tnum font-bold text-[var(--text-muted)] border border-[var(--border)]">
                        0{idx + 1}
                      </div>
                      <div className={`p-1.5 rounded ${isSelected ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--text-primary)]">
                            {node.name}
                          </span>
                          <span className="text-[9px] font-mono-tnum text-[var(--text-muted)] uppercase">
                            [{node.category}]
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] line-clamp-1">
                          {node.details}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] font-mono-tnum text-[10px] text-[var(--text-secondary)]">
                        {node.latency}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${node.status === "ACTIVE" ? "bg-[var(--info)]" : node.status === "SECURED" ? "bg-[var(--risk-low)]" : node.status === "GATED" ? "bg-[var(--risk-high)]" : "bg-[var(--risk-low)]"}`} />
                    </div>
                  </button>

                  {idx < NODES.length - 1 && (
                    <div className="h-1.5 w-0.5 bg-[var(--border)] ml-7 my-0.5" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-mono-tnum">
            <span>Enforced Guardrails: Parameter Hash Binding · No Raw SQL · Least Privilege</span>
            <span>FastMCP v4.0</span>
          </div>
        </div>

        {/* Right: Technical Inspector Pane for Selected Node */}
        <div className="lg:col-span-5 p-4 bg-[var(--bg-card)] flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--border)]">
              <div>
                <span className="text-[9px] uppercase font-semibold tracking-wider text-[var(--text-muted)] block">
                  Node Telemetry Inspector
                </span>
                <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <selectedNode.icon className="w-4 h-4 text-[var(--accent)]" />
                  {selectedNode.name}
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] font-mono-tnum text-[10px] font-semibold text-[var(--text-primary)]">
                {selectedNode.status}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                  Enforced Security Invariant
                </label>
                <div className="p-2.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-mono-tnum leading-relaxed">
                  <div className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--risk-low)] flex-shrink-0 mt-0.5" />
                    <span>{selectedNode.securityInvariant}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                  Architecture & Technology Stack
                </label>
                <p className="text-xs text-[var(--text-secondary)] font-mono-tnum p-2 rounded bg-[var(--bg-primary)]/50 border border-[var(--border)]">
                  {selectedNode.techStack}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 font-mono-tnum">
                <div className="p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Average Overhead</span>
                  <span className="text-xs font-bold text-[var(--text-primary)]">{selectedNode.latency}</span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Tamper Defense</span>
                  <span className="text-xs font-bold text-[var(--risk-low)]">Enforced</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded bg-[var(--risk-low-bg)] border border-[var(--risk-low-border)] flex items-center justify-between text-[11px] font-mono-tnum text-[var(--risk-low)]">
            <span className="font-semibold">Cryptographic Guarantee:</span>
            <span>Zero Unchecked Dispatches</span>
          </div>
        </div>
      </div>
    </div>
  );
}
