"""
Security Middleware for MCP-Sentinel Phase 4.
Authoritative execution gateway enforcing policy and risk evaluation
before any tool service invocation or database mutation.
"""

import logging
from typing import Any, Optional

from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.schemas.approval import ApprovalRequestCreate
from mcp_sentinel.security.decisions.models import (
    SecurityDecision,
    SecurityDecisionEnum,
)
from mcp_sentinel.security.policy.engine import PolicyEngine, get_policy_engine
from mcp_sentinel.security.risk.factors import get_tool_profile

logger = logging.getLogger("mcp_sentinel.security.middleware")


class SecurityGate:
    """
    Server-side security gate intercepting all MCP tool executions.
    Guarantees that:
    1. The agent/client is never trusted.
    2. Untrusted security fields are purged.
    3. Deterministic risk is calculated server-side.
    4. Destructive tools require verified human approvals via database tokens.
    """

    @staticmethod
    async def evaluate_and_gate(
        tool_name: str,
        raw_args: dict[str, Any],
        policy_engine: Optional[PolicyEngine] = None,
        approval_repo: Optional[ApprovalRepository] = None,
        record_count: Optional[int] = None,
        is_authorized: bool = True,
        actor_has_restricted_access: bool = False,
    ) -> tuple[bool, SecurityDecision, Optional[dict[str, Any]]]:
        """
        Evaluates the tool execution against the Policy Engine.

        Returns:
            tuple[bool, SecurityDecision, Optional[dict[str, Any]]]:
                - bool: True if ALLOWed to execute, False otherwise.
                - SecurityDecision: Complete strongly typed decision.
                - Optional[dict]: Standardized error response if blocked; None if allowed.
        """
        engine = policy_engine or get_policy_engine()
        profile = get_tool_profile(tool_name)
        target_id = str(raw_args.get("customer_id") or raw_args.get("inactivity_days") or "")

        is_high_impact_update = (
            tool_name == "update_customer"
            and str(raw_args.get("status") or "").lower() in ("suspended", "closed", "banned")
        )
        is_approval_needed = bool(profile and profile.destructive) or is_high_impact_update

        # Non-destructively verify server approval if a ticket was provided
        is_server_approved = False
        ticket_id = raw_args.get("approval_ticket")
        if (
            ticket_id
            and isinstance(ticket_id, str)
            and ticket_id.strip()
            and is_approval_needed
        ):
            repo = approval_repo or ApprovalRepository()
            action = "update_customer" if is_high_impact_update else ("DELETE_CUSTOMER" if tool_name == "delete_customer" else "PURGE")
            try:
                is_server_approved = await repo.check_validity(
                    ticket_id=ticket_id,
                    target_id=target_id if target_id else None,
                    action=action,
                )
            except Exception:
                is_server_approved = False

        # Build authoritative PolicyContext (strips all untrusted agent keys)
        context = engine.build_context(
            tool_name=tool_name,
            arguments=raw_args,
            is_server_approved=is_server_approved,
            is_authorized=is_authorized,
            actor_has_restricted_access=actor_has_restricted_access,
            record_count=record_count,
        )

        decision = engine.evaluate(context)

        # Allow execution
        if decision.decision == SecurityDecisionEnum.ALLOW:
            return True, decision, None

        # Block execution with strongly typed error responses
        if decision.decision == SecurityDecisionEnum.REQUIRE_APPROVAL:
            ticket_id = None
            expires_at = None
            ticket_param = raw_args.get("approval_ticket")
            if (
                is_approval_needed
                and (not ticket_param or not str(ticket_param).strip())
            ):
                try:
                    repo = approval_repo or ApprovalRepository()
                    clean_params = {k: v for k, v in raw_args.items() if k != "approval_ticket"}
                    # Authoritative requester identity originates strictly from authenticated context
                    requester_id = context.user_id or "agent-operator"

                    req_obj = ApprovalRequestCreate(
                        request_id=decision.request_id,
                        agent_id=context.agent_id,
                        requester_id=requester_id,
                        tool_name=tool_name,
                        target_id=target_id,
                        action=tool_name,
                        parameters=clean_params,
                        environment=context.environment,
                        policy_id=decision.policy_id,
                        policy_version=decision.policy_version,
                        risk_level=decision.risk_level.value,
                        risk_score=decision.risk_score,
                        reason=str(raw_args.get("reason") or decision.reason),
                    )
                    created_ticket = await repo.create_approval_request(req_obj)
                    if created_ticket:
                        ticket_id = created_ticket.get("ticket_id")
                except Exception as exc:
                    logger.warning(
                        "Failed to auto-create approval ticket in SecurityGate: %s",
                        exc,
                        exc_info=True,
                    )

            resp: dict[str, Any] = {
                "status": "rejected",
                "approval_required": True,
                "error_type": "AuthorizationDeniedError",
                "message": decision.reason,
                "decision": decision.decision.value,
                "tool": tool_name,
                "risk_score": decision.risk_score,
                "risk_level": decision.risk_level.value,
                "policy_id": decision.policy_id,
                "policy_version": decision.policy_version,
                "matched_rules": decision.matched_rules,
                "request_id": decision.request_id,
                "executed": False,
            }
            if ticket_id:
                resp["approval_id"] = ticket_id
                resp["ticket_id"] = ticket_id
            if expires_at:
                resp["expires_at"] = expires_at

            return (False, decision, resp)

        if decision.decision == SecurityDecisionEnum.REQUIRE_MFA:
            return (
                False,
                decision,
                {
                    "status": "rejected",
                    "error_type": "MfaRequiredError",
                    "message": decision.reason,
                    "decision": decision.decision.value,
                    "risk_score": decision.risk_score,
                    "risk_level": decision.risk_level.value,
                    "policy_id": decision.policy_id,
                    "policy_version": decision.policy_version,
                    "matched_rules": decision.matched_rules,
                    "request_id": decision.request_id,
                },
            )

        # DENY or Fail Closed
        return (
            False,
            decision,
            {
                "status": "rejected",
                "error_type": "PolicyViolationError",
                "message": decision.reason,
                "decision": decision.decision.value,
                "risk_score": decision.risk_score,
                "risk_level": decision.risk_level.value,
                "policy_id": decision.policy_id,
                "policy_version": decision.policy_version,
                "matched_rules": decision.matched_rules,
                "request_id": decision.request_id,
            },
        )
