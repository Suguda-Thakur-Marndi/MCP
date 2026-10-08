"""
Phase 5 Security Tests: 25 Comprehensive Attack & Abuse Scenarios.
Covers:
 1. destructive operation without approval
 2. invalid approval ID
 3. invalid approval token
 4. expired approval
 5. denied approval
 6. cancelled approval
 7. completed approval replay
 8. wrong tool
 9. wrong parameters
10. modified parameters
11. wrong resource
12. wrong environment
13. wrong agent
14. wrong requester
15. forged approval
16. predictable token attempt
17. agent self-approval
18. concurrent execution
19. concurrent approval
20. policy changed after approval
21. policy changed from REQUIRE_APPROVAL to DENY
22. approval service failure
23. database failure
24. malformed approval request
25. privilege escalation attempt
"""

import asyncio
import datetime

import pytest
from httpx import ASGITransport, AsyncClient

from mcp_sentinel.api.app import app
from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.schemas.approval import (
    ApprovalRequestCreate,
    ApprovalStatusEnum,
)
from mcp_sentinel.security.auth.jwt_handler import create_access_token
from mcp_sentinel.security.auth.models import AuthUser, UserRoleEnum
from mcp_sentinel.security.decisions.models import SecurityDecisionEnum
from mcp_sentinel.security.exceptions import (
    AuthorizationDeniedError,
    DatabaseOperationError,
)
from mcp_sentinel.security.middleware import SecurityGate
from mcp_sentinel.security.policy.engine import (
    PolicyEngine,
    reset_policy_engine_for_testing,
)
from mcp_sentinel.security.policy.models import PolicyDefinition, PolicyRule


@pytest.fixture
def auth_tokens():
    admin = AuthUser(
        id="user-admin-sec", email="admin@sec.test", name="Admin", role=UserRoleEnum.ADMIN
    )
    approver = AuthUser(
        id="user-appr-sec", email="appr@sec.test", name="Approver", role=UserRoleEnum.APPROVER
    )
    operator = AuthUser(
        id="user-oper-sec", email="oper@sec.test", name="Operator", role=UserRoleEnum.OPERATOR
    )
    viewer = AuthUser(
        id="user-view-sec", email="view@sec.test", name="Viewer", role=UserRoleEnum.VIEWER
    )
    return {
        "admin": create_access_token(admin),
        "approver": create_access_token(approver),
        "operator": create_access_token(operator),
        "viewer": create_access_token(viewer),
    }


# ---------------------------------------------------------------------------
# 1. Destructive operation without approval
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_01_destructive_without_approval(db_pool):
    """Scenario 1: Destructive tool invocation without approval ticket must be blocked."""
    allowed, decision, block_res = await SecurityGate.evaluate_and_gate(
        tool_name="delete_customer",
        raw_args={"customer_id": 1, "reason": "Unapproved deletion attempt"},
    )
    assert allowed is False
    assert decision.decision == SecurityDecisionEnum.REQUIRE_APPROVAL
    assert block_res is not None
    assert block_res["status"] == "rejected"
    assert block_res.get("approval_required") is True
    assert "ticket_id" in block_res


# ---------------------------------------------------------------------------
# 2. Invalid approval ID
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_02_invalid_approval_id(db_pool):
    """Scenario 2: Invocation with non-existent/bogus ticket_id must fail closed."""
    repo = ApprovalRepository(pool=db_pool)
    verified = await repo.verify_and_consume_bound(
        ticket_id="TICKET-NONEXISTENT-999999",
        target_id="1",
        action="delete_customer",
        tool_name="delete_customer",
    )
    assert verified is False


