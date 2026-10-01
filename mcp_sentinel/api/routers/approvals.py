"""
Approvals API Router for MCP-Sentinel.
Manages the complete lifecycle of Human-in-the-Loop approval gating requests.
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from mcp_sentinel.schemas.approval import (
    ApprovalDecisionInput,
    ApprovalFilter,
    ApprovalRequestCreate,
    ApprovalResponse,
    ApprovalStatusEnum,
)
from mcp_sentinel.security.auth.dependencies import (
    get_current_user,
    require_roles,
)
from mcp_sentinel.security.auth.models import AuthUser, UserRoleEnum
from mcp_sentinel.security.exceptions import AuthorizationDeniedError
from mcp_sentinel.services.approval_service import ApprovalService

router = APIRouter(prefix="/api/approvals", tags=["Approvals"])

_approval_service: Optional[ApprovalService] = None


def get_approval_service() -> ApprovalService:
    global _approval_service
    if _approval_service is None:
        _approval_service = ApprovalService()
    return _approval_service


@router.post(
    "",
    response_model=ApprovalResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new human approval request ticket",
)
async def create_approval(
    req: ApprovalRequestCreate,
    current_user: AuthUser = Depends(get_current_user),
    service: ApprovalService = Depends(get_approval_service),
) -> Any:
    """Creates a new pending approval ticket bound cryptographically to execution parameters."""
    import uuid

    if not req.request_id:
        req.request_id = f"REQ-{uuid.uuid4().hex[:12].upper()}"
    # Authoritative requester identity is derived strictly from the authenticated user
    req.requester_id = current_user.id
    return await service.create_approval(req)


@router.get(
    "/pending",
    response_model=list[ApprovalResponse],
    summary="List all currently active pending approval requests",
)
async def list_pending_approvals(
    limit: int = Query(default=50, ge=1, le=100),
    current_user: AuthUser = Depends(get_current_user),
    service: ApprovalService = Depends(get_approval_service),
) -> Any:
    """Returns pending approvals awaiting human sign-off."""
    return await service.get_pending_approvals(limit=limit)


@router.get(
    "",
    response_model=list[ApprovalResponse],
    summary="List approval tickets with optional status filtering",
)
async def list_approvals(
    status_filter: Optional[ApprovalStatusEnum] = Query(None, alias="status"),
    tool_name: Optional[str] = Query(None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: AuthUser = Depends(get_current_user),
    service: ApprovalService = Depends(get_approval_service),
) -> Any:
    """Returns paginated approval records."""
    f = ApprovalFilter(
        status=status_filter,
        tool_name=tool_name,
        limit=limit,
        offset=offset,
    )
    return await service.list_approvals(f)


@router.get(
    "/{ticket_id}",
    response_model=ApprovalResponse,
    summary="Get single approval request by ticket ID",
)
async def get_approval(
    ticket_id: str,
    current_user: AuthUser = Depends(get_current_user),
    service: ApprovalService = Depends(get_approval_service),
) -> Any:
    record = await service.get_approval(ticket_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Approval ticket '{ticket_id}' was not found.",
        )
    return record


def _handle_approval_error(ade: AuthorizationDeniedError) -> None:
    msg = ade.safe_message.lower()
    if "not found" in msg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ade.safe_message,
        )
    if (
        "invalid state transition" in msg
        or "cannot decide" in msg
        or "cannot cancel" in msg
        or "expired" in msg
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ade.safe_message,
        )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=ade.safe_message,
    )


@router.post(
    "/{ticket_id}/approve",
    response_model=ApprovalResponse,
    summary="Approve a pending approval ticket",
)
async def approve_ticket(
    ticket_id: str,
    body: Optional[ApprovalDecisionInput] = None,
    current_user: AuthUser = Depends(require_roles(UserRoleEnum.ADMIN, UserRoleEnum.APPROVER)),
    service: ApprovalService = Depends(get_approval_service),
) -> Any:
    """
    Authorizes a pending ticket.
    Enforces that the approver cannot be the requester (self-approval defense).
    """
    notes = body.decision_notes if body else None
    try:
        return await service.decide_approval(
            ticket_id=ticket_id,
            approver_id=current_user.id,
            decision="APPROVED",
            decision_notes=notes,
        )
    except AuthorizationDeniedError as ade:
        _handle_approval_error(ade)


@router.post(
    "/{ticket_id}/deny",
    response_model=ApprovalResponse,
    summary="Deny a pending approval ticket",
)
@router.post(
    "/{ticket_id}/reject",
    response_model=ApprovalResponse,
    summary="Reject a pending approval ticket",
)
async def deny_ticket(
    ticket_id: str,
    body: Optional[ApprovalDecisionInput] = None,
    current_user: AuthUser = Depends(require_roles(UserRoleEnum.ADMIN, UserRoleEnum.APPROVER)),
    service: ApprovalService = Depends(get_approval_service),
) -> Any:
    notes = body.decision_notes if body else None
    try:
        return await service.decide_approval(
            ticket_id=ticket_id,
            approver_id=current_user.id,
            decision="DENIED",
            decision_notes=notes,
        )
    except AuthorizationDeniedError as ade:
        _handle_approval_error(ade)


@router.post(
    "/{ticket_id}/cancel",
    response_model=ApprovalResponse,
    summary="Cancel a pending approval ticket",
)
async def cancel_ticket(
    ticket_id: str,
    current_user: AuthUser = Depends(get_current_user),
    service: ApprovalService = Depends(get_approval_service),
) -> Any:
    try:
        return await service.cancel_approval(
            ticket_id=ticket_id,
            actor_id=current_user.id,
        )
    except AuthorizationDeniedError as ade:
        _handle_approval_error(ade)
