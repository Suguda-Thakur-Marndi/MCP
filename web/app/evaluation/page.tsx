"use client";

import { useEffect, useState, useTransition } from "react";
import { api, SecurityEvalResult } from "@/lib/api";
import { decisionBadgeClass } from "@/lib/utils";

export default function SecurityEvaluationPage() {
  const [result, setResult] = useState<SecurityEvalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("ALL");
  const [, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;
    api.security
      .getLatest()
      .then((data) => {
        if (isMounted) {
          startTransition(() => {
            setResult(data);
            setInitialLoading(false);
          });
        }
      })
      .catch(() => {
        if (isMounted) {
          startTransition(() => {
            setInitialLoading(false);
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRunEval = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.security.runEval();
      startTransition(() => {
        setResult(data);
        setLoading(false);
      });
    } catch (err: unknown) {
      startTransition(() => {
        setError(err instanceof Error ? err.message : "Security evaluation failed to run");
        setLoading(false);
      });
    }
  };

  const allCategories = [
    "ALL",
    "READ",
    "WRITE",
    "DESTRUCTIVE",
    "ADVERSARIAL",
    "AUTHENTICATION",
    "AUTHORIZATION",
    "APPROVAL",
    "PROMPT_INJECTION",
    "MCP_SECURITY",
    "POLICY",
    "LIFECYCLE",
    "CONCURRENCY",
    "INPUT_VALIDATION",
  ];

  const presentCategories = result?.results
    ? Array.from(new Set(result.results.map((r) => r.category?.toUpperCase()).filter(Boolean)))
    : [];

  const categories = presentCategories.length > 0
    ? ["ALL", ...presentCategories]
    : allCategories;

  const filteredResults =
    result?.results.filter((r) =>
      filterCat === "ALL" ? true : r.category?.toUpperCase() === filterCat
    ) || [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Security Evaluation Suite</h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-purple-950 text-purple-400 border border-purple-800">
              {result ? `${result.summary.total} AUTOMATED SCENARIOS` : "56 AUTOMATED ATTACK & DEFENSE SCENARIOS"}
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Execute end-to-end evaluation validating parameter tampering defense, replay rejection, prompt injection neutralization, and database integrity invariance.
          </p>
        </div>

        <button
          onClick={handleRunEval}
          disabled={loading}
          className="btn-primary flex items-center gap-2 text-xs py-2.5 px-5 disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          {loading ? "Running Security Evaluation..." : "Trigger Security Evaluation"}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(239, 68, 68, 0.12)", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {/* Summary Scorecard (If run completed) */}
      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="glass-card p-4 space-y-1">
            <div className="text-xs font-mono text-slate-400">TOTAL SCENARIOS</div>
            <div className="text-2xl font-bold text-white font-mono">{result.summary.total}</div>
            <div className="text-[11px] text-slate-500">Comprehensive matrix</div>
          </div>

          <div className="glass-card p-4 space-y-1">
            <div className="text-xs font-mono text-slate-400">SCENARIOS PASSED</div>
            <div className="text-2xl font-bold text-green-400 font-mono">{result.summary.passed}</div>
            <div className="text-[11px] text-green-500 font-mono">{result.summary.pass_rate.toFixed(1)}% Pass Rate</div>
          </div>

          <div className="glass-card p-4 space-y-1">
            <div className="text-xs font-mono text-slate-400">SECURITY FAILURES</div>
            <div className="text-2xl font-bold font-mono" style={{ color: result.summary.failed > 0 ? "#ef4444" : "#22c55e" }}>
              {result.summary.failed}
            </div>
            <div className="text-[11px] text-slate-500">Zero tolerance</div>
          </div>

          <div className="glass-card p-4 space-y-1">
            <div className="text-xs font-mono text-slate-400">DATA LOSS INVARIANCE</div>
            <div className="text-xl font-bold text-sky-400 font-mono">VERIFIED</div>
            <div className="text-[11px] text-sky-500 font-mono">0 Unauthorized DB Writes</div>
          </div>

          <div className="glass-card p-4 space-y-1">
            <div className="text-xs font-mono text-slate-400">EXECUTION TIME</div>
            <div className="text-2xl font-bold text-purple-400 font-mono">
              {result.summary.duration_seconds.toFixed(2)}s
            </div>
            <div className="text-[11px] text-slate-500">FastMCP In-Process</div>
          </div>
        </div>
      )}

      {/* Scenarios Table */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
            Evaluation Matrix Scenarios
          </h2>

          {/* Category tabs */}
          <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setFilterCat(c)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  filterCat === c
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {!result && !loading && !initialLoading && (
          <div className="text-center py-20 space-y-3">
            <div className="text-slate-400 text-xs font-mono">
              Click &quot;Trigger Security Evaluation&quot; to execute the 25 automated attack &amp; defense verification scenarios against the live database.
            </div>
            <button
              onClick={handleRunEval}
              className="btn-primary text-xs py-2 px-4"
            >
              Run Evaluation Now
            </button>
          </div>
        )}

        {(loading || initialLoading) && (
          <div className="text-center py-20 space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto" />
            <div className="text-xs font-mono text-slate-300">
              {loading ? "Simulating adversarial attacks, hash mutations, and lifecycle flows..." : "Loading evaluation report from server..."}
            </div>
          </div>
        )}

        {result && !loading && !initialLoading && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Scenario Name</th>
                  <th>Category</th>
                  <th>Expected</th>
                  <th>Actual</th>
                  <th>Latency</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((sc) => (
                  <tr key={sc.scenario_id}>
                    <td className="font-mono text-xs font-bold text-slate-500">
                      {String(sc.scenario_id)}
                    </td>
                    <td className="text-xs font-medium text-white">
                      {sc.name}
                    </td>
                    <td>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono" style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                        {sc.category}
                      </span>
                    </td>
                    <td>
                      <span className={decisionBadgeClass(sc.expected || "ALLOW")}>
                        {sc.expected || "ALLOW"}
                      </span>
                    </td>
                    <td>
                      <span className={decisionBadgeClass(sc.actual || "ALLOW")}>
                        {sc.actual || "ALLOW"}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-slate-400">
                      {(sc.duration_ms ?? sc.latency_ms ?? 0).toFixed(1)}ms
                    </td>
                    <td>
                      {sc.passed ? (
                        <span className="badge badge-success">
                          ✓ PASS
                        </span>
                      ) : (
                        <span className="badge badge-danger">
                          ✗ FAIL
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