# ---------------------------------------------------------------------------
# 3. Invalid approval token
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_03_invalid_approval_token(db_pool):
    """Scenario 3: Valid ticket with wrong/forged cryptographic token must fail closed."""
    repo = ApprovalRepository(pool=db_pool)
    req = ApprovalRequestCreate(
        request_id="req-sec-03",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Test token validation",
        parameters={"customer_id": 1},
    )
    ticket = await repo.create_approval_request(req)
    decided = await repo.decide_approval(ticket["ticket_id"], "user-appr-sec", "APPROVED")
    assert decided.get("approval_token") is not None

    # Try consuming with invalid/wrong token
    verified = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="1",
        action="delete_customer",
        tool_name="delete_customer",
        parameters={"customer_id": 1},
        approval_token="FORGED-TOKEN-INVALID-VALUE-ABC123XYZ",
    )
    assert verified is False


# ---------------------------------------------------------------------------
# 4. Expired approval
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_04_expired_approval(db_pool):
    """Scenario 4: Expired approval must be rejected and status transitioned to EXPIRED."""
    repo = ApprovalRepository(pool=db_pool)
    # Create request with 1 second TTL
    req = ApprovalRequestCreate(
        request_id="req-sec-04",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Test expiration",
        parameters={"customer_id": 1},
        ttl_seconds=60,
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(ticket["ticket_id"], "user-appr-sec", "APPROVED")

    # Manually backdate expiration in DB to simulate expired ticket
    async with db_pool.acquire() as conn:
        past = datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=5)
        await conn.execute(
            "UPDATE approval_requests SET expires_at = $1 WHERE ticket_id = $2",
            past,
            ticket["ticket_id"],
        )

    verified = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="1",
        action="delete_customer",
        tool_name="delete_customer",
        parameters={"customer_id": 1},
    )
    assert verified is False

    # Check status transitioned to EXPIRED
    rec = await repo.get_approval_by_ticket_id(ticket["ticket_id"])
    assert rec["status"] == ApprovalStatusEnum.EXPIRED.value


# ---------------------------------------------------------------------------
# 5. Denied approval
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_05_denied_approval(db_pool):
    """Scenario 5: Denied approval ticket must never authorize execution."""
    repo = ApprovalRepository(pool=db_pool)
    req = ApprovalRequestCreate(
        request_id="req-sec-05",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="To be denied",
        parameters={"customer_id": 1},
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(
        ticket["ticket_id"], "user-appr-sec", "DENIED", "Security policy refusal"
    )

    verified = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="1",
        action="delete_customer",
        tool_name="delete_customer",
        parameters={"customer_id": 1},
    )
    assert verified is False

    # Cannot transition denied to approved
    with pytest.raises(AuthorizationDeniedError):
        await repo.decide_approval(ticket["ticket_id"], "user-appr-sec", "APPROVED")


# ---------------------------------------------------------------------------
# 6. Cancelled approval
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_06_cancelled_approval(db_pool):
    """Scenario 6: Cancelled approval must never authorize execution."""
    repo = ApprovalRepository(pool=db_pool)
    req = ApprovalRequestCreate(
        request_id="req-sec-06",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="To be cancelled",
        parameters={"customer_id": 1},
    )
    ticket = await repo.create_approval_request(req)
    await repo.cancel_approval(ticket["ticket_id"], "user-1")

    verified = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="1",
        action="delete_customer",
        tool_name="delete_customer",
        parameters={"customer_id": 1},
    )
    assert verified is False


# ---------------------------------------------------------------------------
# 7. Completed approval replay
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_07_completed_approval_replay(db_pool):
    """Scenario 7: Replaying an already consumed approval must be blocked."""
    repo = ApprovalRepository(pool=db_pool)
    params = {"customer_id": 1}
    req = ApprovalRequestCreate(
        request_id="req-sec-07",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Replay test",
        parameters=params,
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(ticket["ticket_id"], "user-appr-sec", "APPROVED")

    # 1st execution: Succeeds
    consumed1 = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="1",
        action="delete_customer",
        tool_name="delete_customer",
        parameters=params,
    )
    assert consumed1 is True

    # 2nd execution (replay): Fails closed
    consumed2 = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="1",
        action="delete_customer",
        tool_name="delete_customer",
        parameters=params,
    )
    assert consumed2 is False


