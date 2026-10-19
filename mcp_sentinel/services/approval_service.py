"""
Approval Service for MCP-Sentinel.
High-level service coordinating human-in-the-loop approval workflows,
tamper-evident parameter bindings, and auditable authorization state transitions.
"""

from typing import Any, Optional

from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.audit_repository import AuditRepository
from mcp_sentinel.schemas.approval import (
    ApprovalFilter,
    ApprovalRequestCreate,
)
from mcp_sentinel.security.audit_logger import (
    APPROVAL_REQUIRED,
    log_security_event,
)
from mcp_sentinel.security.correlation import get_request_id


class ApprovalService:
    """
    Coordinates approval creation, review, and verification.
    """

    def __init__(
        self,
        approval_repo: Optional[ApprovalRepository] = None,
        audit_repo: Optional[AuditRepository] = None,
    ):
        self.approval_repo = approval_repo or ApprovalRepository()
        self.audit_repo = audit_repo or AuditRepository()

    async def create_approval(
        self,
        request: ApprovalRequestCreate,
    ) -> dict[str, Any]:
        """
        Creates an approval ticket and logs security audit records.
        """
        result = await self.approval_repo.create_approval_request(request)
        rid = request.request_id or get_request_id()

        log_security_event(
            event_type=APPROVAL_REQUIRED,
            action=request.action,
            decision="PENDING_APPROVAL",
            tool_name=request.tool_name,
            risk_classification=request.risk_level,
            user_id=request.requester_id,
            agent_id=request.agent_id,
            success=True,
            details={
                "ticket_id": result["ticket_id"],
                "target_id": request.target_id,
                "parameter_hash": result["parameter_hash"],
            },
            request_id=rid,
        )
        await self.audit_repo.record_audit_event(
            event_type="APPROVAL_REQUESTED",
            tool_name=request.tool_name,
            decision="PENDING",
            actor_type="agent" if "agent" in request.requester_id.lower() else "user",
            actor_id=request.requester_id,
            request_id=rid,
            details={
                "ticket_id": result["ticket_id"],
                "target_id": request.target_id,
                "risk_score": request.risk_score,
                "reason": request.reason,
            },
        )
        return result

    async def list_approvals(
        self, filter_spec: Optional[ApprovalFilter] = None
    ) -> list[dict[str, Any]]:
        return await self.approval_repo.list_approvals(filter_spec)

    async def get_pending_approvals(self, limit: int = 50) -> list[dict[str, Any]]:
        return await self.approval_repo.get_pending_approvals(limit)

    async def get_approval(self, ticket_id: str) -> Optional[dict[str, Any]]:
        return await self.approval_repo.get_approval_by_ticket_id(ticket_id)

    async def decide_approval(
        self,
        ticket_id: str,
        approver_id: str,
        decision: str,  # "APPROVED" or "DENIED"
        decision_notes: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Records human decision on a ticket and emits audit events.
        """
        result = await self.approval_repo.decide_approval(
            ticket_id=ticket_id,
            approver_id=approver_id,
            decision=decision,
            decision_notes=decision_notes,
        )
        rid = get_request_id() or result.get("request_id")

        log_security_event(
            event_type="APPROVAL_DECISION",
            action=result["action"],
            decision=result["status"],
            tool_name=result["tool_name"],
            risk_classification=result["risk_level"],
            user_id=approver_id,
            success=True,
            details={
                "ticket_id": ticket_id,
                "target_id": result["target_id"],
                "notes": decision_notes,
            },
            request_id=rid,
        )
        await self.audit_repo.record_audit_event(
            event_type="APPROVAL_DECIDED",
            tool_name=result["tool_name"],
            decision=result["status"],
            actor_type="user",
            actor_id=approver_id,
            request_id=rid,
            details={
                "ticket_id": ticket_id,
                "status": result["status"],
                "target_id": result["target_id"],
                "notes": decision_notes,
            },
        )
        return result

    async def cancel_approval(self, ticket_id: str, actor_id: str) -> dict[str, Any]:
        result = await self.approval_repo.cancel_approval(ticket_id, actor_id)
        rid = get_request_id() or result.get("request_id")

        log_security_event(
            event_type="APPROVAL_CANCELLED",
            action=result["action"],
            decision="CANCELLED",
            tool_name=result["tool_name"],
            user_id=actor_id,
            success=True,
            details={"ticket_id": ticket_id},
            request_id=rid,
        )
        await self.audit_repo.record_audit_event(
            event_type="APPROVAL_CANCELLED",
            tool_name=result["tool_name"],
            decision="CANCELLED",
            actor_type="user",
            actor_id=actor_id,
            request_id=rid,
            details={"ticket_id": ticket_id},
        )
        return result

    async def verify_and_consume(
        self,
        ticket_id: str,
        target_id: str,
        action: str,
        tool_name: Optional[str] = None,
        environment: Optional[str] = None,
        parameters: Optional[dict[str, Any]] = None,
        agent_id: Optional[str] = None,
        requester_id: Optional[str] = None,
        approval_token: Optional[str] = None,
    ) -> bool:
        return await self.approval_repo.verify_and_consume_bound(
            ticket_id=ticket_id,
            target_id=target_id,
            action=action,
            tool_name=tool_name,
            environment=environment,
            parameters=parameters,
            agent_id=agent_id,
            requester_id=requester_id,
            approval_token=approval_token,
        )
