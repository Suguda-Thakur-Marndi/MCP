"""
Human-in-the-Loop Approval Gating and Security Boundary for MCP-Sentinel.
Complies with:
- Security Rule #1: Never trust the AI agent.
- Security Rule #2: Never trust tool annotations as the sole security boundary.
- Security Rule #3: Never trust client-provided approval information (e.g. {"approved": True}).
- Security Rule #7: The MCP server itself must enforce security.
- Security Rule #10: Fail closed for security-sensitive failures.
"""

from typing import Optional

import asyncpg

from mcp_sentinel.security.audit_logger import (
    APPROVAL_REQUIRED,
    APPROVAL_VALIDATION_FAILED,
    log_security_event,
)


class ApprovalGate:
    """
    Enforces server-side authorization checks for destructive actions.
    Guarantees fail-closed behavior across all execution branches.
    """

    @staticmethod
    async def verify_and_consume_ticket(
        conn: asyncpg.Connection,
        ticket_id: str,
        target_id: str,
        action: str = "PURGE",
    ) -> bool:
        """
        Atomically verifies the approval ticket against gating_approval_tickets and marks it consumed.

        Validation requirements:
        1. ticket_id exists.
        2. approved is TRUE.
        3. consumed is FALSE.
        4. action matches (e.g. 'PURGE').
        5. target_id matches str(customer_id).
        6. expires_at is greater than current time (NOW()).

        Returns:
            bool: True if verified and consumed; False otherwise.
        """
        if not ticket_id or not ticket_id.strip():
            log_security_event(
                event_type=APPROVAL_REQUIRED,
                action=action,
                decision="BLOCK",
                risk_classification="CRITICAL",
                success=False,
                error_code="MISSING_APPROVAL_TICKET",
            )
            return False

        clean_ticket = ticket_id.strip()

        # Query and lock the ticket record for atomic verification within a transaction
        query = """
            SELECT approved, consumed, expires_at, action, target_id
            FROM gating_approval_tickets
            WHERE ticket_id = $1
            FOR UPDATE
        """
        row = await conn.fetchrow(query, clean_ticket)

        if not row:
            log_security_event(
                event_type=APPROVAL_VALIDATION_FAILED,
                action=action,
                decision="BLOCK",
                risk_classification="CRITICAL",
                success=False,
                error_code="TICKET_NOT_FOUND",
                details={"ticket_id_prefix": clean_ticket[:8]},
            )
            return False

        # Validate ticket criteria
        if not row["approved"]:
            log_security_event(
                event_type=APPROVAL_VALIDATION_FAILED,
                action=action,
                decision="BLOCK",
                risk_classification="CRITICAL",
                success=False,
                error_code="TICKET_NOT_APPROVED",
                details={"ticket_id_prefix": clean_ticket[:8]},
            )
            return False

        if row["consumed"]:
            log_security_event(
                event_type=APPROVAL_VALIDATION_FAILED,
                action=action,
                decision="BLOCK",
                risk_classification="CRITICAL",
                success=False,
                error_code="TICKET_ALREADY_CONSUMED",
                details={"ticket_id_prefix": clean_ticket[:8]},
            )
            return False

        if row["action"] != action:
            log_security_event(
                event_type=APPROVAL_VALIDATION_FAILED,
                action=action,
                decision="BLOCK",
                risk_classification="CRITICAL",
                success=False,
                error_code="ACTION_MISMATCH",
                details={"expected_action": action, "ticket_action": row["action"]},
            )
            return False

        if str(row["target_id"]) != str(target_id):
            log_security_event(
                event_type=APPROVAL_VALIDATION_FAILED,
                action=action,
                decision="BLOCK",
                risk_classification="CRITICAL",
                success=False,
                error_code="TARGET_MISMATCH",
                details={"expected_target": str(target_id), "ticket_target": str(row["target_id"])},
            )
            return False

        # Check expiration if set
        if row["expires_at"] is not None:
            import datetime

            now = datetime.datetime.now(datetime.UTC)
            if row["expires_at"] < now:
                log_security_event(
                    event_type=APPROVAL_VALIDATION_FAILED,
                    action=action,
                    decision="BLOCK",
                    risk_classification="CRITICAL",
                    success=False,
                    error_code="TICKET_EXPIRED",
                    details={"ticket_id_prefix": clean_ticket[:8]},
                )
                return False

        # Mark ticket as consumed
        consume_query = """
            UPDATE gating_approval_tickets
            SET consumed = TRUE, consumed_at = NOW()
            WHERE ticket_id = $1
        """
        await conn.execute(consume_query, clean_ticket)
        return True

    @staticmethod
    async def check_ticket_validity(
        conn: asyncpg.Connection,
        ticket_id: str,
        target_id: Optional[str] = None,
        action: Optional[str] = None,
    ) -> bool:
        """
        Non-destructive check verifying whether an approval ticket exists, is approved,
        is unconsumed, not expired, and matches action/target if specified.
        """
        if not ticket_id or not ticket_id.strip():
            return False
        clean_ticket = ticket_id.strip()
        query = """
            SELECT approved, consumed, expires_at, action, target_id
            FROM gating_approval_tickets
            WHERE ticket_id = $1
        """
        row = await conn.fetchrow(query, clean_ticket)
        if not row:
            return False
        if not row["approved"] or row["consumed"]:
            return False
        if action and row["action"] != action:
            return False
        if target_id and str(row["target_id"]) != str(target_id):
            return False
        if row["expires_at"] is not None:
            import datetime

            now = datetime.datetime.now(datetime.timezone.utc)
            if row["expires_at"] < now:
                return False
        return True