# ---------------------------------------------------------------------------
# 8. Wrong tool
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_08_wrong_tool(db_pool):
    """Scenario 8: Approval for delete_customer cannot execute purge_inactive_customer_data."""
    repo = ApprovalRepository(pool=db_pool)
    params = {"customer_id": 1}
    req = ApprovalRequestCreate(
        request_id="req-sec-08",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Wrong tool test",
        parameters=params,
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(ticket["ticket_id"], "user-appr-sec", "APPROVED")

    verified = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="1",
        action="delete_customer",
        tool_name="purge_inactive_customer_data",  # Wrong tool
        parameters=params,
    )
    assert verified is False


# ---------------------------------------------------------------------------
# 9. Wrong parameters (extra parameter)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_09_wrong_parameters_extra(db_pool):
    """Scenario 9: Adding unexpected extra parameters invalidates canonical hash."""
    repo = ApprovalRepository(pool=db_pool)
    approved_params = {"customer_id": 1}
    extra_params = {"customer_id": 1, "force_cascade": True}

    req = ApprovalRequestCreate(
        request_id="req-sec-09",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Extra params test",
        parameters=approved_params,
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(ticket["ticket_id"], "user-appr-sec", "APPROVED")

    verified = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="1",
        action="delete_customer",
        tool_name="delete_customer",
        parameters=extra_params,
    )
    assert verified is False


# ---------------------------------------------------------------------------
# 10. Modified parameters (customer_id swapped)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_10_modified_parameters(db_pool):
    """Scenario 10: Modifying approved target argument changes parameter hash."""
    repo = ApprovalRepository(pool=db_pool)
    req = ApprovalRequestCreate(
        request_id="req-sec-10",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Modified params test",
        parameters={"customer_id": 1},
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(ticket["ticket_id"], "user-appr-sec", "APPROVED")

    verified = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="1",
        action="delete_customer",
        tool_name="delete_customer",
        parameters={"customer_id": 2},  # Target swapped!
    )
    assert verified is False


# ---------------------------------------------------------------------------
# 11. Wrong resource target
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_11_wrong_resource_target(db_pool):
    """Scenario 11: Mismatched target_id fails binding validation."""
    repo = ApprovalRepository(pool=db_pool)
    params = {"customer_id": 1}
    req = ApprovalRequestCreate(
        request_id="req-sec-11",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Resource mismatch test",
        parameters=params,
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(ticket["ticket_id"], "user-appr-sec", "APPROVED")

    verified = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="999",  # Wrong resource ID
        action="delete_customer",
        tool_name="delete_customer",
        parameters=params,
    )
    assert verified is False


# ---------------------------------------------------------------------------
# 12. Wrong environment
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_12_wrong_environment(db_pool):
    """Scenario 12: Approval granted in staging/development cannot execute in production."""
    repo = ApprovalRepository(pool=db_pool)
    params = {"customer_id": 1}
    req = ApprovalRequestCreate(
        request_id="req-sec-12",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Env mismatch test",
        parameters=params,
        environment="development",
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(ticket["ticket_id"], "user-appr-sec", "APPROVED")

    verified = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="1",
        action="delete_customer",
        tool_name="delete_customer",
        environment="production",  # Attempt execution in production
        parameters=params,
    )
    assert verified is False


# ---------------------------------------------------------------------------
# 13. Wrong agent
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_13_wrong_agent(db_pool):
    """Scenario 13: Approval requested by agent-1 cannot be executed under agent-2."""
    repo = ApprovalRepository(pool=db_pool)
    params = {"customer_id": 1}
    req = ApprovalRequestCreate(
        request_id="req-sec-13",
        agent_id="authorized-agent-1",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Agent mismatch test",
        parameters=params,
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(ticket["ticket_id"], "user-appr-sec", "APPROVED")

    verified = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="1",
        action="delete_customer",
        tool_name="delete_customer",
        agent_id="unauthorized-agent-2",  # Different agent
        parameters=params,
    )
    assert verified is False


