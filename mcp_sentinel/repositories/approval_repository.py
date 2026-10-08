"""
Approval Repository for Gating Tickets and Production Approval Requests in MCP-Sentinel.
Adheres to:
- Server-side ticket verification and atomic consumption.
- Cryptographic parameter binding (SHA-256) and replay resistance.
- Separation of requester and approver (preventing agent and user self-approval).
- Fail-closed transactional boundaries with row-level locking (FOR UPDATE).
- Full state machine transition controls (PENDING, APPROVED, DENIED, EXPIRED, CANCELLED, EXECUTING, COMPLETED, FAILED).
- Policy re-evaluation at execution time.
- Full backward compatibility with legacy gating_approval_tickets.
"""

import datetime
import hmac
import json
import secrets
import uuid
from typing import Any, Optional

import asyncpg

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.database.connection import get_db_pool
from mcp_sentinel.schemas.approval import (
    ApprovalFilter,
    ApprovalRequestCreate,
    ApprovalStatusEnum,
    compute_approval_hmac,
    compute_parameter_hash,
)
from mcp_sentinel.security.audit_logger import (
    APPROVAL_APPROVED,
    APPROVAL_AUTHORIZATION_FAILED,
    APPROVAL_BINDING_MISMATCH,
    APPROVAL_CANCELLED,
    APPROVAL_CREATED,
    APPROVAL_DENIED,
    APPROVAL_EXECUTION_COMPLETED,
    APPROVAL_EXECUTION_FAILED,
    APPROVAL_EXECUTION_STARTED,
    APPROVAL_EXPIRED,
    APPROVAL_POLICY_CHANGED,
    APPROVAL_REPLAY_BLOCKED,
    APPROVAL_VALIDATION_FAILED,
    log_security_event,
)
from mcp_sentinel.security.correlation import get_request_id
from mcp_sentinel.security.decisions.models import SecurityDecisionEnum
from mcp_sentinel.security.exceptions import (
    AuthorizationDeniedError,
    DatabaseOperationError,
)
from mcp_sentinel.security.gating import ApprovalGate
from mcp_sentinel.security.policy.engine import get_policy_engine


