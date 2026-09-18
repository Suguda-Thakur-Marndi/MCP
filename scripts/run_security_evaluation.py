"""
Command-line runner for MCP-Sentinel Phase 8 Automated Security Evaluation & Benchmark Framework.
Executes 50+ adversarial and functional security test cases against Secured and Baseline agents.
Generates:
- stdout summary and benchmark table
- eval_results.json
- SECURITY_EVALUATION_REPORT.md
- PostgreSQL security_eval_runs / security_eval_results records
"""

import argparse
import asyncio
import pathlib
import sys

# Ensure root is in sys.path
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from mcp_sentinel.security.evaluation.engine import SecurityEvaluationEngine
from mcp_sentinel.security.evaluation.report import EvaluationReportGenerator


async def run_cli(args: argparse.Namespace) -> int:
    mode = args.mode.lower()
    if mode == "both":
        mode = "benchmark"

    print("============================================================")
    print("MCP-Sentinel — Automated Security Evaluation & Benchmark Framework")
    print(f"Mode: {mode.upper()} | Dataset: security-eval-v1")
    print("============================================================")
    print(f"[*] Initializing SecurityEvaluationEngine (mode={mode})...")

    engine = SecurityEvaluationEngine()
    summary = await engine.run_evaluation(
        agent_mode=mode,
        category=args.category,
        test_id=args.test_id,
        dry_run=args.dry_run,
        record_in_db=not args.dry_run,
    )

    root_dir = pathlib.Path(__file__).parent.parent
    json_path = (
        pathlib.Path(args.output_json) if args.output_json else root_dir / "eval_results.json"
    )
    md_path = (
        pathlib.Path(args.output_md)
        if args.output_md
        else root_dir / "SECURITY_EVALUATION_REPORT.md"
    )

    EvaluationReportGenerator.to_json(summary, json_path)
    EvaluationReportGenerator.to_markdown(summary, md_path)

    print("\n------------------------------------------------------------")
    print("EVALUATION RESULTS & SECURITY KPIS")
    print("------------------------------------------------------------")
    print(f"Run ID:                  {summary.run_id}")
    print(f"Total Tests Evaluated:   {summary.total_tests}")
    print(f"Tests Passed:            {summary.passed}")
    print(f"Tests Failed:            {summary.failed}")
    print(f"Security Pass Rate:      {summary.pass_rate:.1f}%")
    print(f"Attack Attempts:         {summary.attack_attempts}")
    print(f"Attack Successes:        {summary.attack_successes}")
    print(f"Attack Success Rate:     {summary.attack_success_rate:.1f}%")
    print(f"Security Gating Recall:  {summary.gating_recall:.1f}%")
    print(f"False Positive Rate:     {summary.false_positive_rate:.1f}%")
    print(f"Approval Bypass Rate:    {summary.approval_bypass_rate:.1f}%")
    print(f"Authz Bypass Rate:       {summary.authorization_bypass_rate:.1f}%")
    print(f"Prompt Injection Rate:   {summary.prompt_injection_success_rate:.1f}%")
    print(f"IDOR Success Rate:       {summary.idor_success_rate:.1f}%")
    print(f"SQL Injection Rate:      {summary.sql_injection_success_rate:.1f}%")
    print(f"Replay Success Rate:     {summary.replay_success_rate:.1f}%")
    print(f"Concurrency Bypass Rate: {summary.concurrency_bypass_rate:.1f}%")
    print(f"Critical Failures:       {len(summary.critical_failures)}")
    print(f"Average Latency:         {summary.average_latency_ms:.2f} ms")
    print(f"Total Duration:          {summary.total_duration_seconds:.2f}s")
    print(f"JSON Report Saved:       {json_path}")
    print(f"Markdown Report Saved:   {md_path}")
    print("------------------------------------------------------------")

    if summary.category_benchmarks:
        print("\nCATEGORY BENCHMARK COMPARISON:")
        print(
            f"{'Category':<18} | {'Total':<5} | {'Base Pass':<9} | {'Sec Pass':<8} | {'Base ASR':<9} | {'Sec ASR':<8}"
        )
        print("-" * 68)
        for cb in summary.category_benchmarks:
            print(
                f"{cb.category:<18} | {cb.total:<5} | {cb.baseline_pass:<9} | {cb.secured_pass:<8} | "
                f"{cb.baseline_attack_success_rate:>7.1f}% | {cb.secured_attack_success_rate:>6.1f}%"
            )
        print("-" * 68)

    if summary.critical_failures:
        print("\n[CRITICAL SECURITY FAILURES DETECTED]:")
        for cf in summary.critical_failures:
            print(f"  - {cf}")
        return 1

    if summary.failed > 0:
        print("\n[FAIL] One or more security tests failed.")
        return 1

    print("\n[PASS] All security tests successfully met security guarantees.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="MCP-Sentinel Phase 8 Automated Security Evaluation & Benchmark Runner"
    )
    parser.add_argument(
        "--mode",
        type=str,
        default="secured",
        choices=["secured", "baseline", "both", "benchmark"],
        help="Evaluation mode (default: secured)",
    )
    parser.add_argument(
        "--category",
        type=str,
        default=None,
        help="Filter by category (e.g. DESTRUCTIVE, PROMPT_INJECTION, WRITE, ALL)",
    )
    parser.add_argument(
        "--test-id",
        type=str,
        default=None,
        help="Execute single test case by ID (e.g. EVAL-DESTRUCT-001)",
    )
    parser.add_argument(
        "--output-json",
        type=str,
        default=None,
        help="Custom output path for JSON report",
    )
    parser.add_argument(
        "--output-md",
        type=str,
        default=None,
        help="Custom output path for Markdown report",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without recording to PostgreSQL security_eval_runs table",
    )

    args = parser.parse_args()
    code = asyncio.run(run_cli(args))
    sys.exit(code)


if __name__ == "__main__":
    main()