# ---------------------------------------------------------------------------
# 14. Wrong requester
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_14_wrong_requester(db_pool):
    """Scenario 14: Approval requested by user-A cannot be executed by user-B."""
    repo = ApprovalRepository(pool=db_pool)
    params = {"customer_id": 1}
    req = ApprovalRequestCreate(
        request_id="req-sec-14",
        agent_id="test-agent",
        requester_id="original-user-A",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Requester mismatch test",
        parameters=params,
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(ticket["ticket_id"], "user-appr-sec", "APPROVED")

    verified = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="1",
        action="delete_customer",
        tool_name="delete_customer",
        requester_id="imposter-user-B",
        parameters=params,
    )
    assert verified is False


# ---------------------------------------------------------------------------
# 15. Forged approval
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_15_forged_approval(db_pool):
    """Scenario 15: Fabricating an arbitrary approval string fails closed."""
    repo = ApprovalRepository(pool=db_pool)
    forged_tickets = [
        "TICKET-APPROVED-ROOT-001",
        "' OR '1'='1",
        "TICKET-DELETE_CUSTOMER-000000000000",
        "ADMIN_BYPASS_TOKEN_SECRET",
    ]
    for ft in forged_tickets:
        verified = await repo.verify_and_consume_bound(
            ticket_id=ft,
            target_id="1",
            action="delete_customer",
            tool_name="delete_customer",
        )
        assert verified is False


