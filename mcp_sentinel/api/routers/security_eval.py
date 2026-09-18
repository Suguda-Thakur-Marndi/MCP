"""
Security Evaluation & Benchmark API Router for MCP-Sentinel Phase 8.
Exposes endpoints to trigger versioned automated evaluations across Secured and Baseline agent modes,
inspect individual test evidence, view comparative benchmark metrics, and list registered test scenarios.
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from mcp_sentinel.repositories.eval_repository import SecurityEvalRepository
from mcp_sentinel.security.auth.dependencies import require_permission
from mcp_sentinel.security.auth.models import AuthUser
from mcp_sentinel.security.auth.rbac import PERM_RUN_SECURITY_EVAL
from mcp_sentinel.security.evaluation.dataset import (
    DATASET_VERSION,
    get_dataset,
)
from mcp_sentinel.security.evaluation.engine import SecurityEvaluationEngine

router = APIRouter(prefix="/api/security-tests", tags=["Security Evaluation & Benchmarks"])


class TriggerRunRequest(BaseModel):
    agent_mode: str = Field(
        default="secured",
        description="Execution mode: 'secured', 'baseline', or 'benchmark' (both)",
    )
    category: Optional[str] = Field(
        default=None,
        description="Optional category filter (e.g. 'DESTRUCTIVE', 'PROMPT_INJECTION', 'ALL')",
    )
    test_id: Optional[str] = Field(
        default=None,
        description="Optional specific test ID to execute (e.g. 'EVAL-DESTRUCT-001')",
    )
    dry_run: bool = Field(
        default=False,
        description="If True, executes tests in-memory without database persistence",
    )


@router.post(
    "/runs",
    summary="Trigger automated security evaluation or benchmark run",
    dependencies=[Depends(require_permission(PERM_RUN_SECURITY_EVAL))],
)
async def trigger_evaluation_run(
    body: TriggerRunRequest,
    current_user: AuthUser = Depends(require_permission(PERM_RUN_SECURITY_EVAL)),
) -> dict[str, Any]:
    """
    Executes versioned security evaluation scenarios against the Secured Agent pipeline
    or isolated Baseline harness. Returns detailed KPIs, attack success rates, and side-effect evidence.
    """
    valid_modes = ("secured", "baseline", "benchmark")
    if body.agent_mode.lower() not in valid_modes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid agent_mode '{body.agent_mode}'. Must be one of: {valid_modes}",
        )

    try:
        engine = SecurityEvaluationEngine()
        summary = await engine.run_evaluation(
            agent_mode=body.agent_mode.lower(),
            category=body.category,
            test_id=body.test_id,
            dry_run=body.dry_run,
            record_in_db=not body.dry_run,
        )
        return {
            "status": "success",
            "run_id": summary.run_id,
            "report": summary.to_dict(),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Security evaluation failed to complete: {exc!s}",
        ) from exc


@router.get(
    "/runs",
    summary="List historical security evaluation runs",
    dependencies=[Depends(require_permission(PERM_RUN_SECURITY_EVAL))],
)
async def list_evaluation_runs(
    agent_mode: Optional[str] = Query(
        None, description="Filter by agent mode ('secured', 'baseline')"
    ),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: AuthUser = Depends(require_permission(PERM_RUN_SECURITY_EVAL)),
) -> dict[str, Any]:
    """
    Lists historical security evaluation runs with summary KPIs.
    """
    repo = SecurityEvalRepository()
    runs = await repo.list_runs(agent_mode=agent_mode, limit=limit, offset=offset)
    return {
        "count": len(runs),
        "limit": limit,
        "offset": offset,
        "runs": runs,
    }


@router.get(
    "/runs/{run_id}",
    summary="Get details and KPI summary for a specific evaluation run",
    dependencies=[Depends(require_permission(PERM_RUN_SECURITY_EVAL))],
)
async def get_evaluation_run(
    run_id: str,
    current_user: AuthUser = Depends(require_permission(PERM_RUN_SECURITY_EVAL)),
) -> dict[str, Any]:
    """
    Retrieves full metadata and summary metrics for an evaluation run.
    """
    repo = SecurityEvalRepository()
    run = await repo.get_run(run_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evaluation run '{run_id}' not found.",
        )
    return {"run": run}


@router.get(
    "/runs/{run_id}/results",
    summary="Get individual test scenario results for a specific evaluation run",
    dependencies=[Depends(require_permission(PERM_RUN_SECURITY_EVAL))],
)
async def get_evaluation_results(
    run_id: str,
    category: Optional[str] = Query(None, description="Filter by category"),
    status_filter: Optional[str] = Query(
        None, alias="status", description="Filter by status (PASS, FAIL)"
    ),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: AuthUser = Depends(require_permission(PERM_RUN_SECURITY_EVAL)),
) -> dict[str, Any]:
    """
    Retrieves granular scenario results including actual decisions, attack success, and side-effect evidence.
    """
    repo = SecurityEvalRepository()
    results = await repo.get_results(
        run_id=run_id,
        category=category,
        status=status_filter,
        limit=limit,
        offset=offset,
    )
    return {
        "run_id": run_id,
        "count": len(results),
        "results": results,
    }


@router.get(
    "/summary",
    summary="Get latest comparative benchmark summary (Baseline vs Secured)",
    dependencies=[Depends(require_permission(PERM_RUN_SECURITY_EVAL))],
)
async def get_benchmark_summary(
    current_user: AuthUser = Depends(require_permission(PERM_RUN_SECURITY_EVAL)),
) -> dict[str, Any]:
    """
    Retrieves the latest comparative metrics between Secured Agent and Baseline configurations.
    """
    repo = SecurityEvalRepository()
    latest_secured = await repo.get_latest_run_by_mode("secured")
    latest_baseline = await repo.get_latest_run_by_mode("baseline")

    if not latest_secured:
        # If no previous secured run in DB, execute dynamically
        engine = SecurityEvaluationEngine()
        secured_summary = await engine.run_evaluation(agent_mode="secured")
        latest_secured = secured_summary.to_dict()

    return {
        "dataset_version": DATASET_VERSION,
        "secured_run": latest_secured,
        "baseline_run": latest_baseline,
        "baseline_warning": "INTENTIONALLY WEAK EVALUATION CONFIGURATION",
    }


@router.get(
    "/scenarios",
    summary="List all registered test scenarios in versioned dataset",
    dependencies=[Depends(require_permission(PERM_RUN_SECURITY_EVAL))],
)
async def list_registered_scenarios(
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user: AuthUser = Depends(require_permission(PERM_RUN_SECURITY_EVAL)),
) -> dict[str, Any]:
    """
    Returns metadata for all 56 versioned test cases in security-eval-v1.
    """
    scenarios = get_dataset(category=category)
    return {
        "dataset_version": DATASET_VERSION,
        "count": len(scenarios),
        "scenarios": [s.model_dump(mode="json") for s in scenarios],
    }
