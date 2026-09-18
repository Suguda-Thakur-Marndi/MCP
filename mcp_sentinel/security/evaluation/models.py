"""
Evaluation Data Models for MCP-Sentinel Phase 8 Security Evaluation Framework.
Defines strongly typed test cases, results, benchmark metrics, and execution categories.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ScenarioCategory(str, Enum):
    # Canonical Phase 10 Categories A through T
    CATEGORY_A_READ = "CATEGORY_A_READ"
    CATEGORY_B_WRITE = "CATEGORY_B_WRITE"
    CATEGORY_C_DESTRUCTIVE = "CATEGORY_C_DESTRUCTIVE"
    CATEGORY_D_PROMPT_INJECTION = "CATEGORY_D_PROMPT_INJECTION"
    CATEGORY_E_INDIRECT_PROMPT_INJECTION = "CATEGORY_E_INDIRECT_PROMPT_INJECTION"
    CATEGORY_F_TOOL_ABUSE = "CATEGORY_F_TOOL_ABUSE"
    CATEGORY_G_AUTHORIZATION_BYPASS = "CATEGORY_G_AUTHORIZATION_BYPASS"
    CATEGORY_H_APPROVAL_BYPASS = "CATEGORY_H_APPROVAL_BYPASS"
    CATEGORY_I_IDENTITY_SPOOFING = "CATEGORY_I_IDENTITY_SPOOFING"
    CATEGORY_J_PRIVILEGE_ESCALATION = "CATEGORY_J_PRIVILEGE_ESCALATION"
    CATEGORY_K_RESOURCE_SCOPE_ESCALATION = "CATEGORY_K_RESOURCE_SCOPE_ESCALATION"
    CATEGORY_L_POLICY_TAMPERING = "CATEGORY_L_POLICY_TAMPERING"
    CATEGORY_M_MCP_SECURITY = "CATEGORY_M_MCP_SECURITY"
    CATEGORY_N_SQL_INJECTION = "CATEGORY_N_SQL_INJECTION"
    CATEGORY_O_IDOR = "CATEGORY_O_IDOR"
    CATEGORY_P_ENVIRONMENT_ESCALATION = "CATEGORY_P_ENVIRONMENT_ESCALATION"
    CATEGORY_Q_REPLAY_LIFECYCLE = "CATEGORY_Q_REPLAY_LIFECYCLE"
    CATEGORY_R_CONCURRENCY = "CATEGORY_R_CONCURRENCY"
    CATEGORY_S_AGENT_LOOP_RESOURCE_ABUSE = "CATEGORY_S_AGENT_LOOP_RESOURCE_ABUSE"
    CATEGORY_T_ERROR_DATA_LEAKAGE = "CATEGORY_T_ERROR_DATA_LEAKAGE"

    # Backward-compatible aliases
    READ = "CATEGORY_A_READ"
    WRITE = "CATEGORY_B_WRITE"
    DESTRUCTIVE = "CATEGORY_C_DESTRUCTIVE"
    ADVERSARIAL = "CATEGORY_D_PROMPT_INJECTION"
    PROMPT_INJECTION = "CATEGORY_D_PROMPT_INJECTION"
    INDIRECT_PROMPT_INJECTION = "CATEGORY_E_INDIRECT_PROMPT_INJECTION"
    TOOL_ABUSE = "CATEGORY_F_TOOL_ABUSE"
    AUTHORIZATION = "CATEGORY_G_AUTHORIZATION_BYPASS"
    AUTHORIZATION_BYPASS = "CATEGORY_G_AUTHORIZATION_BYPASS"
    APPROVAL = "CATEGORY_H_APPROVAL_BYPASS"
    APPROVAL_BYPASS = "CATEGORY_H_APPROVAL_BYPASS"
    AUTHENTICATION = "CATEGORY_I_IDENTITY_SPOOFING"
    IDENTITY_SPOOFING = "CATEGORY_I_IDENTITY_SPOOFING"
    PRIVILEGE_ESCALATION = "CATEGORY_J_PRIVILEGE_ESCALATION"
    RESOURCE_SCOPE_ESCALATION = "CATEGORY_K_RESOURCE_SCOPE_ESCALATION"
    POLICY = "CATEGORY_L_POLICY_TAMPERING"
    POLICY_TAMPERING = "CATEGORY_L_POLICY_TAMPERING"
    MCP_SECURITY = "CATEGORY_M_MCP_SECURITY"
    SQL_INJECTION = "CATEGORY_N_SQL_INJECTION"
    IDOR = "CATEGORY_O_IDOR"
    ENVIRONMENT_ESCALATION = "CATEGORY_P_ENVIRONMENT_ESCALATION"
    LIFECYCLE = "CATEGORY_Q_REPLAY_LIFECYCLE"
    REPLAY_LIFECYCLE = "CATEGORY_Q_REPLAY_LIFECYCLE"
    CONCURRENCY = "CATEGORY_R_CONCURRENCY"
    AGENT_LOOP = "CATEGORY_S_AGENT_LOOP_RESOURCE_ABUSE"
    INPUT_VALIDATION = "CATEGORY_S_AGENT_LOOP_RESOURCE_ABUSE"
    DATA_LEAKAGE = "CATEGORY_T_ERROR_DATA_LEAKAGE"
    ERROR_DATA_LEAKAGE = "CATEGORY_T_ERROR_DATA_LEAKAGE"

    @property
    def display_name(self) -> str:
        names = {
            "CATEGORY_A_READ": "Category A — Read Operations",
            "CATEGORY_B_WRITE": "Category B — Normal Write Operations",
            "CATEGORY_C_DESTRUCTIVE": "Category C — Destructive Operations",
            "CATEGORY_D_PROMPT_INJECTION": "Category D — Prompt Injection",
            "CATEGORY_E_INDIRECT_PROMPT_INJECTION": "Category E — Indirect Prompt Injection",
            "CATEGORY_F_TOOL_ABUSE": "Category F — Tool Abuse",
            "CATEGORY_G_AUTHORIZATION_BYPASS": "Category G — Authorization Bypass",
            "CATEGORY_H_APPROVAL_BYPASS": "Category H — Approval Bypass",
            "CATEGORY_I_IDENTITY_SPOOFING": "Category I — Identity Spoofing",
            "CATEGORY_J_PRIVILEGE_ESCALATION": "Category J — Privilege Escalation",
            "CATEGORY_K_RESOURCE_SCOPE_ESCALATION": "Category K — Resource/Scope Escalation",
            "CATEGORY_L_POLICY_TAMPERING": "Category L — Policy Tampering",
            "CATEGORY_M_MCP_SECURITY": "Category M — MCP Security",
            "CATEGORY_N_SQL_INJECTION": "Category N — SQL Injection",
            "CATEGORY_O_IDOR": "Category O — IDOR / Object Authorization",
            "CATEGORY_P_ENVIRONMENT_ESCALATION": "Category P — Environment Escalation",
            "CATEGORY_Q_REPLAY_LIFECYCLE": "Category Q — Replay / Lifecycle",
            "CATEGORY_R_CONCURRENCY": "Category R — Concurrency",
            "CATEGORY_S_AGENT_LOOP_RESOURCE_ABUSE": "Category S — Agent Loop & Resource Abuse",
            "CATEGORY_T_ERROR_DATA_LEAKAGE": "Category T — Error & Data Leakage",
        }
        return names.get(self.value, self.value)


class TestSeverity(str, Enum):
    __test__ = False
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFRASTRUCTURE = "INFRASTRUCTURE"


class TestStatus(str, Enum):
    __test__ = False
    PASS = "PASS"
    FAIL = "FAIL"
    ERROR = "ERROR"
    BLOCKED = "BLOCKED"
    SKIPPED = "SKIPPED"


class AgentMode(str, Enum):
    SECURED = "secured"
    BASELINE = "baseline"
    BENCHMARK = "benchmark"


class TestCase(BaseModel):
    """
    Structured security evaluation test case definition with Phase 10 metadata.
    """

    __test__ = False

    test_id: str
    name: str
    category: ScenarioCategory
    description: str
    severity: TestSeverity = TestSeverity.MEDIUM
    attack_type: str = "NONE"
    dataset_version: str = "security-eval-phase10"
    initial_state: dict[str, Any] = Field(default_factory=dict)
    user_context: dict[str, Any] = Field(default_factory=dict)
    agent_context: dict[str, Any] = Field(default_factory=dict)
    input: dict[str, Any] = Field(default_factory=dict)
    expected_behavior: str
    expected_decision: str = "ALLOW"
    expected_execution: bool = False
    expected_side_effect: bool = False
    expected_policy_decision: Optional[str] = None
    expected_authorization: Optional[str] = None
    expected_approval_state: Optional[str] = None
    expected_db_change: Optional[bool] = None
    expected_http_status: Optional[int] = None
    expected_mcp_behavior: Optional[str] = None
    prerequisites: dict[str, Any] = Field(default_factory=dict)
    cleanup: bool = True
    timeout: float = 15.0
    enabled: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)

    @property
    def id(self) -> str:
        return self.test_id


class TestResult(BaseModel):
    """
    Objective evidence and outcome of an individual security test execution.
    """

    __test__ = False

    run_id: str
    test_id: str
    name: str
    category: ScenarioCategory
    severity: TestSeverity = TestSeverity.MEDIUM
    agent_mode: str = "secured"
    status: TestStatus = TestStatus.PASS
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    duration_ms: float = 0.0
    actual_decision: str
    expected_decision: str
    attack_success: bool = False
    side_effect_detected: bool = False
    approval_required: bool = False
    approval_used: bool = False
    policy_decision: Optional[str] = None
    risk_score: Optional[int] = None
    error_type: Optional[str] = None
    error_message_safe: Optional[str] = None
    evidence: dict[str, Any] = Field(default_factory=dict)
    trace_id: Optional[str] = None
    request_id: Optional[str] = None

    # Backward-compatible property getters for legacy consumers
    @property
    def passed(self) -> bool:
        return self.status == TestStatus.PASS

    @property
    def scenario_id(self) -> str:
        return self.test_id

    @property
    def latency_ms(self) -> float:
        return self.duration_ms

    @property
    def db_integrity_verified(self) -> bool:
        return not self.side_effect_detected if not self.attack_success else False


class CategoryBenchmark(BaseModel):
    """
    Per-category comparative metrics between baseline and secured agent modes.
    """

    category: str
    total: int = 0
    baseline_pass: int = 0
    secured_pass: int = 0
    baseline_attack_success: int = 0
    secured_attack_success: int = 0
    baseline_attack_success_rate: float = 0.0
    secured_attack_success_rate: float = 0.0
    gating_recall: float = 100.0


class BenchmarkSummary(BaseModel):
    """
    Complete evaluation run summary including high-level metrics and benchmark comparison.
    """

    run_id: str
    dataset_version: str = "security-eval-phase10"
    environment: str = "development"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    agent_mode: str = "secured"
    total_tests: int = 0
    passed: int = 0
    failed: int = 0
    errors: int = 0
    blocked: int = 0
    skipped: int = 0
    pass_rate: float = 0.0
    attack_attempts: int = 0
    attack_successes: int = 0
    attack_success_rate: float = 0.0
    gating_recall: float = 0.0
    false_positive_rate: float = 0.0
    approval_bypass_rate: float = 0.0
    authorization_bypass_rate: float = 0.0
    prompt_injection_success_rate: float = 0.0
    idor_success_rate: float = 0.0
    sql_injection_success_rate: float = 0.0
    replay_success_rate: float = 0.0
    concurrency_bypass_rate: float = 0.0
    critical_failures: list[str] = Field(default_factory=list)
    regressions: list[str] = Field(default_factory=list)
    category_benchmarks: list[CategoryBenchmark] = Field(default_factory=list)
    total_duration_seconds: float = 0.0
    average_latency_ms: float = 0.0
    results: list[TestResult] = Field(default_factory=list)

    # Backward compatibility properties for Phase 5 frontend/APIs
    @property
    def total_scenarios(self) -> int:
        return self.total_tests

    @property
    def passed_scenarios(self) -> int:
        return self.passed

    @property
    def failed_scenarios(self) -> int:
        return self.failed

    def to_dict(self) -> dict[str, Any]:
        """
        Dumps model to dictionary adhering to both Phase 8/10 and legacy frontend formats.
        """
        data = self.model_dump(mode="json")
        data["total_scenarios"] = self.total_tests
        data["passed_scenarios"] = self.passed
        data["failed_scenarios"] = self.failed
        data["summary"] = {
            "total": self.total_tests,
            "passed": self.passed,
            "failed": self.failed,
            "pass_rate": self.pass_rate,
            "duration_seconds": self.total_duration_seconds,
            "average_latency_ms": self.average_latency_ms,
            "attack_attempts": self.attack_attempts,
            "attack_successes": self.attack_successes,
            "attack_success_rate": self.attack_success_rate,
            "gating_recall": self.gating_recall,
            "false_positive_rate": self.false_positive_rate,
            "approval_bypass_rate": self.approval_bypass_rate,
            "authorization_bypass_rate": self.authorization_bypass_rate,
            "prompt_injection_success_rate": self.prompt_injection_success_rate,
            "idor_success_rate": self.idor_success_rate,
            "sql_injection_success_rate": self.sql_injection_success_rate,
            "replay_success_rate": self.replay_success_rate,
            "concurrency_bypass_rate": self.concurrency_bypass_rate,
        }
        return data


# Maintain type alias for legacy imports
SecurityScenario = TestCase
EvaluationResult = TestResult
EvaluationSummary = BenchmarkSummary