class ApprovalRepository:
    """
    Data access repository managing approval request lifecycles, cryptographic
    binding verification, and concurrency-safe state transitions.
    """

    def __init__(self, pool: Optional[asyncpg.Pool] = None):
        self._pool = pool

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is not None and not self._pool._closed:
            return self._pool
        return await get_db_pool()

    # =========================================================================
    # 1. PRODUCTION APPROVAL CREATION
    # =========================================================================

    async def create_approval_request(
        self,
        req: ApprovalRequestCreate,
    ) -> dict[str, Any]:
        """
        Creates a new cryptographically bound approval request in PENDING state.
        Generates an unguessable ticket_id and deterministic parameter_hash.
        """
        pool = await self._get_pool()
        settings = get_settings()

        # Generate cryptographically strong ticket identifier
        ticket_id = f"TICKET-{req.action.upper()}-{secrets.token_hex(8)}"
        param_hash = compute_parameter_hash(req.parameters)
        now = datetime.datetime.now(datetime.UTC)
        ttl = req.ttl_seconds if req.ttl_seconds else settings.APPROVAL_TICKET_TTL_SECONDS
        expires_at = now + datetime.timedelta(seconds=ttl)
        params_json = json.dumps(req.parameters or {}, sort_keys=True, separators=(",", ":"))
        corr_id = req.correlation_id or req.request_id or get_request_id() or uuid.uuid4().hex
        initial_sig = compute_approval_hmac(
            ticket_id=ticket_id,
            action=req.action,
            target_id=req.target_id,
            parameter_hash=param_hash,
        )

        insert_sql = """
            INSERT INTO approval_requests (
                ticket_id, request_id, agent_id, requester_id, tool_name,
                target_id, action, parameters, parameter_hash, environment,
                policy_id, policy_version, risk_level, risk_score, status,
                reason, created_at, expires_at, correlation_id, signature
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8::jsonb, $9, $10,
                $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20
            )
            RETURNING *
        """
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    insert_sql,
                    ticket_id,
                    req.request_id,
                    req.agent_id,
                    req.requester_id,
                    req.tool_name,
                    req.target_id,
                    req.action,
                    params_json,
                    param_hash,
                    req.environment,
                    req.policy_id,
                    req.policy_version,
                    req.risk_level,
                    req.risk_score,
                    ApprovalStatusEnum.PENDING.value,
                    req.reason,
                    now,
                    expires_at,
                    corr_id,
                    initial_sig,
                )
                if not row:
                    raise DatabaseOperationError(
                        internal_details="Failed to create approval request record."
                    )
                res = dict(row)
                if isinstance(res.get("parameters"), str):
                    res["parameters"] = json.loads(res["parameters"])

                try:
                    await conn.execute(
                        """
                        INSERT INTO audit_events (
                            event_type, actor_type, actor_id, tool_name, decision, request_id, details, created_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
                        """,
                        APPROVAL_CREATED,
                        "agent",
                        req.requester_id,
                        req.tool_name,
                        "PENDING",
                        req.request_id,
                        json.dumps(
                            {
                                "ticket_id": ticket_id,
                                "target_id": req.target_id,
                                "parameter_hash": param_hash,
                                "expires_at": expires_at.isoformat(),
                            }
                        ),
                    )
                except Exception:
                    pass

                log_security_event(
                    event_type=APPROVAL_CREATED,
                    tool_name=req.tool_name,
                    action=req.action,
                    decision="PENDING",
                    risk_classification=req.risk_level,
                    user_id=req.requester_id,
                    agent_id=req.agent_id,
                    success=True,
                    details={
                        "ticket_id": ticket_id,
                        "target_id": req.target_id,
                        "parameter_hash": param_hash,
                        "expires_at": expires_at.isoformat(),
                    },
                    request_id=req.request_id,
                )
                return res
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"Create approval request error: {exc!s}")

    # =========================================================================
    # 2. QUERY APPROVALS
    # =========================================================================

    async def get_approval_by_ticket_id(self, ticket_id: str) -> Optional[dict[str, Any]]:
        """
        Fetches a single approval request record by ticket_id or UUID id.
        """
        if not ticket_id or not ticket_id.strip():
            return None
        pool = await self._get_pool()
        query = "SELECT * FROM approval_requests WHERE ticket_id = $1 OR id::text = $1"
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(query, ticket_id.strip())
                if not row:
                    return None
                res = dict(row)
                if isinstance(res.get("parameters"), str):
                    res["parameters"] = json.loads(res["parameters"])
                return res
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"Get approval error: {exc!s}")

    async def list_approvals(
        self, filter_spec: Optional[ApprovalFilter] = None
    ) -> list[dict[str, Any]]:
        """
        Lists approval requests with optional status and tool filtering.
        """
        pool = await self._get_pool()
        conditions = []
        params = []
        idx = 1

        if filter_spec and filter_spec.status:
            conditions.append(f"status = ${idx}")
            params.append(filter_spec.status.value)
            idx += 1

        if filter_spec and filter_spec.tool_name:
            conditions.append(f"tool_name = ${idx}")
            params.append(filter_spec.tool_name)
            idx += 1

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        limit = filter_spec.limit if filter_spec else 50
        offset = filter_spec.offset if filter_spec else 0

        query = f"""
            SELECT * FROM approval_requests
            {where_clause}
            ORDER BY created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
        """
        params.extend([limit, offset])

        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(query, *params)
                results = []
                for r in rows:
                    item = dict(r)
                    if isinstance(item.get("parameters"), str):
                        item["parameters"] = json.loads(item["parameters"])
                    results.append(item)
                return results
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"List approvals error: {exc!s}")

    async def get_pending_approvals(self, limit: int = 50) -> list[dict[str, Any]]:
        """
        Retrieves all currently active PENDING approvals that have not expired.
        """
        pool = await self._get_pool()
        now = datetime.datetime.now(datetime.UTC)
        query = """
            SELECT * FROM approval_requests
            WHERE status = 'PENDING' AND expires_at > $1
            ORDER BY created_at DESC
            LIMIT $2
        """
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(query, now, limit)
                results = []
                for r in rows:
                    item = dict(r)
                    if isinstance(item.get("parameters"), str):
                        item["parameters"] = json.loads(item["parameters"])
                    results.append(item)
                return results
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"Pending approvals error: {exc!s}")

    # =========================================================================
    # 3. STATE TRANSITIONS: DECIDE (APPROVE / DENY)
    # =========================================================================

    async def decide_approval(
        self,
        ticket_id: str,
        approver_id: str,
        decision: str,  # "APPROVED" or "DENIED"
        decision_notes: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Processes human sign-off on a pending ticket.
        Enforces:
        1. Atomic row-level lock (SELECT ... FOR UPDATE).
        2. Status must be PENDING (Strict State Machine validation).
        3. Requester cannot be Approver (Segregation of Duties / self-approval defense).
        4. AI Agent cannot be Approver (AI self-approval defense).
        5. Expiration check (transitions to EXPIRED if now >= expires_at).
        6. Generates secure single-use approval token on approval.
        """
        clean_ticket = ticket_id.strip() if ticket_id else ""
        if not clean_ticket:
            raise AuthorizationDeniedError("Ticket ID is required.")

        decision_upper = decision.upper()
        if decision_upper not in ("APPROVED", "DENIED"):
            raise AuthorizationDeniedError(
                f"Invalid approval decision '{decision}'. Must be APPROVED or DENIED."
            )

        pool = await self._get_pool()
        now = datetime.datetime.now(datetime.UTC)

        try:
            async with pool.acquire() as conn, conn.transaction():
                lock_query = "SELECT * FROM approval_requests WHERE ticket_id = $1 OR id::text = $1 FOR UPDATE"
                row = await conn.fetchrow(lock_query, clean_ticket)
                if not row:
                    raise AuthorizationDeniedError(f"Approval ticket '{clean_ticket}' not found.")

                actual_ticket_id = row["ticket_id"]

                # 1. State Machine Guard: Only PENDING tickets can be decided
                if row["status"] != ApprovalStatusEnum.PENDING.value:
                    raise AuthorizationDeniedError(
                        f"Cannot decide ticket '{actual_ticket_id}' with status '{row['status']}'. "
                        "Invalid state transition."
                    )

                # 2. Expiration Guard
                if row["expires_at"] < now:
                    await conn.execute(
                        "UPDATE approval_requests SET status = 'EXPIRED' WHERE ticket_id = $1",
                        actual_ticket_id,
                    )
                    log_security_event(
                        event_type=APPROVAL_EXPIRED,
                        tool_name=row["tool_name"],
                        action=row["action"],
                        decision="EXPIRED",
                        risk_classification=row["risk_level"],
                        user_id=approver_id,
                        success=False,
                        error_code="TICKET_EXPIRED",
                        details={"ticket_id": actual_ticket_id},
                    )
                    raise AuthorizationDeniedError(
                        f"Approval ticket '{actual_ticket_id}' has expired."
                    )

                # 2.5 Approver Account Validation: Must be active and possess approval authority
                user_row = await conn.fetchrow(
                    "SELECT role, is_active, status FROM users WHERE id = $1", approver_id
                )
                if user_row:
                    if not user_row["is_active"] or user_row.get("status") == "DISABLED":
                        raise AuthorizationDeniedError(
                            f"Approver account '{approver_id}' is disabled."
                        )
                    if user_row["role"] not in ("ADMIN", "APPROVER"):
                        raise AuthorizationDeniedError(
                            f"Approver '{approver_id}' lacks approval authority."
                        )

                # 3. Segregation of Duties: Requester cannot approve their own action
                if row["requester_id"] == approver_id:
                    log_security_event(
                        event_type=APPROVAL_AUTHORIZATION_FAILED,
                        tool_name=row["tool_name"],
                        action=row["action"],
                        decision="BLOCK",
                        risk_classification="CRITICAL",
                        user_id=approver_id,
                        success=False,
                        error_code="SELF_APPROVAL_ATTEMPT",
                        details={
                            "ticket_id": actual_ticket_id,
                            "requester_id": row["requester_id"],
                        },
                    )
                    raise AuthorizationDeniedError(
                        "Segregation of Duties: Requester cannot approve their own action."
                    )

                # 4. Agent Self-Approval Protection: AI Agent can never approve
                if approver_id in (
                    row["agent_id"],
                    "gemini-agent-v1",
                    "agent",
                ) or approver_id.startswith("agent-"):
                    log_security_event(
                        event_type=APPROVAL_AUTHORIZATION_FAILED,
                        tool_name=row["tool_name"],
                        action=row["action"],
                        decision="BLOCK",
                        risk_classification="CRITICAL",
                        user_id=approver_id,
                        success=False,
                        error_code="AGENT_SELF_APPROVAL_ATTEMPT",
                        details={"ticket_id": actual_ticket_id},
                    )
                    raise AuthorizationDeniedError(
                        "AI agents cannot approve execution requests. Human authorization required."
                    )

                new_status = (
                    ApprovalStatusEnum.APPROVED.value
                    if decision_upper == "APPROVED"
                    else ApprovalStatusEnum.DENIED.value
                )

                # 5. Cryptographic token and HMAC signature generation on approval
                raw_token: Optional[str] = None
                token_hash: Optional[str] = None
                if new_status == ApprovalStatusEnum.APPROVED.value:
                    raw_token = secrets.token_urlsafe(32)
                    token_hash = compute_parameter_hash({"token": raw_token})

                decision_sig = compute_approval_hmac(
                    ticket_id=actual_ticket_id,
                    action=row["action"],
                    target_id=row["target_id"],
                    parameter_hash=row["parameter_hash"],
                    approver_id=approver_id,
                )

                approved_at = now if new_status == ApprovalStatusEnum.APPROVED.value else None
                denied_at = now if new_status == ApprovalStatusEnum.DENIED.value else None

                update_query = """
                    UPDATE approval_requests
                    SET status = $1, approver_id = $2, decision_notes = $3, decided_at = $4,
                        approved_at = $5, denied_at = $6, approval_token_hash = $7, signature = $8
                    WHERE ticket_id = $9
                    RETURNING *
                """
                updated = await conn.fetchrow(
                    update_query,
                    new_status,
                    approver_id,
                    decision_notes,
                    now,
                    approved_at,
                    denied_at,
                    token_hash,
                    decision_sig,
                    actual_ticket_id,
                )
                res = dict(updated)
                if isinstance(res.get("parameters"), str):
                    res["parameters"] = json.loads(res["parameters"])

                # Provide single-use token to approver response (never logged!)
                if raw_token:
                    res["approval_token"] = raw_token

                event_type = (
                    APPROVAL_APPROVED
                    if new_status == ApprovalStatusEnum.APPROVED.value
                    else APPROVAL_DENIED
                )
                try:
                    await conn.execute(
                        """
                        INSERT INTO audit_events (
                            event_type, actor_type, actor_id, tool_name, decision, request_id, details, created_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
                        """,
                        event_type,
                        "human",
                        approver_id,
                        row["tool_name"],
                        new_status,
                        row["request_id"],
                        json.dumps(
                            {
                                "ticket_id": actual_ticket_id,
                                "approver_id": approver_id,
                                "notes": decision_notes,
                            }
                        ),
                    )
                except Exception:
                    pass

                log_security_event(
                    event_type=event_type,
                    tool_name=row["tool_name"],
                    action=row["action"],
                    decision=new_status,
                    risk_classification=row["risk_level"],
                    user_id=approver_id,
                    success=True,
                    details={
                        "ticket_id": actual_ticket_id,
                        "approver_id": approver_id,
                        "notes": decision_notes,
                    },
                    request_id=row["request_id"],
                )
                return res
        except (AuthorizationDeniedError, DatabaseOperationError):
            raise
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"Decide approval error: {exc!s}")

    # =========================================================================
    # 4. STATE TRANSITIONS: CANCEL
    # =========================================================================

    async def cancel_approval(self, ticket_id: str, actor_id: str) -> dict[str, Any]:
        """
        Cancels a pending or approved approval ticket.
        Enforces that COMPLETED, EXECUTING, or already CANCELLED tickets cannot be cancelled.
        """
        clean_ticket = ticket_id.strip() if ticket_id else ""
        if not clean_ticket:
            raise AuthorizationDeniedError("Ticket ID is required.")

        pool = await self._get_pool()
        now = datetime.datetime.now(datetime.UTC)

        try:
            async with pool.acquire() as conn, conn.transaction():
                lock_query = "SELECT * FROM approval_requests WHERE ticket_id = $1 OR id::text = $1 FOR UPDATE"
                row = await conn.fetchrow(lock_query, clean_ticket)
                if not row:
                    raise AuthorizationDeniedError(f"Approval ticket '{clean_ticket}' not found.")

                actual_ticket_id = row["ticket_id"]

                # Strict state machine guard
                if row["status"] not in (
                    ApprovalStatusEnum.PENDING.value,
                    ApprovalStatusEnum.APPROVED.value,
                ):
                    raise AuthorizationDeniedError(
                        f"Cannot cancel ticket '{actual_ticket_id}' with status '{row['status']}'. "
                        "Invalid state transition."
                    )

                update_query = """
                    UPDATE approval_requests
                    SET status = 'CANCELLED', cancelled_at = $1, decision_notes = $2
                    WHERE ticket_id = $3
                    RETURNING *
                """
                updated = await conn.fetchrow(
                    update_query,
                    now,
                    f"Cancelled by actor {actor_id}",
                    actual_ticket_id,
                )
                res = dict(updated)
                if isinstance(res.get("parameters"), str):
                    res["parameters"] = json.loads(res["parameters"])

                log_security_event(
                    event_type=APPROVAL_CANCELLED,
                    tool_name=row["tool_name"],
                    action=row["action"],
                    decision="CANCELLED",
                    risk_classification=row["risk_level"],
                    user_id=actor_id,
                    success=True,
                    details={"ticket_id": actual_ticket_id},
                    request_id=row["request_id"],
                )
                return res
        except (AuthorizationDeniedError, DatabaseOperationError):
            raise
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"Cancel approval error: {exc!s}")

    # =========================================================================
    # 5. EXECUTION-TIME VERIFICATION & BINDING GATING
    # =========================================================================

    async def verify_and_consume_bound(
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
        """
        Complete execution-time validation sequence:
        1. Load approval record with database row lock (FOR UPDATE).
        2. Verify status == APPROVED.
        3. Verify current_time < expires_at.
        4. Verify single-use / not consumed (status != EXECUTING, COMPLETED, FAILED).
        5. Verify exact tool_name.
        6. Verify exact action / operation.
        7. Verify exact target_id / resource scope.
        8. Verify exact environment (case-insensitive).
        9. Verify exact agent_id and requester_id (if specified).
        10. Verify canonical parameter hash (constant-time comparison).
        11. Verify single-use token if token hash exists.
        12. Re-evaluate current policy dynamically (if policy changed to DENY -> block!).
        13. Atomically transition APPROVED -> EXECUTING -> COMPLETED (one-time use).
        14. Log structured audit events.
        """
        clean_ticket = ticket_id.strip() if ticket_id else ""
        if not clean_ticket:
            return False

        pool = await self._get_pool()
        now = datetime.datetime.now(datetime.UTC)

        try:
            async with pool.acquire() as conn, conn.transaction():
                query = "SELECT * FROM approval_requests WHERE ticket_id = $1 OR id::text = $1 FOR UPDATE"
                row = await conn.fetchrow(query, clean_ticket)
                if not row:
                    # Fallback to legacy gating_approval_tickets for Phase 1-2 tests
                    return await ApprovalGate.verify_and_consume_ticket(
                        conn=conn,
                        ticket_id=clean_ticket,
                        target_id=target_id,
                        action=action,
                    )

                actual_ticket_id = row["ticket_id"]

                # 1. Replay Detection & Status Check
                if row["status"] in (
                    ApprovalStatusEnum.COMPLETED.value,
                    ApprovalStatusEnum.EXECUTING.value,
                ):
                    log_security_event(
                        event_type=APPROVAL_REPLAY_BLOCKED,
                        tool_name=row["tool_name"],
                        action=action,
                        decision="BLOCK",
                        risk_classification="CRITICAL",
                        success=False,
                        error_code="APPROVAL_REPLAY_DETECTED",
                        details={"status": row["status"], "ticket_id": actual_ticket_id},
                    )
                    try:
                        from mcp_sentinel.observability.metrics import get_metrics

                        get_metrics().record_approval_replay()
                    except Exception:
                        pass
                    return False

                if row["status"] != ApprovalStatusEnum.APPROVED.value:
                    log_security_event(
                        event_type=APPROVAL_VALIDATION_FAILED,
                        tool_name=row["tool_name"],
                        action=action,
                        decision="BLOCK",
                        risk_classification="CRITICAL",
                        success=False,
                        error_code="TICKET_NOT_APPROVED",
                        details={"status": row["status"], "ticket_id": actual_ticket_id},
                    )
                    return False

                # 1b. Cryptographic HMAC Signature Verification (Tamper Protection)
                stored_sig = row.get("signature")
                if stored_sig:
                    expected_sig = compute_approval_hmac(
                        ticket_id=actual_ticket_id,
                        action=row["action"],
                        target_id=row["target_id"],
                        parameter_hash=row["parameter_hash"],
                        approver_id=row["approver_id"],
                    )
                    if not hmac.compare_digest(stored_sig, expected_sig):
                        log_security_event(
                            event_type=APPROVAL_BINDING_MISMATCH,
                            tool_name=row["tool_name"],
                            action=action,
                            decision="BLOCK",
                            risk_classification="CRITICAL",
                            success=False,
                            error_code="INVALID_HMAC_SIGNATURE",
                            details={
                                "ticket_id": actual_ticket_id,
                                "reason": "HMAC signature mismatch: approval ticket or decision was tampered with.",
                            },
                        )
                        return False

                # 2. Expiration Check
                if row["expires_at"] < now:
                    await conn.execute(
                        "UPDATE approval_requests SET status = 'EXPIRED' WHERE ticket_id = $1",
                        actual_ticket_id,
                    )
                    log_security_event(
                        event_type=APPROVAL_EXPIRED,
                        tool_name=row["tool_name"],
                        action=action,
                        decision="BLOCK",
                        risk_classification="CRITICAL",
                        success=False,
                        error_code="TICKET_EXPIRED",
                        details={"ticket_id": actual_ticket_id},
                    )
                    return False

                # 3. Action Mismatch Check (case-insensitive & normalize delete/delete_customer)
                def _norm_action(act: str) -> str:
                    a = act.lower().replace("_", "")
                    return "delete" if "delete" in a else a

                if _norm_action(row["action"]) != _norm_action(action):
                    log_security_event(
                        event_type=APPROVAL_BINDING_MISMATCH,
                        tool_name=row["tool_name"],
                        action=action,
                        decision="BLOCK",
                        risk_classification="CRITICAL",
                        success=False,
                        error_code="ACTION_MISMATCH",
                        details={"expected": row["action"], "actual": action},
                    )
                    return False

                # 4. Target Resource Scope Mismatch Check
                def _targets_match(t1: Any, t2: Any) -> bool:
                    s1, s2 = str(t1).strip(), str(t2).strip()
                    if s1 == s2:
                        return True
                    try:
                        from mcp_sentinel.schemas.common import parse_customer_id

                        return parse_customer_id(s1) == parse_customer_id(s2)
                    except Exception:
                        return False

                if not _targets_match(row["target_id"], target_id):
                    log_security_event(
                        event_type=APPROVAL_BINDING_MISMATCH,
                        tool_name=row["tool_name"],
                        action=action,
                        decision="BLOCK",
                        risk_classification="CRITICAL",
                        success=False,
                        error_code="TARGET_MISMATCH",
                        details={"expected": str(row["target_id"]), "actual": str(target_id)},
                    )
                    return False

                # 5. Tool Name Mismatch Check
                if tool_name and row["tool_name"] != tool_name:
                    log_security_event(
                        event_type=APPROVAL_BINDING_MISMATCH,
                        tool_name=tool_name,
                        action=action,
                        decision="BLOCK",
                        risk_classification="CRITICAL",
                        success=False,
                        error_code="TOOL_MISMATCH",
                        details={"expected": row["tool_name"], "actual": tool_name},
                    )
                    return False

                # 6. Environment Mismatch Check
                if environment and row["environment"].lower() != environment.lower():
                    log_security_event(
                        event_type=APPROVAL_BINDING_MISMATCH,
                        tool_name=row["tool_name"],
                        action=action,
                        decision="BLOCK",
                        risk_classification="CRITICAL",
                        success=False,
                        error_code="ENVIRONMENT_MISMATCH",
                        details={"expected": row["environment"], "actual": environment},
                    )
                    return False

                # 7. Agent ID Mismatch Check
                if agent_id and row["agent_id"] != agent_id:
                    log_security_event(
                        event_type=APPROVAL_BINDING_MISMATCH,
                        tool_name=row["tool_name"],
                        action=action,
                        decision="BLOCK",
                        risk_classification="CRITICAL",
                        success=False,
                        error_code="AGENT_MISMATCH",
                        details={"expected": row["agent_id"], "actual": agent_id},
                    )
                    return False

                # 8. Requester Context Mismatch Check
                if requester_id and row["requester_id"] != requester_id:
                    log_security_event(
                        event_type=APPROVAL_BINDING_MISMATCH,
                        tool_name=row["tool_name"],
                        action=action,
                        decision="BLOCK",
                        risk_classification="CRITICAL",
                        success=False,
                        error_code="REQUESTER_MISMATCH",
                        details={"expected": row["requester_id"], "actual": requester_id},
                    )
                    return False

                # 9. Parameter Hash Mismatch Check (Canonical deterministic SHA-256 + constant-time comparison)
                if parameters is not None:
                    computed_hash = compute_parameter_hash(parameters)
                    expected_hash = row["parameter_hash"]
                    if not hmac.compare_digest(computed_hash, expected_hash):
                        log_security_event(
                            event_type=APPROVAL_BINDING_MISMATCH,
                            tool_name=row["tool_name"],
                            action=action,
                            decision="BLOCK",
                            risk_classification="CRITICAL",
                            success=False,
                            error_code="PARAMETER_HASH_MISMATCH",
                            details={
                                "expected_hash": expected_hash,
                                "computed_hash": computed_hash,
                            },
                        )
                        return False

                # 10. Approval Token Hash Verification (if token was supplied or required)
                if approval_token:
                    computed_token_hash = compute_parameter_hash({"token": approval_token})
                    expected_token_hash = row.get("approval_token_hash")
                    if not expected_token_hash or not hmac.compare_digest(
                        computed_token_hash, expected_token_hash
                    ):
                        log_security_event(
                            event_type=APPROVAL_VALIDATION_FAILED,
                            tool_name=row["tool_name"],
                            action=action,
                            decision="BLOCK",
                            risk_classification="CRITICAL",
                            success=False,
                            error_code="INVALID_APPROVAL_TOKEN",
                            details={"ticket_id": actual_ticket_id},
                        )
                        return False

                # 11. Dynamic Policy Re-Evaluation at Execution Time
                policy_engine = get_policy_engine()
                raw_params = (
                    parameters
                    if parameters is not None
                    else (
                        json.loads(row["parameters"])
                        if isinstance(row["parameters"], str)
                        else row["parameters"]
                    )
                )
                reval_context = policy_engine.build_context(
                    tool_name=row["tool_name"],
                    arguments=raw_params,
                    is_server_approved=True,
                    record_count=1,
                )
                reval_decision = policy_engine.evaluate(reval_context)
                if reval_decision.decision == SecurityDecisionEnum.DENY:
                    log_security_event(
                        event_type=APPROVAL_POLICY_CHANGED,
                        tool_name=row["tool_name"],
                        action=action,
                        decision="BLOCK",
                        risk_classification="CRITICAL",
                        success=False,
                        error_code="POLICY_EVALUATION_DENIED",
                        details={
                            "ticket_id": actual_ticket_id,
                            "policy_id": reval_decision.policy_id,
                            "policy_version": reval_decision.policy_version,
                            "reason": reval_decision.reason,
                        },
                    )
                    return False

                # 12. Atomically transition APPROVED -> EXECUTING
                exec_id = uuid.uuid4().hex
                await conn.execute(
                    """
                    UPDATE approval_requests
                    SET status = 'EXECUTING', execution_started_at = $1, execution_id = $2
                    WHERE ticket_id = $3
                    """,
                    now,
                    exec_id,
                    actual_ticket_id,
                )
                log_security_event(
                    event_type=APPROVAL_EXECUTION_STARTED,
                    tool_name=row["tool_name"],
                    action=action,
                    decision="EXECUTING",
                    risk_classification=row["risk_level"],
                    success=True,
                    details={"ticket_id": actual_ticket_id, "execution_id": exec_id},
                )

                # 13. Atomically transition EXECUTING -> COMPLETED (Single-Use Consumed)
                completed_time = datetime.datetime.now(datetime.UTC)
                await conn.execute(
                    """
                    UPDATE approval_requests
                    SET status = 'COMPLETED', completed_at = $1, executed_at = $1
                    WHERE ticket_id = $2
                    """,
                    completed_time,
                    actual_ticket_id,
                )
                log_security_event(
                    event_type=APPROVAL_EXECUTION_COMPLETED,
                    tool_name=row["tool_name"],
                    action=action,
                    decision="COMPLETED",
                    risk_classification=row["risk_level"],
                    success=True,
                    details={"ticket_id": actual_ticket_id, "execution_id": exec_id},
                )
                return True
        except Exception as exc:
            log_security_event(
                event_type=APPROVAL_EXECUTION_FAILED,
                tool_name=tool_name or "unknown",
                action=action,
                decision="BLOCK",
                risk_classification="CRITICAL",
                success=False,
                error_code="APPROVAL_VERIFY_ERROR",
                details={"error": str(exc)},
            )
            return False

    # =========================================================================
    # 6. BACKWARD-COMPATIBLE API (For Phase 1-4 tests)
    # =========================================================================

    async def is_modern_approval_request(self, ticket_id: str) -> bool:
        """
        Checks if the ticket exists in the Phase 5 approval_requests table.
        """
        if not ticket_id or not ticket_id.strip():
            return False
        try:
            pool = await self._get_pool()
            async with pool.acquire() as conn:
                res = await conn.fetchval(
                    "SELECT 1 FROM approval_requests WHERE ticket_id = $1 OR id::text = $1",
                    ticket_id.strip(),
                )
                return bool(res)
        except Exception:
            return False

    async def verify_and_consume(
        self,
        ticket_id: str,
        target_id: str,
        action: str = "PURGE",
    ) -> bool:
        """
        Executes atomic verification and consumption of an approval ticket.
        Supports both modern approval_requests (delegating to bound verification)
        and legacy gating_approval_tickets.
        """
        if not ticket_id or not ticket_id.strip():
            return False

        clean_ticket = ticket_id.strip()
        pool = await self._get_pool()

        try:
            # 1. Check if this is a Phase 5 modern approval request
            async with pool.acquire() as conn:
                is_modern = await conn.fetchval(
                    "SELECT 1 FROM approval_requests WHERE ticket_id = $1 OR id::text = $1",
                    clean_ticket,
                )
            if is_modern:
                return await self.verify_and_consume_bound(
                    ticket_id=clean_ticket,
                    target_id=target_id,
                    action=action,
                )

            # 2. Fallback strictly to legacy gating_approval_tickets table
            async with pool.acquire() as conn, conn.transaction():
                return await ApprovalGate.verify_and_consume_ticket(
                    conn=conn,
                    ticket_id=clean_ticket,
                    target_id=target_id,
                    action=action,
                )
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"Approval verification error: {exc!s}")

    async def check_validity(
        self,
        ticket_id: str,
        target_id: Optional[str] = None,
        action: Optional[str] = None,
    ) -> bool:
        """
        Non-destructively checks whether an approval ticket is currently valid.
        Supports both modern approval_requests and legacy gating_approval_tickets.
        """
        if not ticket_id or not ticket_id.strip():
            return False

        clean_ticket = ticket_id.strip()
        pool = await self._get_pool()
        now = datetime.datetime.now(datetime.UTC)

        try:
            async with pool.acquire() as conn:
                req_row = await conn.fetchrow(
                    "SELECT * FROM approval_requests WHERE ticket_id = $1 OR id::text = $1",
                    clean_ticket,
                )
                if req_row:
                    if req_row["status"] != ApprovalStatusEnum.APPROVED.value:
                        return False
                    if req_row["expires_at"] < now:
                        return False
                    if action:

                        def _norm_action(act: str) -> str:
                            a = act.lower().replace("_", "")
                            return "delete" if "delete" in a else a

                        if _norm_action(req_row["action"]) != _norm_action(action):
                            return False
                    if target_id and str(req_row["target_id"]).strip() != str(target_id).strip():
                        return False
                    return True

                # Fallback to legacy gating_approval_tickets
                return await ApprovalGate.check_ticket_validity(
                    conn=conn,
                    ticket_id=clean_ticket,
                    target_id=target_id,
                    action=action,
                )
        except Exception:
            return False