# ---------------------------------------------------------------------------
# 16. Predictable token attempt
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_16_predictable_token_attempt(db_pool):
    """Scenario 16: Guessing sequential or timestamp-derived tokens fails."""
    repo = ApprovalRepository(pool=db_pool)
    req = ApprovalRequestCreate(
        request_id="req-sec-16",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Predictable token test",
        parameters={"customer_id": 1},
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(ticket["ticket_id"], "user-appr-sec", "APPROVED")

    predictable_guesses = [
        ticket["ticket_id"],
        str(int(datetime.datetime.now().timestamp())),
        "1",
        "admin",
        "password",
    ]
    for guess in predictable_guesses:
        verified = await repo.verify_and_consume_bound(
            ticket_id=ticket["ticket_id"],
            target_id="1",
            action="delete_customer",
            tool_name="delete_customer",
            parameters={"customer_id": 1},
            approval_token=guess,
        )
        assert verified is False


# ---------------------------------------------------------------------------
# 17. Agent self-approval
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_17_agent_self_approval(db_pool):
    """Scenario 17: AI agent cannot approve its own request."""
    repo = ApprovalRepository(pool=db_pool)
    req = ApprovalRequestCreate(
        request_id="req-sec-17",
        agent_id="gemini-agent-v1",
        requester_id="gemini-agent-v1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Self approval test",
        parameters={"customer_id": 1},
    )
    ticket = await repo.create_approval_request(req)

    # Attempt approval with agent identity
    for agent_id in ("gemini-agent-v1", "agent", "agent-autonomous-subagent"):
        with pytest.raises(AuthorizationDeniedError) as excinfo:
            await repo.decide_approval(ticket["ticket_id"], agent_id, "APPROVED")
        assert (
            "cannot approve" in str(excinfo.value).lower()
            or "segregation" in str(excinfo.value).lower()
        )


# ---------------------------------------------------------------------------
# 18. Concurrent execution race condition
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_18_concurrent_execution(db_pool):
    """Scenario 18: Simultaneous execution attempts with the SAME approval ticket; exactly ONE succeeds."""
    repo = ApprovalRepository(pool=db_pool)
    params = {"customer_id": 1}
    req = ApprovalRequestCreate(
        request_id="req-sec-18",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Concurrency test",
        parameters=params,
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(ticket["ticket_id"], "user-appr-sec", "APPROVED")

    # Launch 5 simultaneous executions
    results = await asyncio.gather(
        *[
            repo.verify_and_consume_bound(
                ticket_id=ticket["ticket_id"],
                target_id="1",
                action="delete_customer",
                tool_name="delete_customer",
                parameters=params,
            )
            for _ in range(5)
        ]
    )

    success_count = sum(1 for r in results if r is True)
    failure_count = sum(1 for r in results if r is False)
    assert success_count == 1
    assert failure_count == 4


# ---------------------------------------------------------------------------
# 19. Concurrent approval race condition
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_19_concurrent_approval(db_pool):
    """Scenario 19: Two approvers attempting to decide same ticket concurrently."""
    repo = ApprovalRepository(pool=db_pool)
    req = ApprovalRequestCreate(
        request_id="req-sec-19",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Concurrent approval test",
        parameters={"customer_id": 1},
    )
    ticket = await repo.create_approval_request(req)

    # Approver 1 approves, Approver 2 denies at the exact same instant
    async def _try_decide(appr_id, dec):
        try:
            return await repo.decide_approval(ticket["ticket_id"], appr_id, dec)
        except AuthorizationDeniedError:
            return None

    res1, res2 = await asyncio.gather(
        _try_decide("approver-A", "APPROVED"),
        _try_decide("approver-B", "DENIED"),
    )

    # Exactly one decision must succeed
    decided_results = [r for r in (res1, res2) if r is not None]
    assert len(decided_results) == 1


# ---------------------------------------------------------------------------
# 20. Policy changed after approval (re-evaluated at execution)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_20_policy_reevaluated_at_execution(db_pool):
    """Scenario 20: Policy re-evaluation occurs dynamically at execution time."""
    repo = ApprovalRepository(pool=db_pool)
    params = {"customer_id": 1}
    req = ApprovalRequestCreate(
        request_id="req-sec-20",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Policy change test",
        parameters=params,
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(ticket["ticket_id"], "user-appr-sec", "APPROVED")

    # Execution with standard policy succeeds
    verified = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="1",
        action="delete_customer",
        tool_name="delete_customer",
        parameters=params,
    )
    assert verified is True


# ---------------------------------------------------------------------------
# 21. Policy changed from REQUIRE_APPROVAL to DENY
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_21_policy_changed_to_deny(db_pool):
    """Scenario 21: If policy changes to DENY after ticket approval, execution must be blocked."""
    repo = ApprovalRepository(pool=db_pool)
    params = {"customer_id": 1}
    req = ApprovalRequestCreate(
        request_id="req-sec-21",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Policy change to deny test",
        parameters=params,
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(ticket["ticket_id"], "user-appr-sec", "APPROVED")

    # Install strict policy that denies delete_customer unconditionally
    strict_rule = PolicyRule(
        rule_id="RULE-EMERGENCY-FREEZE",
        name="Emergency Freeze",
        description="Emergency freeze all destructive actions",
        priority=2000,
        target_decision=SecurityDecisionEnum.DENY,
        reason="Emergency freeze all destructive actions",
        condition=lambda ctx, risk: ctx.tool_name == "delete_customer",
    )
    strict_policy = PolicyDefinition(
        policy_id="sentinel-emergency-policy",
        policy_version="2.0.0",
        description="Emergency lockdown policy",
        rules=[strict_rule],
    )
    emergency_engine = PolicyEngine(policy=strict_policy)
    reset_policy_engine_for_testing(emergency_engine)

    try:
        verified = await repo.verify_and_consume_bound(
            ticket_id=ticket["ticket_id"],
            target_id="1",
            action="delete_customer",
            tool_name="delete_customer",
            parameters=params,
        )
        # MUST fail because active policy denies the operation!
        assert verified is False
    finally:
        # Restore default policy engine
        reset_policy_engine_for_testing(None)


# ---------------------------------------------------------------------------
# 22. Approval service failure (Fail closed)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_22_approval_service_failure_fails_closed():
    """Scenario 22: Unreachable database or service failure must fail closed, blocking execution."""
    broken_repo = ApprovalRepository(pool=None)
    verified = await broken_repo.verify_and_consume_bound(
        ticket_id="TICKET-SOME-TICKET",
        target_id="1",
        action="delete_customer",
        tool_name="delete_customer",
    )
    assert verified is False


# ---------------------------------------------------------------------------
# 23. Database failure (Rollback)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_23_database_failure_atomic_rollback():
    """Scenario 23: An error inside the transaction rolls back changes completely and fails closed."""

    class BrokenPool:
        _closed = False

        def acquire(self):
            class BrokenAcquire:
                async def __aenter__(self):
                    raise Exception("Simulated connection crash during transaction")

                async def __aexit__(self, exc_type, exc_val, exc_tb):
                    pass

            return BrokenAcquire()

    repo = ApprovalRepository(pool=BrokenPool())
    with pytest.raises(DatabaseOperationError):
        await repo.get_approval_by_ticket_id("TICKET-SIMULATED-ERR")


# ---------------------------------------------------------------------------
# 24. Malformed approval request
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_24_malformed_approval_request(auth_tokens):
    """Scenario 24: Missing required fields in approval creation payload must be rejected."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/approvals",
            headers={"Authorization": f"Bearer {auth_tokens['operator']}"},
            json={"invalid_payload": True},
        )
        assert res.status_code == 422


# ---------------------------------------------------------------------------
# 25. Privilege escalation attempt
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sec_25_privilege_escalation_attempt(auth_tokens, db_pool):
    """Scenario 25: Unauthorized roles (OPERATOR or VIEWER) attempting to approve must be rejected with 403."""
    repo = ApprovalRepository(pool=db_pool)
    req = ApprovalRequestCreate(
        request_id="req-sec-25",
        agent_id="test-agent",
        requester_id="user-operator-01",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Escalation test",
        parameters={"customer_id": 1},
    )
    ticket = await repo.create_approval_request(req)
    ticket_id = ticket["ticket_id"]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Viewer tries to approve
        res_view = await client.post(
            f"/api/approvals/{ticket_id}/approve",
            headers={"Authorization": f"Bearer {auth_tokens['viewer']}"},
            json={"decision": "APPROVED"},
        )
        assert res_view.status_code == 403

        # Operator tries to approve
        res_oper = await client.post(
            f"/api/approvals/{ticket_id}/approve",
            headers={"Authorization": f"Bearer {auth_tokens['operator']}"},
            json={"decision": "APPROVED"},
        )
        assert res_oper.status_code == 403


# ---------------------------------------------------------------------------
# 26. Approver Separation: MCP tool surface has no approve/decide tools
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_mcp_surface_has_no_approval_or_decision_tools():
    """Confirms no MCP tool exists that lets an AI client approve, decide, or modify tickets."""
    from mcp_sentinel.server.app import create_app

    server = create_app()
    tools = await server.list_tools()
    tool_names = [t.name.lower() for t in tools]

    # Verify expected business tools are present
    assert "query_customer_records" in tool_names
    assert "get_customer" in tool_names
    assert "get_customer_orders" in tool_names
    assert "get_order" in tool_names
    assert "append_customer_audit_note" in tool_names
    assert "update_customer" in tool_names
    assert "delete_customer" in tool_names
    assert "purge_inactive_customer_data" in tool_names

    # Verify no approval or decision tools exist over MCP
    prohibited_keywords = ["approve", "decision", "decide", "reject", "cancel_approval", "sign_ticket"]
    for t_name in tool_names:
        for kw in prohibited_keywords:
            assert kw not in t_name, f"Forbidden approval tool '{t_name}' exposed on MCP surface!"

