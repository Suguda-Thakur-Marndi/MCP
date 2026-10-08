"""
Audit Service for MCP-Sentinel Phase 2.
Business logic layer managing customer audit notes and security logging.
Complies with:
- Treating audit notes as untrusted data.
- Strict input parameterization and validation.
- Correlation tracking using unique request IDs.
"""

from typing import Any, Optional, Union

from mcp_sentinel.repositories.audit_repository import AuditRepository
from mcp_sentinel.schemas.common import parse_customer_id
from mcp_sentinel.security.audit_logger import (
    TOOL_EXECUTED,
    TOOL_REQUESTED,
    log_security_event,
)
from mcp_sentinel.security.correlation import get_request_id
from mcp_sentinel.security.exceptions import SecurityValidationError


class AuditService:
    """
    Coordinates audit note persistence and security event auditing.
    """

    def __init__(self, audit_repo: Optional[AuditRepository] = None):
        self.audit_repo = audit_repo or AuditRepository()

    async def append_customer_audit_note(
        self,
        customer_id: Union[int, str],
        note: str,
        author_id: str = "agent",
    ) -> dict[str, Any]:
        """
        Appends an administrative audit note.
        Input is treated strictly as untrusted data.
        """
        req_id = get_request_id() or "unknown_req"
        try:
            num_id = parse_customer_id(customer_id)
        except ValueError as exc:
            raise SecurityValidationError(str(exc))

        cleaned_note = (note or "").strip()
        if not cleaned_note:
            raise SecurityValidationError("Audit note cannot be empty.")
        if len(cleaned_note) > 2000:
            raise SecurityValidationError("Audit note exceeds maximum length of 2000 characters.")

        log_security_event(
            event_type=TOOL_REQUESTED,
            action="append_customer_audit_note",
            decision="PROCESS",
            tool_name="append_customer_audit_note",
            request_id=req_id,
            details={"customer_id": num_id, "author_id": author_id},
        )

        res = await self.audit_repo.append_audit_note(
            customer_id=num_id,
            author_id=author_id,
            note_text=cleaned_note,
        )

        log_security_event(
            event_type=TOOL_EXECUTED,
            action="append_customer_audit_note",
            decision="COMPLETE",
            tool_name="append_customer_audit_note",
            request_id=req_id,
            details={"note_id": res["note_id"], "customer_id": num_id},
        )
        await self.audit_repo.record_audit_event(
            event_type="NOTE_APPENDED",
            tool_name="append_customer_audit_note",
            decision="ALLOWED",
            request_id=req_id,
            details={"note_id": res["note_id"], "customer_id": num_id},
        )

        return res

    async def get_customer_audit_notes(
        self,
        customer_id: Union[int, str],
    ) -> list[dict[str, Any]]:
        """
        Retrieves administrative audit notes for a customer.
        All returned note contents are demarcated with untrusted data wrappers to prevent stored prompt injection.
        """
        try:
            num_id = parse_customer_id(customer_id)
        except ValueError as exc:
            raise SecurityValidationError(str(exc))
        return await self.audit_repo.get_customer_audit_notes(num_id)

