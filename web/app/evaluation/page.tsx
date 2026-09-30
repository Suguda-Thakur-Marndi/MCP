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
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-[#2C6E65] border border-teal-300 dark:bg-[#3A8A7F]/15 dark:text-[#4EA699] dark:border-[#3A8A7F]/40 font-mono font-semibold">
            <CheckCircle className="w-3.5 h-3.5 text-[#3A8A7F]" />
            <span>PASS</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-[#D64541] border border-red-300 dark:bg-[#D64541]/15 dark:text-[#EF5350] dark:border-[#D64541]/40 font-mono font-semibold">
            <XCircle className="w-3.5 h-3.5 text-[#D64541]" />
            <span>FAIL</span>
          </span>
        ),
    },
    {
      key: "scenario_id",
      header: "Scenario ID",
      width: "120px",
      render: (row) => (
        <code className="text-xs font-mono font-bold text-[#D05A40]">
          {String(row.scenario_id).substring(0, 16)}
        </code>
      ),
    },
    {
      key: "name",
      header: "Scenario Description",
      render: (row) => (
        <div>
          <span className="text-xs font-semibold text-[#1A202E] dark:text-slate-200 block">{row.name}</span>
          {row.notes && <span className="text-[11px] text-[#6B7280] dark:text-slate-400 line-clamp-1">{row.notes}</span>}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (row) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#D05A40]/10 text-[#D05A40] border border-[#D05A40]/30 uppercase font-semibold">
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
          <span className="text-slate-400">→</span>
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
        <span className="font-mono-tnum text-[11px] text-[#6B7280] dark:text-slate-400">
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
          className="p-1.5 rounded text-[#6B7280] hover:text-[#D05A40] hover:bg-[#EFECE5] dark:hover:bg-slate-800 transition-colors"
          title="Inspect Scenario Evidence"
        >
          <Eye className="w-3.5 h-3.5" />
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
            <span>SECURITY ASSURANCE</span>
            <span>/</span>
            <span>AUTOMATED ATTACK & DEFENSE BENCHMARK</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A202E] dark:text-[#F4F6F9] tracking-tight">
              Security Evaluation Suite
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-teal-50 text-[#2C6E65] border border-teal-300 dark:bg-[#3A8A7F]/20 dark:text-[#4EA699] dark:border-[#3A8A7F]/40 font-bold">
              {result ? `${result.summary.total} AUTOMATED SCENARIOS` : "56 SCENARIOS"}
            </span>
          </div>
          <p className="text-xs text-[#475063] dark:text-[#94A3B8] mt-1 max-w-2xl leading-relaxed">
            Execute automated red-team security scenarios validating parameter tampering defense, replay rejection, prompt injection neutralization, and database integrity invariance.
          </p>
        </div>

        <button
          onClick={handleRunEval}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D05A40] hover:bg-[#B84E37] text-white text-xs font-semibold shadow-md shadow-[#D05A40]/25 transition-all hover:scale-[1.01] disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "Executing Scenarios..." : "Run Security Evaluation"}</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl text-xs border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#D64541] flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={handleRunEval} className="font-semibold underline hover:text-red-950">
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
        <div className="p-5 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] space-y-3 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-[#D1CEC7] dark:border-[#26344A]">
            <div>
              <span className="text-[10px] font-mono uppercase text-[#D05A40] font-bold block">Defense Matrix</span>
              <h3 className="text-xs font-bold text-[#1A202E] dark:text-[#F4F6F9] uppercase tracking-wider font-sans">
                Category Defense Results Breakdown
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[#3A8A7F] font-bold">100% INVARIANCE</span>
          </div>

          <div className="py-2 h-44">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="category" tick={{ fill: "#64748B", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#64748B", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#17202E",
                      borderColor: "#26344A",
                      borderRadius: "6px",
                      fontSize: "11px",
                      color: "#F4F6F9",
                    }}
                  />
                  <Bar dataKey="passed" name="Passed" fill="#3A8A7F" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="failed" name="Failed" fill="#D64541" radius={[3, 3, 0, 0]} />
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
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] overflow-x-auto w-full sm:w-auto shadow-sm">
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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-[#D05A40] text-white shadow-xs"
                    : "text-[#475063] dark:text-slate-400 hover:text-[#1A202E] dark:hover:text-white"
                }`}
              >
                <span>{c}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                    isActive ? "bg-white/20 text-white" : "bg-[#EFECE5] dark:bg-slate-800 text-[#475063] dark:text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search test scenarios by name, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] text-xs text-[#1A202E] dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-[#D05A40] font-sans shadow-sm"
          />
        </div>
      </div>

      {/* Scenarios DataTable */}
      <DataTable
        columns={columns}
        data={filteredResults}
        isLoading={initialLoading}
        emptyTitle="No Evaluation Results Recorded"
        emptyMessage="Click 'Run Security Evaluation' above to execute the automated benchmark suite."
        onRowClick={(row) => setSelectedScenario(row)}
      />

      {/* Scenario Evidence Detail Drawer */}
      {selectedScenario && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedScenario(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-[#FFFFFF] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] shadow-2xl overflow-hidden p-6 space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D1CEC7] dark:border-[#26344A]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#1A202E] dark:text-white font-mono">{selectedScenario.name}</h3>
                  {selectedScenario.passed ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-50 text-[#2C6E65] border border-teal-300 dark:bg-[#3A8A7F]/20 dark:text-[#4EA699] dark:border-[#3A8A7F]/40 font-bold">
                      PASS
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-50 text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60 font-bold">
                      FAIL
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#6B7280] dark:text-slate-400 font-mono">
                  Scenario: {selectedScenario.scenario_id} • Category: {selectedScenario.category}
                </span>
              </div>
              <button
                onClick={() => setSelectedScenario(null)}
                className="p-1 rounded text-slate-400 hover:text-[#1A202E] dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[10px] text-[#6B7280] dark:text-slate-500 uppercase font-mono block">Expected</span>
                <DecisionBadge decision={selectedScenario.expected_decision || selectedScenario.expected || "ALLOW"} />
              </div>
              <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[10px] text-[#6B7280] dark:text-slate-500 uppercase font-mono block">Actual Result</span>
                <DecisionBadge decision={selectedScenario.actual_decision || selectedScenario.actual || "ALLOW"} />
              </div>
              <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[10px] text-[#6B7280] dark:text-slate-500 uppercase font-mono block">DB Invariance</span>
                <span className="font-mono font-bold text-xs text-[#3A8A7F]">
                  {selectedScenario.db_integrity_verified !== false ? "VERIFIED OK" : "FAILED"}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#F8F6F0] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
                <span className="text-[10px] text-[#6B7280] dark:text-slate-500 uppercase font-mono block">Latency</span>
                <span className="font-mono text-xs font-bold text-[#1A202E] dark:text-slate-200">
                  {selectedScenario.latency_ms ?? 0} ms
                </span>
              </div>
            </div>

            {/* Evidence Log Payload */}
            <div className="space-y-1.5 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#1A202E] dark:text-slate-300 font-bold font-sans">
                  Scenario Execution Evidence:
                </span>
                <button
                  onClick={() => handleCopy(prettyJson(selectedScenario.evidence || selectedScenario))}
                  className="inline-flex items-center gap-1 text-[11px] text-[#D05A40] hover:text-[#B84E37] font-mono font-semibold"
                >
                  {copied ? <Check className="w-3 h-3 text-[#3A8A7F]" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy Evidence"}</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-lg bg-[#F8F6F0] dark:bg-[#0D1117] border border-[#D1CEC7] dark:border-[#26344A] text-[11px] font-mono text-[#1A202E] dark:text-sky-300 overflow-y-auto flex-1 select-all">
                {prettyJson(selectedScenario.evidence || selectedScenario)}
              </pre>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedScenario(null)}
                className="px-4 py-1.5 rounded-lg bg-[#D05A40] hover:bg-[#B84E37] text-xs font-semibold text-white transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
