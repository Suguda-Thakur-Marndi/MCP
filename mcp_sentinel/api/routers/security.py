"""
Security Evaluation API Router for MCP-Sentinel.
Exposes endpoints to trigger the automated 25-scenario security evaluation framework
and inspect real attack test execution reports.
"""

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from mcp_sentinel.security.auth.dependencies import require_permission
from mcp_sentinel.security.auth.models import AuthUser
from mcp_sentinel.security.auth.rbac import PERM_RUN_SECURITY_EVAL
from mcp_sentinel.security.evaluation.runner import SecurityEvaluationRunner

router = APIRouter(prefix="/api/security", tags=["Security Evaluation"])


class EvalRunRequest(BaseModel):
    include_destructive: bool = True
    record_audit_events: bool = True


@router.post(
    "/eval",
    summary="Trigger real-time security evaluation against live platform",
    dependencies=[Depends(require_permission(PERM_RUN_SECURITY_EVAL))],
)
async def run_security_eval(
    body: EvalRunRequest | None = None,
    current_user: AuthUser = Depends(require_permission(PERM_RUN_SECURITY_EVAL)),
) -> dict[str, Any]:
    """
    Executes the 25 comprehensive security scenarios across READ, WRITE,
    DESTRUCTIVE, ADVERSARIAL, and LIFECYCLE categories against the live platform.
    Returns the real evaluation report.
    """
    try:
        runner = SecurityEvaluationRunner()
        report = await runner.run_all()
        return {
            "status": "success",
            "report": report.to_dict(),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Security evaluation failed to complete: {str(exc)}",
        ) from exc


@router.get(
    "/eval/latest",
    summary="Get latest security evaluation results from disk",
    dependencies=[Depends(require_permission(PERM_RUN_SECURITY_EVAL))],
)
async def get_latest_eval(
    current_user: AuthUser = Depends(require_permission(PERM_RUN_SECURITY_EVAL)),
) -> dict[str, Any]:
    """
    Retrieves the most recent security evaluation report from eval_results.json if it exists.
    """
    results_path = Path("eval_results.json")
    if not results_path.exists():
        # If no previous run, execute one dynamically
        runner = SecurityEvaluationRunner()
        report = await runner.run_all()
        return {
            "status": "success",
            "source": "live_execution",
            "report": report.to_dict(),
        }

    try:
        data = json.loads(results_path.read_text(encoding="utf-8"))
        return {
            "status": "success",
            "source": "saved_results",
            "report": data,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read evaluation results: {str(exc)}",
        ) from exc
