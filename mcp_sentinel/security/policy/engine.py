"""
Policy Engine for MCP-Sentinel Phase 4.
Authoritative evaluation engine orchestrating risk assessment, rule evaluation,
and security audit logging.
"""

from typing import Any, Optional

from mcp_sentinel.config.settings import Settings, get_settings
from mcp_sentinel.security.audit_logger import POLICY_DECISION, log_security_event
from mcp_sentinel.security.auth.context import get_current_user_context
from mcp_sentinel.security.auth.models import AuthUser, UserRoleEnum
from mcp_sentinel.security.auth.rbac import get_user_permissions
from mcp_sentinel.security.correlation import get_request_id
from mcp_sentinel.security.decisions.models import (
    RiskLevelEnum,
    SecurityDecision,
    SecurityDecisionEnum,
)
from mcp_sentinel.security.policy.defaults import get_default_policy
from mcp_sentinel.security.policy.evaluator import RuleEvaluator
from mcp_sentinel.security.policy.models import PolicyContext, PolicyDefinition
from mcp_sentinel.schemas.common import HIGH_IMPACT_CUSTOMER_STATUSES
from mcp_sentinel.security.risk.engine import RiskEngine
from mcp_sentinel.security.risk.factors import get_tool_profile
from mcp_sentinel.security.risk.models import DataSensitivityEnum, RiskExplanation

# Disallowed client/agent-supplied fields that must NEVER influence security decisions
UNTRUSTED_SECURITY_FIELDS = {
    "risk",
    "risk_score",
    "risk_level",
    "approved",
    "is_approved",
    "environment",
    "is_admin",
    "bypass_policy",
    "decision",
    "authorization",
    "user_id",
    "role",
    "user_role",
    "permissions",
    "requester_id",
}

TOOL_REQUIRED_PERMISSIONS: dict[str, str] = {
    "query_customer_records": "customer:read",
    "get_customer": "customer:read",
    "update_customer": "customer:write",
    "delete_customer": "customer:delete",
    "purge_inactive_customer_data": "customer:purge",
    "get_order": "order:read",
    "get_customer_orders": "order:read",
    "append_customer_audit_note": "customer:write",
}


