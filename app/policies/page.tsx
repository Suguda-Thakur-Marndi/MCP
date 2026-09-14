"use client";

import { useEffect, useState } from "react";
import { api, PolicyInfo } from "@/lib/api";
import { decisionBadgeClass } from "@/lib/utils";

export default function PolicyEnginePage() {
  const [policies, setPolicies] = useState<PolicyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.policies.list()
      .then((data) => setPolicies(data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load policies"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">Policy Engine & Risk Matrix</h1>
          <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-sky-950 text-sky-400 border border-sky-800">
            DETERMINISTIC EVALUATION
          </span>
        </div>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Deterministic pre-execution policy rules and multi-factor risk assessment scores (0–100 scale).
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(239, 68, 68, 0.12)", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {/* Risk Score Thresholds Banner */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
          Multi-Factor Risk Scoring Thresholds
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg space-y-1" style={{ background: "var(--bg-secondary)", borderLeft: "3px solid #22c55e" }}>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-green-400">LOW RISK</span>
              <span className="text-slate-400">0 – 29</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Read-only operations on non-sensitive records. Direct execution permitted.
            </p>
          </div>

          <div className="p-4 rounded-lg space-y-1" style={{ background: "var(--bg-secondary)", borderLeft: "3px solid #f59e0b" }}>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-amber-400">MEDIUM RISK</span>
              <span className="text-slate-400">30 – 59</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Standard updates, audit notes, or filtered queries. Direct execution with logging.
            </p>
          </div>

          <div className="p-4 rounded-lg space-y-1" style={{ background: "var(--bg-secondary)", borderLeft: "3px solid #f97316" }}>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-orange-400">HIGH RISK</span>
              <span className="text-slate-400">60 – 79</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Broad bulk queries, production environment operations, or sensitive changes. Gated.
            </p>
          </div>

          <div className="p-4 rounded-lg space-y-1" style={{ background: "var(--bg-secondary)", borderLeft: "3px solid #ef4444" }}>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-red-400">CRITICAL RISK</span>
              <span className="text-slate-400">80 – 100</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Destructive mutations (e.g., delete_customer). Strict human approval ticket mandatory.
            </p>
          </div>
        </div>
      </div>

      {/* Rules Registry */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
            Active Security Policy Rules
          </h2>
          <span className="text-xs font-mono text-slate-400">
            Precedence: Highest Priority First
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Rule ID</th>
                <th>Description</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-xs text-slate-400">
                    Loading policy rules...
                  </td>
                </tr>
              )}
              {policies.flatMap((p) => p.rules).sort((a, b) => a.priority - b.priority).map((r) => (
                <tr key={r.rule_id}>
                  <td className="font-mono text-xs font-bold text-sky-400">
                    #{r.priority}
                  </td>
                  <td className="font-mono text-xs font-semibold text-white">
                    {r.rule_id}
                  </td>
                  <td className="text-xs text-slate-300 max-w-xl">
                    {r.description}
                  </td>
                  <td>
                    <span className={decisionBadgeClass(r.action)}>
                      {r.action}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
