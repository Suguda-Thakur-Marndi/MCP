# Security Evaluation Runners

This directory documents and references the automated runners for the MCP-Sentinel security evaluation framework.

## Primary Benchmark Runner

- **Script**: `scripts/run_security_evaluation.py`
- **Engine Module**: `mcp_sentinel.security.evaluation.engine.SecurityEvaluationEngine`
- **Baseline Module**: `mcp_sentinel.security.evaluation.baseline.BaselineSecurityHarness`

### Invocation Commands

```bash
# Run full benchmark comparing Baseline vs. Secured Agent across 84 scenarios:
python scripts/run_security_evaluation.py --mode benchmark --output eval_results.json

# Run secured system evaluation only:
python scripts/run_security_evaluation.py --mode secured --output eval_results.json

# Run baseline (unmitigated) evaluation only:
python scripts/run_security_evaluation.py --mode baseline --output eval_results.json
```

## Pytest Integration Suite

- **Test Module**: `tests/test_phase10_validation.py`

### Invocation

```bash
pytest tests/test_phase10_validation.py -v
```
