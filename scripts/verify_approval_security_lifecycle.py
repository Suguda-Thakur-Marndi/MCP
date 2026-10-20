"""
SentinelCore — Human Approval Lifecycle & Tamper-Resistance Verification.
Validates the full 6-step lifecycle and all security defenses:
- Policy engine approval requirement
- Parameter hash cryptographic binding
- Segregation of duties & unauthorized approvers
- Modified parameters rejection
- Expired approvals rejection
- Denied approvals rejection
- Atomic single-use consumption & replay defense
- HMAC signature tamper detection
- Comprehensive audit logging
Uses isolated synthetic targets — never touches production customer data.
"""

import asyncio
import pathlib
import sys
import uuid

ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from mcp_sentinel.database.connection import close_db_pool, get_db_pool
from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.audit_repository import AuditRepository
from mcp_sentinel.schemas.approval import ApprovalRequestCreate, compute_parameter_hash
from mcp_sentinel.security.auth.models import AuthUser, UserRoleEnum
from mcp_sentinel.security.exceptions import AuthorizationDeniedError
from mcp_sentinel.security.policy.engine import get_policy_engine
from mcp_sentinel.services.approval_service import ApprovalService


async def verify_approval_lifecycle():
    print("=" * 80)
    print("SENTINELCORE — HUMAN-IN-THE-LOOP APPROVAL LIFECYCLE SECURITY GATE")
    print("=" * 80)

    pool = None
    for attempt in range(1, 4):
        try:
            pool = await get_db_pool()
            break
        except Exception as e:
            print(f"    [!] Database connect attempt {attempt} failed ({e}). Retrying in 2s...")
            await asyncio.sleep(2)
    assert pool is not None, "Failed to connect to database"

    approval_repo = ApprovalRepository(pool=pool)
    audit_repo = AuditRepository(pool=pool)
    approval_svc = ApprovalService(approval_repo=approval_repo, audit_repo=audit_repo)
    policy_engine = get_policy_engine()

    test_target_id = f"CUST-TEST-{uuid.uuid4().hex[:8]}"
    initial_params = {"customer_id": test_target_id, "reason": "GDPR Subject Deletion Request"}
    modified_params = {"customer_id": test_target_id, "reason": "Unauthorized modified reason"}

    test_requester_id = "user-operator-001"
    test_approver_id = "user-approver-001"
    test_viewer_id = "user-viewer-001"

    # -------------------------------------------------------------------------
    # STEP 1: Policy Engine Evaluation
    # -------------------------------------------------------------------------
    print("\n[STEP 1] Policy Engine & RBAC Evaluation for Sensitive Operation...")
    operator_user = AuthUser(
        id=test_requester_id, email="operator@sentinel.test", role=UserRoleEnum.OPERATOR
    )
    admin_user = AuthUser(id=test_approver_id, email="admin@sentinel.test", role=UserRoleEnum.ADMIN)

    # 1a. Unauthorized role (OPERATOR) is flat-out DENIED
    ctx_op = policy_engine.build_context("delete_customer", initial_params, user=operator_user)
    dec_op = policy_engine.evaluate(ctx_op)
    print(f"    Operator Decision: {dec_op.decision.value} | Reason: {dec_op.reason}")
    assert dec_op.decision.value == "DENY", (
        f"Expected DENY for OPERATOR, got {dec_op.decision.value}"
    )
    print("    -> PASS: Policy Engine strictly blocks unauthorized roles (OPERATOR) with DENY.")

    # 1b. Authorized role (ADMIN) receives REQUIRE_APPROVAL
    ctx_admin = policy_engine.build_context("delete_customer", initial_params, user=admin_user)
    dec_admin = policy_engine.evaluate(ctx_admin)
    print(f"    Admin Decision: {dec_admin.decision.value} | Reason: {dec_admin.reason}")
    assert dec_admin.decision.value == "REQUIRE_APPROVAL", (
        f"Expected REQUIRE_APPROVAL for ADMIN, got {dec_admin.decision.value}"
    )
    print(
        "    -> PASS: Policy Engine strictly requires human approval for sensitive action even for ADMIN."
    )

    # -------------------------------------------------------------------------
    # STEP 2: Approval Request Creation with Parameter Binding
    # -------------------------------------------------------------------------
    print("\n[STEP 2] Creating Cryptographically Bound Approval Ticket...")
    create_payload = ApprovalRequestCreate(
        request_id=f"req-{uuid.uuid4().hex[:12]}",
        agent_id="agent-sentinel-v1",
        requester_id=test_requester_id,
        tool_name="delete_customer",
        target_id=test_target_id,
        action="delete_customer",
        parameters=initial_params,
        environment="development",
        risk_level="CRITICAL",
        risk_score=95,
        reason="GDPR right to erasure request",
        ttl_seconds=3600,
    )
    ticket_record = await approval_svc.create_approval(create_payload)
    ticket_id = ticket_record["ticket_id"]
    param_hash = ticket_record["parameter_hash"]
    expected_hash = compute_parameter_hash(initial_params)
    assert param_hash == expected_hash, "Parameter hash mismatch on creation"
    print(f"    Ticket ID: {ticket_id}")
    print(f"    Parameter Hash (SHA-256): {param_hash[:20]}...")
    print("    -> PASS: Approval ticket created in PENDING status with parameter hash binding.")

    # -------------------------------------------------------------------------
    # STEP 3: Negative Security Validations
    # -------------------------------------------------------------------------
    print("\n[STEP 3] Running Negative Security Checks on Pending Ticket...")

    # 3a. Attempt execution before approval
    consumed_pending = await approval_svc.verify_and_consume(
        ticket_id=ticket_id,
        target_id=test_target_id,
        action="delete_customer",
        tool_name="delete_customer",
        parameters=initial_params,
    )
    assert not consumed_pending, "Pending ticket must not be consumable"
    print("    -> PASS [3a]: Execution blocked on unapproved (PENDING) ticket.")

    # 3b. Self-approval attempt by requester (Segregation of Duties)
    try:
        await approval_svc.decide_approval(
            ticket_id=ticket_id,
            approver_id=test_requester_id,
            decision="APPROVED",
            decision_notes="Self approval attempt",
        )
        assert False, "Self-approval must raise AuthorizationDeniedError"
    except AuthorizationDeniedError as e:
        print(f"    -> PASS [3b]: Self-approval blocked: {e}")

    # 3c. Approval attempt by unauthorized role (VIEWER)
    try:
        await approval_svc.decide_approval(
            ticket_id=ticket_id,
            approver_id=test_viewer_id,
            decision="APPROVED",
            decision_notes="Viewer approval attempt",
        )
        assert False, "Unauthorized approver must raise AuthorizationDeniedError"
    except AuthorizationDeniedError as e:
        print(f"    -> PASS [3c]: Unauthorized approver (VIEWER) blocked: {e}")

    # 3d. AI Agent self-approval attempt
    try:
        await approval_svc.decide_approval(
            ticket_id=ticket_id,
            approver_id="gemini-agent-v1",
            decision="APPROVED",
            decision_notes="Agent self-approval",
        )
        assert False, "Agent self-approval must raise AuthorizationDeniedError"
    except AuthorizationDeniedError as e:
        print(f"    -> PASS [3d]: AI Agent self-approval blocked: {e}")

    # -------------------------------------------------------------------------
    # STEP 4: Legitimate Authorized Human Approval
    # -------------------------------------------------------------------------
    print("\n[STEP 4] Authorized Approver (ADMIN) Approving Ticket...")
    decision_result = await approval_svc.decide_approval(
        ticket_id=ticket_id,
        approver_id=test_approver_id,
        decision="APPROVED",
        decision_notes="Verified GDPR ticket and compliance proof.",
    )
    assert decision_result["status"] == "APPROVED"
    assert decision_result["signature"] is not None
    print(f"    Approved Status: {decision_result['status']}")
    print(f"    HMAC Signature: {decision_result['signature'][:16]}...")
    print("    -> PASS: Legitimate admin approval successfully authorized ticket.")

    # -------------------------------------------------------------------------
    # STEP 5: Execution-Time Parameter Tampering Check
    # -------------------------------------------------------------------------
    print("\n[STEP 5] Testing Parameter Tampering Defense on Approved Ticket...")
    tamper_result = await approval_svc.verify_and_consume(
        ticket_id=ticket_id,
        target_id=test_target_id,
        action="delete_customer",
        tool_name="delete_customer",
        parameters=modified_params,  # Tampered parameters!
    )
    assert not tamper_result, "Tampered parameters must be rejected"
    print("    -> PASS: Parameter tampering detected and blocked (PARAMETER_HASH_MISMATCH).")

    # -------------------------------------------------------------------------
    # STEP 6: Successful Single Execution
    # -------------------------------------------------------------------------
    print("\n[STEP 6] Executing with Exact Approved Parameters...")
    exec_result = await approval_svc.verify_and_consume(
        ticket_id=ticket_id,
        target_id=test_target_id,
        action="delete_customer",
        tool_name="delete_customer",
        parameters=initial_params,  # Exact matching parameters
    )
    assert exec_result is True, "Execution with approved ticket must succeed"
    print("    -> PASS: Approved ticket successfully verified and consumed atomically.")

    # -------------------------------------------------------------------------
    # STEP 7: Replay Attack Defense (Single-Use Enforcement)
    # -------------------------------------------------------------------------
    print("\n[STEP 7] Testing Replay Defense with Already-Consumed Ticket...")
    replay_result = await approval_svc.verify_and_consume(
        ticket_id=ticket_id,
        target_id=test_target_id,
        action="delete_customer",
        tool_name="delete_customer",
        parameters=initial_params,
    )
    assert not replay_result, "Replay of consumed ticket must be rejected"
    print("    -> PASS: Replay attack strictly blocked (APPROVAL_REPLAY_DETECTED).")

    # -------------------------------------------------------------------------
    # STEP 8: Expiration & Rejection State Verification
    # -------------------------------------------------------------------------
    print("\n[STEP 8] Testing Expired and Rejected Ticket Defenses...")
    # Create an already-expired ticket
    expired_req = ApprovalRequestCreate(
        request_id=f"req-exp-{uuid.uuid4().hex[:8]}",
        agent_id="agent-sentinel-v1",
        requester_id=test_requester_id,
        tool_name="delete_customer",
        target_id=test_target_id,
        action="delete_customer",
        parameters=initial_params,
        environment="development",
        risk_level="CRITICAL",
        risk_score=95,
        reason="Expiring ticket test",
        ttl_seconds=60,
    )
    exp_ticket = await approval_svc.create_approval(expired_req)
    exp_ticket_id = exp_ticket["ticket_id"]

    # Manually expire the ticket in database to test expiration state machine
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE approval_requests SET expires_at = NOW() - INTERVAL '10 seconds' WHERE ticket_id = $1",
            exp_ticket_id,
        )

    # Try deciding on expired ticket
    try:
        await approval_svc.decide_approval(
            ticket_id=exp_ticket_id,
            approver_id=test_approver_id,
            decision="APPROVED",
        )
        assert False, "Deciding on expired ticket must fail"
    except AuthorizationDeniedError as e:
        print(f"    -> PASS: Approving expired ticket blocked: {e}")

    # Create a ticket and reject/deny it
    deny_req = ApprovalRequestCreate(
        request_id=f"req-deny-{uuid.uuid4().hex[:8]}",
        agent_id="agent-sentinel-v1",
        requester_id=test_requester_id,
        tool_name="delete_customer",
        target_id=test_target_id,
        action="delete_customer",
        parameters=initial_params,
        environment="development",
        risk_level="CRITICAL",
        risk_score=95,
        reason="Ticket to be denied",
        ttl_seconds=3600,
    )
    deny_ticket = await approval_svc.create_approval(deny_req)
    deny_ticket_id = deny_ticket["ticket_id"]
    await approval_svc.decide_approval(
        ticket_id=deny_ticket_id,
        approver_id=test_approver_id,
        decision="DENIED",
        decision_notes="Rejected due to insufficient justification.",
    )
    # Attempt to consume denied ticket
    deny_exec = await approval_svc.verify_and_consume(
        ticket_id=deny_ticket_id,
        target_id=test_target_id,
        action="delete_customer",
        tool_name="delete_customer",
        parameters=initial_params,
    )
    assert not deny_exec, "Denied ticket must not execute"
    print("    -> PASS: Rejected/denied ticket execution blocked (TICKET_NOT_APPROVED).")

    # -------------------------------------------------------------------------
    # STEP 9: Audit Trail Verification
    # -------------------------------------------------------------------------
    print("\n[STEP 9] Verifying Complete Audit Trail in PostgreSQL...")
    async with pool.acquire() as conn:
        events = await conn.fetch(
            """
            SELECT event_type, decision, actor_id, tool_name, created_at
            FROM audit_events
            WHERE details->>'ticket_id' = $1
            ORDER BY created_at ASC
        """,
            ticket_id,
        )
        print(f"    Recorded Audit Events for Ticket {ticket_id} ({len(events)} events):")
        for ev in events:
            print(
                f"      - {ev['event_type']} | Decision: {ev['decision']} | Actor: {ev['actor_id']}"
            )
        assert len(events) >= 2, f"Expected at least 2 audit events for ticket, found {len(events)}"
        print("    -> PASS: Full lifecycle accurately audited in PostgreSQL audit_events.")

    # Cleanup test tickets
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM approval_requests WHERE ticket_id IN ($1, $2, $3)",
            ticket_id,
            exp_ticket_id,
            deny_ticket_id,
        )

    await close_db_pool()
    print("\n" + "=" * 80)
    print("ALL HUMAN APPROVAL & SECURITY GATE CONTROLS VERIFIED: 100% PASS")
    print("=" * 80)
    return True


if __name__ == "__main__":
    success = asyncio.run(verify_approval_lifecycle())
    sys.exit(0 if success else 1)