class PolicyEngine:
    """
    Authoritative server-side Policy Engine.
    Evaluates execution requests, computes deterministic risk, and renders binding decisions.
    """

    def __init__(
        self,
        policy: Optional[PolicyDefinition] = None,
        risk_engine: Optional[RiskEngine] = None,
        settings: Optional[Settings] = None,
    ):
        self._settings = settings or get_settings()
        self._policy = policy or get_default_policy()
        self._risk_engine = risk_engine or RiskEngine(settings=self._settings)
        self._evaluator = RuleEvaluator(self._policy)

    @property
    def policy_id(self) -> str:
        return self._policy.policy_id

    @property
    def policy_version(self) -> str:
        return self._policy.policy_version

    def build_context(
        self,
        tool_name: str,
        arguments: Optional[dict[str, Any]] = None,
        request_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        is_server_approved: bool = False,
        is_authorized: bool = True,
        actor_has_restricted_access: bool = False,
        record_count: Optional[int] = None,
        resource_id: Optional[str] = None,
        user: Optional[AuthUser] = None,
    ) -> PolicyContext:
        """
        Constructs a trusted PolicyContext.
        Actively discards and ignores any untrusted security fields passed in arguments.
        Binds authoritative user identity from the security principal context.
        Derives operational metadata from the trusted server-side tool profile.
        """
        rid = request_id or get_request_id()
        aid = agent_id or self._settings.AGENT_ID
        profile = get_tool_profile(tool_name)

        # Sanitize arguments: strip untrusted security claims
        clean_args = {
            k: v for k, v in (arguments or {}).items() if k.lower() not in UNTRUSTED_SECURITY_FIELDS
        }

        # Resolve record count: profile or arguments or default 1
        count = 1
        if record_count is not None:
            count = record_count
        elif "limit" in clean_args and isinstance(clean_args["limit"], int):
            count = clean_args["limit"]

        # Resolve target resource ID
        target_id = resource_id
        if not target_id:
            for id_key in ("customer_id", "order_id"):
                if id_key in clean_args:
                    target_id = str(clean_args[id_key])
                    break

        destructive = profile.destructive if profile else False
        if tool_name == "update_customer":
            tgt_status = str(clean_args.get("status") or "").lower()
            if tgt_status in HIGH_IMPACT_CUSTOMER_STATUSES:
                destructive = True
        external_side_effect = profile.external_side_effect if profile else False
        data_sens = profile.data_sensitivity if profile else DataSensitivityEnum.CONFIDENTIAL
        operation = profile.operation_type if profile else "unknown"
        resource = profile.resource_type if profile else "unknown"

        # Integrate authenticated human user context
        current_user = user or get_current_user_context()
        user_id = None
        user_role = None
        user_permissions: list[str] = []
        user_org = None

        if current_user:
            user_id = current_user.id
            user_role = current_user.role.value
            user_permissions = get_user_permissions(current_user)
            user_org = current_user.organization

            # Check explicit permission for tool
            req_perm = TOOL_REQUIRED_PERMISSIONS.get(tool_name)
            if req_perm and req_perm not in user_permissions and not is_server_approved:
                is_authorized = False

            # VIEWER role is strictly forbidden from executing writes or destructive actions
            if current_user.role == UserRoleEnum.VIEWER and (
                destructive or external_side_effect or operation != "read"
            ):
                is_authorized = False

        return PolicyContext(
            request_id=rid,
            agent_id=aid,
            actor_type="agent",
            tool_name=tool_name,
            operation=operation,
            resource=resource,
            resource_id=target_id,
            environment=self._settings.APP_ENV,
            data_sensitivity=data_sens,
            record_count=count,
            destructive=destructive,
            external_side_effect=external_side_effect,
            is_authorized=is_authorized,
            is_server_approved=is_server_approved,
            actor_has_restricted_access=actor_has_restricted_access,
            user_id=user_id,
            user_role=user_role,
            user_permissions=user_permissions,
            user_organization=user_org,
        )

    def evaluate(
        self,
        context: PolicyContext,
        risk: Optional[RiskExplanation] = None,
    ) -> SecurityDecision:
        """
        Executes the policy evaluation workflow:
        1. Context validation (Fail closed if malformed)
        2. Risk calculation (Deterministic 0–100 score)
        3. Rule evaluation adhering to strict precedence
        4. Structured audit logging
        """
        # Guard: Check for missing context
        if not context or not context.tool_name:
            fail_decision = SecurityDecision(
                decision=SecurityDecisionEnum.DENY,
                reason="Security context is missing or invalid. Failing closed.",
                risk_score=100,
                risk_level=RiskLevelEnum.CRITICAL,
                policy_id=self._policy.policy_id,
                policy_version=self._policy.policy_version,
                matched_rules=["RULE-006"],
                request_id=context.request_id if context else get_request_id(),
                factors={"error": "missing_context"},
            )
            self._log_decision(context, fail_decision)
            return fail_decision

        # Calculate risk deterministically if not supplied
        risk_assessment = risk or self._risk_engine.assess_risk(
            tool_name=context.tool_name,
            record_count=context.record_count,
            environment=context.environment,
            override_destructive=context.destructive,
            override_sensitivity=context.data_sensitivity,
        )

        decision = self._evaluator.evaluate(context, risk_assessment)
        self._log_decision(context, decision)
        return decision

    def _log_decision(self, context: Optional[PolicyContext], decision: SecurityDecision) -> None:
        """Emits structured audit log event for every policy decision."""
        tool_name = context.tool_name if context else "unknown"
        action = context.operation if context else "unknown"
        rid = context.request_id if context else decision.request_id
        aid = context.agent_id if context else self._settings.AGENT_ID

        log_security_event(
            event_type=POLICY_DECISION,
            tool_name=tool_name,
            action=action,
            decision=decision.decision.value,
            risk_classification=decision.risk_level.value,
            agent_id=aid,
            success=(decision.decision == SecurityDecisionEnum.ALLOW),
            request_id=rid,
            details=decision.to_audit_dict(),
        )

        try:
            from mcp_sentinel.observability.metrics import get_metrics

            get_metrics().record_policy_decision(
                tool_name=tool_name,
                decision=decision.decision.value,
                risk_level=decision.risk_level.value,
            )
        except Exception:
            pass


# Global default instance
_policy_engine: Optional[PolicyEngine] = None


def get_policy_engine() -> PolicyEngine:
    """Returns singleton PolicyEngine instance."""
    global _policy_engine
    if _policy_engine is None:
        _policy_engine = PolicyEngine()
    return _policy_engine


def reset_policy_engine_for_testing(new_engine: Optional[PolicyEngine] = None) -> None:
    """Resets singleton PolicyEngine for testing."""
    global _policy_engine
    _policy_engine = new_engine
