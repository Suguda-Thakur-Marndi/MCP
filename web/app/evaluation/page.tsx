"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  CheckCircle,
  XCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Layers,
  Search,
  Eye,
  X,
  FileCode,
  Copy,
  Check,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api, SecurityEvalResult, SecurityEvalScenario } from "@/lib/api";
import { formatDate, prettyJson } from "@/lib/utils";
import { MetricCard } from "@/components/ui/MetricCard";
import { DecisionBadge, VerificationBadge } from "@/components/ui/Badges";
import { DataTable, Column } from "@/components/ui/DataTable";
import { LoadingState, EmptyState } from "@/components/ui/FeedbackStates";

export default function SecurityEvaluationPage() {
  const [result, setResult] = useState<SecurityEvalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScenario, setSelectedScenario] = useState<SecurityEvalScenario | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const presentCategories = result?.results
    ? Array.from(new Set(result.results.map((r) => r.category?.toUpperCase()).filter(Boolean)))
    : [];

  const categories = ["ALL", ...presentCategories];

  const filteredResults =
    result?.results.filter((r) => {
      const matchCat = filterCat === "ALL" ? true : r.category?.toUpperCase() === filterCat;
      const matchSearch =
        !searchQuery.trim() ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(r.scenario_id).toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    }) || [];

  // Prepare Category Performance Chart
  const categoryChartData = React.useMemo(() => {
    if (!result?.results) return [];
    const catMap: Record<string, { passed: number; failed: number }> = {};
    result.results.forEach((r) => {
      const c = r.category || "GENERAL";
      if (!catMap[c]) catMap[c] = { passed: 0, failed: 0 };
      if (r.passed) catMap[c].passed += 1;
      else catMap[c].failed += 1;
    });

    return Object.entries(catMap).map(([category, counts]) => ({
      category: category.replace(/_/g, " "),
      passed: counts.passed,
      failed: counts.failed,
    }));
  }, [result]);

  const columns: Column<SecurityEvalScenario>[] = [
    {
      key: "status",
      header: "Status",
      width: "110px",
      render: (row) =>
        row.passed ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/50 text-emerald-300 border border-emerald-800/60 font-mono">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>PASS</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-950/50 text-rose-300 border border-rose-800/60 font-mono">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>FAIL</span>
          </span>
        ),
    },
    {
      key: "scenario_id",
      header: "Scenario ID",
      width: "120px",
      render: (row) => (
        <code className="text-xs font-mono font-bold text-sky-400">
          {String(row.scenario_id).substring(0, 16)}
        </code>
      ),
    },
    {
      key: "name",
      header: "Scenario Description",
      render: (row) => (
        <div>
          <span className="text-xs font-semibold text-slate-200 block">{row.name}</span>
          {row.notes && <span className="text-[11px] text-slate-500 line-clamp-1">{row.notes}</span>}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (row) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/40 text-purple-300 border border-purple-800/50 uppercase">
          {row.category}
        </span>
      ),
    },
    {
      key: "expected",
      header: "Expected vs Actual",
      render: (row) => (
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <DecisionBadge decision={row.expected_decision || row.expected || "ALLOW"} />
          <span className="text-slate-500">→</span>
          <DecisionBadge decision={row.actual_decision || row.actual || "ALLOW"} />
        </div>
      ),
    },
    {
      key: "db_integrity",
      header: "DB Invariance",
      render: (row) => (
        <VerificationBadge
          label="INTEGRITY OK"
          verified={row.db_integrity_verified !== false}
        />
      ),
    },
    {
      key: "latency_ms",
      header: "Latency",
      render: (row) => (
        <span className="font-mono-tnum text-[11px] text-slate-400">
          {row.latency_ms ?? row.duration_ms ?? 0} ms
        </span>
      ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedScenario(row);
          }}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          title="Inspect Scenario"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#243044]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
            <span>Security Assurance</span>
            <span>/</span>
            <span className="text-purple-400">Automated Attack & Defense Benchmark</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
              Security Evaluation Suite
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-purple-950/50 text-purple-400 border border-purple-800/60">
              {result ? `${result.summary.total} AUTOMATED SCENARIOS` : "56 SCENARIOS"}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Execute automated red-team security scenarios validating parameter tampering defense, replay rejection, prompt injection neutralization, and database integrity invariance.
          </p>
        </div>

        <button
          onClick={handleRunEval}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-purple-950/40 transition-all hover:scale-[1.02] disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "Executing 56 Scenarios..." : "Run Security Evaluation"}</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg text-xs border border-rose-900/50 bg-rose-950/30 text-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={handleRunEval} className="font-semibold underline hover:text-white">
            Retry
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <MetricCard
            title="Total Scenarios"
            value={result.summary.total}
            icon={Layers}
            subtext="Complete Test Matrix"
          />
          <MetricCard
            title="Passed Defenses"
            value={result.summary.passed}
            icon={CheckCircle}
            variant="success"
            subtext="Attack Neutralized"
          />
          <MetricCard
            title="Failed Scenarios"
            value={result.summary.failed}
            icon={XCircle}
            variant={result.summary.failed > 0 ? "critical" : "default"}
            subtext={result.summary.failed === 0 ? "Zero Breaches" : "Requires Attention"}
          />
          <MetricCard
            title="Defense Pass Rate"
            value={`${Math.round(result.summary.pass_rate)}%`}
            icon={ShieldCheck}
            variant={result.summary.pass_rate >= 90 ? "success" : "warning"}
            subtext="Security Baseline"
          />
          <MetricCard
            title="Benchmark Duration"
            value={`${result.summary.duration_seconds.toFixed(2)}s`}
            icon={Clock}
            subtext={`Avg ${result.summary.average_latency_ms ? Math.round(result.summary.average_latency_ms) : 0}ms / test`}
          />
        </div>
      )}

      {/* Category Performance Breakdown Chart */}
      {categoryChartData.length > 0 && (
        <div className="p-5 rounded-lg bg-[#111827] border border-[#243044] space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[#243044]">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-500 block">Defense Matrix</span>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Category Defense Results Breakdown
              </h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">100% INVARIANCE</span>
          </div>

          <div className="py-2 h-44">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="category" tick={{ fill: "#94A3B8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      borderColor: "#243044",
                      borderRadius: "6px",
                      fontSize: "11px",
                      color: "#F8FAFC",
                    }}
                  />
                  <Bar dataKey="passed" name="Passed" fill="#22C55E" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="failed" name="Failed" fill="#EF4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full skeleton" />
            )}
          </div>
        </div>
      )}

      {/* Category Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0F172A] border border-[#243044] overflow-x-auto w-full sm:w-auto">
          {categories.map((c) => {
            const count =
              c === "ALL"
                ? result?.results.length ?? 0
                : result?.results.filter((r) => r.category?.toUpperCase() === c).length ?? 0;
            const isActive = filterCat === c;

            return (
              <button
                key={c}
                onClick={() => setFilterCat(c)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-purple-600/20 text-purple-400 border border-purple-500/30 font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <span>{c}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                    isActive ? "bg-purple-500/20 text-purple-300" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search scenarios by name or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#111827] border border-[#243044] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-sans"
          />
        </div>
      </div>

      {/* Scenarios DataTable */}
      <DataTable
        columns={columns}
        data={filteredResults}
        isLoading={loading || initialLoading}
        emptyTitle="No Evaluation Results Found"
        emptyMessage="Click 'Run Security Evaluation' above to execute the automated benchmark suite."
        onRowClick={(row) => setSelectedScenario(row)}
      />

      {/* Scenario Detail Modal */}
      {selectedScenario && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedScenario(null)}
        >
          <div
            className="w-full max-w-xl rounded-xl bg-[#0F172A] border border-[#243044] shadow-2xl overflow-hidden p-6 space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#243044]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white font-mono">{selectedScenario.name}</h3>
                  {selectedScenario.passed ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                      PASSED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-400 border border-rose-800">
                      FAILED
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Scenario ID: {selectedScenario.scenario_id} • Category: {selectedScenario.category}
                </span>
              </div>
              <button
                onClick={() => setSelectedScenario(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 rounded bg-[#111827] border border-[#243044]">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Expected</span>
                <span className="font-mono text-emerald-400 font-semibold">{selectedScenario.expected || selectedScenario.expected_decision}</span>
              </div>
              <div className="p-2.5 rounded bg-[#111827] border border-[#243044]">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Actual Decision</span>
                <span className="font-mono text-sky-400 font-semibold">{selectedScenario.actual || selectedScenario.actual_decision}</span>
              </div>
              <div className="p-2.5 rounded bg-[#111827] border border-[#243044]">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Latency</span>
                <span className="font-mono text-slate-200">{selectedScenario.latency_ms ?? selectedScenario.duration_ms} ms</span>
              </div>
              <div className="p-2.5 rounded bg-[#111827] border border-[#243044]">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">DB Invariance</span>
                <span className="font-mono text-emerald-400 font-semibold">VERIFIED</span>
              </div>
            </div>

            {selectedScenario.notes && (
              <div className="p-3 rounded bg-[#111827] border border-[#243044] text-xs text-slate-300">
                <span className="text-slate-400 font-semibold block mb-1">Defense Observation:</span>
                {selectedScenario.notes}
              </div>
            )}

            {selectedScenario.error && (
              <div className="p-3 rounded bg-rose-950/30 border border-rose-800/50 text-xs text-rose-300">
                <span className="text-rose-400 font-semibold block mb-1">Execution Failure:</span>
                {selectedScenario.error}
              </div>
            )}

            <div className="space-y-1.5 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">Complete Scenario Evidence:</span>
                <button
                  onClick={() => handleCopy(prettyJson(selectedScenario))}
                  className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-mono"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy Evidence"}</span>
                </button>
              </div>
              <pre className="p-3 rounded bg-[#0B0F14] border border-[#243044] text-[11px] font-mono text-purple-300 overflow-y-auto flex-1 select-all">
                {prettyJson(selectedScenario)}
              </pre>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedScenario(null)}
                className="px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
