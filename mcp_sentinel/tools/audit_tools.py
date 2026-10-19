"""
Audit Note Append Tool for MCP-Sentinel Phase 2.
Complies with:
- Treating audit note content strictly as untrusted data.
- Input validation and length bounds.
- Parameterized INSERT and structured security logging.
"""

from typing import Any, Optional

from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.schemas.audit import AppendCustomerAuditNoteInput
from mcp_sentinel.security.audit_logger import (
    INPUT_VALIDATION_FAILED,
    TOOL_ALLOWED,
    TOOL_REQUESTED,
    log_security_event,
)
from mcp_sentinel.security.exceptions import SentinelError
from mcp_sentinel.services.audit_service import AuditService


async def handle_append_customer_audit_note(
    repo_or_args: Any = None,
    raw_args: Optional[dict[str, Any]] = None,
    repo: Optional[CustomerRepository] = None,
    service: Optional[AuditService] = None,
) -> dict[str, Any]:
    """
    Appends an administrative audit note after validating inputs and target customer existence.
    Supports both positional and keyword invocation styles.
    """
    if isinstance(repo_or_args, dict) and raw_args is None:
        actual_raw_args = repo_or_args
    elif raw_args is not None:
        actual_raw_args = raw_args
        if repo_or_args is not None and not isinstance(repo_or_args, dict) and repo is None:
            repo = repo_or_args
    else:
        actual_raw_args = {}

    log_security_event(
        event_type=TOOL_REQUESTED,
        tool_name="append_customer_audit_note",
        action="append_audit_note",
        decision="EVALUATING",
        details={"keys": list(actual_raw_args.keys())},
    )

    try:
        validated = AppendCustomerAuditNoteInput(**actual_raw_args)
    except Exception as exc:
        log_security_event(
            event_type=INPUT_VALIDATION_FAILED,
            tool_name="append_customer_audit_note",
            action="validate_input",
            decision="REJECT",
            success=False,
            error_code="VALIDATION_ERROR",
            details={"error": str(exc)},
        )
        return {
            "status": "error",
            "error_type": "ValidationError",
            "message": f"Input validation failed: {exc!s}",
        }

    try:
        if service is not None:
            return await service.append_customer_audit_note(
                customer_id=validated.customer_id,
                note=validated.note,
                author_id=validated.author_id or "agent",
            )

        if repo is not None:
            res = await repo.append_audit_note(
                customer_id=validated.customer_id,
                author_id=validated.author_id or "agent",
                note_text=validated.note,
            )
        else:
            default_svc = AuditService()
            res = await default_svc.append_customer_audit_note(
                customer_id=validated.customer_id,
                note=validated.note,
                author_id=validated.author_id or "agent",
            )

        log_security_event(
            event_type=TOOL_ALLOWED,
            tool_name="append_customer_audit_note",
            action="append_audit_note",
            decision="ALLOW",
            success=True,
            details={"note_id": res.get("note_id")},
        )
        return res

    except SentinelError as se:
        return se.to_dict()
    except Exception:
        return {
            "status": "error",
            "error_type": "DatabaseError",
            "message": "Unable to complete the requested database operation.",
        }
