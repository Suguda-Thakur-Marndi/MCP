"""
Phase 10 Security Validation & Acceptance Test Suite for MCP-Sentinel.
Verifies:
- Production Safety Lock fails closed when ENVIRONMENT=production.
- 20-Category Dataset (Categories A through T) schema completeness.
- Evaluation against isolated synthetic database.
- Objective verdict engine (SGR, ASR, FPR, Bypass rates).
- Sanitized report generation (Zero secret leakage).
"""

import urllib.parse

import pytest

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.security.evaluation.dataset import (
    DATASET_VERSION,
    SECURITY_EVALUATION_DATASET,
)
from mcp_sentinel.security.evaluation.engine import SecurityEvaluationEngine
from mcp_sentinel.security.evaluation.models import (
    TestSeverity,
)
from mcp_sentinel.security.evaluation.report import EvaluationReportGenerator
from mcp_sentinel.security.exceptions import SentinelError


def test_dataset_size_and_version():
    """Verify dataset contains minimum 50 cases (actual: 84) and valid version."""
    assert len(SECURITY_EVALUATION_DATASET) >= 50
    assert len(SECURITY_EVALUATION_DATASET) == 84
    assert DATASET_VERSION == "security-eval-phase10"


def test_dataset_covers_all_categories_a_through_t():
    """Verify all 20 canonical categories (A through T) are represented."""
    expected_categories = [
        "CATEGORY_A_READ",
        "CATEGORY_B_WRITE",
        "CATEGORY_C_DESTRUCTIVE",
        "CATEGORY_D_PROMPT_INJECTION",
        "CATEGORY_E_INDIRECT_PROMPT_INJECTION",
        "CATEGORY_F_TOOL_ABUSE",
        "CATEGORY_G_AUTHORIZATION_BYPASS",
        "CATEGORY_H_APPROVAL_BYPASS",
        "CATEGORY_I_IDENTITY_SPOOFING",
        "CATEGORY_J_PRIVILEGE_ESCALATION",
        "CATEGORY_K_RESOURCE_SCOPE_ESCALATION",
        "CATEGORY_L_POLICY_TAMPERING",
        "CATEGORY_M_MCP_SECURITY",
        "CATEGORY_N_SQL_INJECTION",
        "CATEGORY_O_IDOR",
        "CATEGORY_P_ENVIRONMENT_ESCALATION",
        "CATEGORY_Q_REPLAY_LIFECYCLE",
        "CATEGORY_R_CONCURRENCY",
        "CATEGORY_S_AGENT_LOOP_RESOURCE_ABUSE",
        "CATEGORY_T_ERROR_DATA_LEAKAGE",
    ]
    present_categories = {t.category.value for t in SECURITY_EVALUATION_DATASET}
    for cat in expected_categories:
        assert cat in present_categories, f"Missing category: {cat}"


def test_test_case_schema_attributes():
    """Verify test cases contain structured schema metadata."""
    for tc in SECURITY_EVALUATION_DATASET:
        assert tc.test_id and tc.test_id.startswith("EVAL-")
        assert tc.name
        assert tc.category
        assert tc.description
        assert tc.severity in (
            TestSeverity.CRITICAL,
            TestSeverity.HIGH,
            TestSeverity.MEDIUM,
            TestSeverity.LOW,
        )
        assert tc.expected_decision in ("ALLOW", "DENY", "REQUIRE_APPROVAL", "BLOCK")
        assert isinstance(tc.expected_execution, bool)
        assert isinstance(tc.expected_side_effect, bool)
        assert isinstance(tc.input, dict)


def test_production_safety_lock_fails_closed(monkeypatch):
    """Evaluation MUST refuse to run if ENVIRONMENT=production (fail closed)."""
    engine = SecurityEvaluationEngine()
    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(SentinelError) as exc_info:
        engine._verify_production_safety_lock(SECURITY_EVALUATION_DATASET[:1])
    assert "Production Safety Lock engaged" in exc_info.value.safe_message


def test_production_safety_lock_fails_closed_app_env(monkeypatch):
    """Evaluation MUST refuse to run if APP_ENV=production."""
    engine = SecurityEvaluationEngine()
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("APP_ENV", "production")
    with pytest.raises(SentinelError) as exc_info:
        engine._verify_production_safety_lock(SECURITY_EVALUATION_DATASET[:1])
    assert "Production Safety Lock engaged" in exc_info.value.safe_message


@pytest.mark.asyncio
async def test_secured_evaluation_read_category():
    """Executes Category A (Read) in secured mode against isolated eval db."""
    engine = SecurityEvaluationEngine()
    summary = await engine.run_evaluation(
        agent_mode="secured",
        category="CATEGORY_A_READ",
        dry_run=True,
        record_in_db=False,
    )
    assert summary.total_tests == 5
    assert summary.passed == 5
    assert summary.failed == 0
    assert summary.pass_rate == 100.0
    assert len(summary.critical_failures) == 0


@pytest.mark.asyncio
async def test_secured_evaluation_prompt_injection_category():
    """Executes Category D (Prompt Injection) verifying 0% attack success rate."""
    engine = SecurityEvaluationEngine()
    summary = await engine.run_evaluation(
        agent_mode="secured",
        category="CATEGORY_D_PROMPT_INJECTION",
        dry_run=True,
        record_in_db=False,
    )
    assert summary.total_tests == 6
    assert summary.passed == 6
    assert summary.attack_success_rate == 0.0
    assert summary.gating_recall == 100.0


@pytest.mark.asyncio
async def test_report_generation_sanitization(tmp_path):
    """Verifies that generated Markdown and JSON reports sanitize secrets."""
    engine = SecurityEvaluationEngine()
    summary = await engine.run_evaluation(
        agent_mode="secured",
        category="CATEGORY_A_READ",
        dry_run=True,
        record_in_db=False,
    )
    json_path = tmp_path / "test_eval.json"
    md_path = tmp_path / "test_eval.md"

    json_str = EvaluationReportGenerator.to_json(summary, json_path)
    md_str = EvaluationReportGenerator.to_markdown(summary, md_path)

    assert json_path.exists()
    assert md_path.exists()

    # Verify no raw password from database url leaked
    parsed_db = urllib.parse.urlparse(get_settings().DATABASE_URL)
    if parsed_db.password:
        raw_pw = urllib.parse.unquote(parsed_db.password)
        assert raw_pw not in json_str
        assert raw_pw not in md_str
