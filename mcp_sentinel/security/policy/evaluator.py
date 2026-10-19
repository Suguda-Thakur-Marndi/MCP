"""
Rule Evaluator for MCP-Sentinel Phase 4 Policy Engine.
Enforces strict decision precedence: DENY > REQUIRE_MFA > REQUIRE_APPROVAL > ALLOW.
Guarantees fail-closed behavior if no permissive rule matches.
"""

from typing import Optional

from mcp_sentinel.security.decisions.models import (
    SecurityDecision,
    SecurityDecisionEnum,
)
from mcp_sentinel.security.policy.models import (
    PolicyContext,
    PolicyDefinition,
    PolicyRule,
)
from mcp_sentinel.security.risk.models import RiskExplanation

# Precedence mapping (lower rank = higher priority)
_PRECEDENCE_RANK: dict[SecurityDecisionEnum, int] = {
    SecurityDecisionEnum.DENY: 1,
    SecurityDecisionEnum.REQUIRE_MFA: 2,
    SecurityDecisionEnum.REQUIRE_APPROVAL: 3,
    SecurityDecisionEnum.ALLOW: 4,
}


class RuleEvaluator:
    """
    Evaluates policy rules against PolicyContext and RiskExplanation.
    Strictly adheres to security precedence.
    """

    def __init__(self, policy: PolicyDefinition):
        self._policy = policy
        # Sort rules descending by priority
        self._rules = sorted(policy.rules, key=lambda r: r.priority, reverse=True)

    def evaluate(
        self,
        context: PolicyContext,
        risk: RiskExplanation,
    ) -> SecurityDecision:
        """
        Evaluates all rules and renders the final authoritative SecurityDecision.
        """
        matched_rules: list[PolicyRule] = []

        # Find all matching rules
        for rule in self._rules:
            try:
                if rule.matches(context, risk):
                    matched_rules.append(rule)
            except Exception:
                # Any exception in rule evaluation fails closed to DENY
                return SecurityDecision(
                    decision=SecurityDecisionEnum.DENY,
                    reason=f"Rule evaluation failure in '{rule.rule_id}'. Failing closed.",
                    risk_score=risk.clamped_score,
                    risk_level=risk.risk_level,
                    policy_id=self._policy.policy_id,
                    policy_version=self._policy.policy_version,
                    matched_rules=[rule.rule_id, "FAIL_CLOSED_ERROR"],
                    request_id=context.request_id,
                    factors=risk.factors.to_dict(),
                )

        if not matched_rules:
            # Fail closed: No rule explicitly allowed the action
            return SecurityDecision(
                decision=SecurityDecisionEnum.DENY,
                reason="Default deny: No matching policy rule permitted this action.",
                risk_score=risk.clamped_score,
                risk_level=risk.risk_level,
                policy_id=self._policy.policy_id,
                policy_version=self._policy.policy_version,
                matched_rules=["DEFAULT_DENY"],
                request_id=context.request_id,
                factors=risk.factors.to_dict(),
            )

        # Select the highest precedence decision among matched rules
        best_rule: Optional[PolicyRule] = None
        best_rank: int = 999

        for rule in matched_rules:
            rank = _PRECEDENCE_RANK.get(rule.target_decision, 999)
            if rank < best_rank:
                best_rank = rank
                best_rule = rule

        assert best_rule is not None

        return SecurityDecision(
            decision=best_rule.target_decision,
            reason=best_rule.reason,
            risk_score=risk.clamped_score,
            risk_level=risk.risk_level,
            policy_id=self._policy.policy_id,
            policy_version=self._policy.policy_version,
            matched_rules=[r.rule_id for r in matched_rules],
            request_id=context.request_id,
            factors=risk.factors.to_dict(),
        )
