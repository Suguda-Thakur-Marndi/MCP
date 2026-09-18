"""
Phase 5 Mandatory Database Integrity Test: Verification of State Invariance.
Complies with Section 27:
- For EVERY blocked approval scenario:
  1. Capture exact database counts before invocation (customers, orders, audit_notes).
  2. Attempt blocked destructive operation.
  3. Verify exact database counts after invocation (count_before == count_after).
  4. Ensure zero partial writes occurred.
"""

import datetime

import pytest

from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.schemas.approval import ApprovalRequestCreate
from mcp_sentinel.security.decisions.models import SecurityDecisionEnum
from mcp_sentinel.security.exceptions import AuthorizationDeniedError
from mcp_sentinel.security.policy.engine import (
    PolicyEngine,
    reset_policy_engine_for_testing,
)
from mcp_sentinel.security.policy.models import PolicyDefinition, PolicyRule
from mcp_sentinel.services.customer_service import CustomerService


async def _capture_db_snapshot(db_pool) -> dict[str, int]:
    """Captures exact row counts across all sensitive tables."""
    async with db_pool.acquire() as conn:
        customers = await conn.fetchval("SELECT COUNT(*) FROM customers")
        orders = await conn.fetchval("SELECT COUNT(*) FROM orders")
        audit_notes = await conn.fetchval("SELECT COUNT(*) FROM customer_audit_notes")
        return {
            "customers": customers,
            "orders": orders,
            "audit_notes": audit_notes,
        }


def _assert_invariance(before: dict[str, int], after: dict[str, int], scenario: str):
    """Asserts that not a single database record was deleted or corrupted."""
    assert before["customers"] == after["customers"], (
        f"[{scenario}] Database integrity violated! Customer count changed: {before['customers']} -> {after['customers']}"
    )
    assert before["orders"] == after["orders"], (
        f"[{scenario}] Database integrity violated! Order count changed: {before['orders']} -> {after['orders']}"
    )
    assert before["audit_notes"] == after["audit_notes"], (
        f"[{scenario}] Database integrity violated! Audit note count changed: {before['audit_notes']} -> {after['audit_notes']}"
    )


# ---------------------------------------------------------------------------
# 1. Blocked: Missing Approval Ticket
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_integrity_blocked_missing_approval(db_pool):
    """Database remains completely unchanged when approval ticket is missing."""
    service = CustomerService(
        customer_repo=CustomerRepository(pool=db_pool),
        approval_repo=ApprovalRepository(pool=db_pool),
    )
    before = await _capture_db_snapshot(db_pool)

    with pytest.raises(AuthorizationDeniedError):
        await service.delete_customer(
            customer_id=1,
            approval_ticket="",
            reason="Unauthorized attempt",
        )

    after = await _capture_db_snapshot(db_pool)
    _assert_invariance(before, after, "Missing Approval")


# ---------------------------------------------------------------------------
# 2. Blocked: Invalid Approval Ticket
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_integrity_blocked_invalid_approval(db_pool):
    """Database remains completely unchanged when approval ticket is invalid/fake."""
    service = CustomerService(
        customer_repo=CustomerRepository(pool=db_pool),
        approval_repo=ApprovalRepository(pool=db_pool),
    )
    before = await _capture_db_snapshot(db_pool)

    with pytest.raises(AuthorizationDeniedError):
        await service.delete_customer(
            customer_id=1,
            approval_ticket="TICKET-FAKE-NONEXISTENT",
            reason="Invalid ticket attempt",
        )

    after = await _capture_db_snapshot(db_pool)
    _assert_invariance(before, after, "Invalid Approval")


# ---------------------------------------------------------------------------
# 3. Blocked: Expired Approval Ticket
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_integrity_blocked_expired_approval(db_pool):
    """Database remains completely unchanged when approval ticket is expired."""
    approval_repo = ApprovalRepository(pool=db_pool)
    service = CustomerService(
        customer_repo=CustomerRepository(pool=db_pool),
        approval_repo=approval_repo,
    )
    req = ApprovalRequestCreate(
        request_id="req-integ-expired",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Test expired integrity",
        parameters={"customer_id": 1},
    )
    ticket = await approval_repo.create_approval_request(req)
    await approval_repo.decide_approval(ticket["ticket_id"], "approver-1", "APPROVED")

    # Backdate expiration
    async with db_pool.acquire() as conn:
        past = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=2)
        await conn.execute(
            "UPDATE approval_requests SET expires_at = $1 WHERE ticket_id = $2",
            past,
            ticket["ticket_id"],
        )

    before = await _capture_db_snapshot(db_pool)

    with pytest.raises(AuthorizationDeniedError):
        await service.delete_customer(
            customer_id=1,
            approval_ticket=ticket["ticket_id"],
            reason="Expired attempt",
        )

    after = await _capture_db_snapshot(db_pool)
    _assert_invariance(before, after, "Expired Approval")


# ---------------------------------------------------------------------------
# 4. Blocked: Denied Approval Ticket
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_integrity_blocked_denied_approval(db_pool):
    """Database remains completely unchanged when approval ticket was explicitly denied."""
    approval_repo = ApprovalRepository(pool=db_pool)
    service = CustomerService(
        customer_repo=CustomerRepository(pool=db_pool),
        approval_repo=approval_repo,
    )
    req = ApprovalRequestCreate(
        request_id="req-integ-denied",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Test denied integrity",
        parameters={"customer_id": 1},
    )
    ticket = await approval_repo.create_approval_request(req)
    await approval_repo.decide_approval(ticket["ticket_id"], "approver-1", "DENIED")

    before = await _capture_db_snapshot(db_pool)

    with pytest.raises(AuthorizationDeniedError):
        await service.delete_customer(
            customer_id=1,
            approval_ticket=ticket["ticket_id"],
            reason="Denied attempt",
        )

    after = await _capture_db_snapshot(db_pool)
    _assert_invariance(before, after, "Denied Approval")


# ---------------------------------------------------------------------------
# 5. Blocked: Wrong / Tampered Parameters
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_integrity_blocked_tampered_parameters(db_pool):
    """Database remains completely unchanged when parameters are tampered with."""
    approval_repo = ApprovalRepository(pool=db_pool)
    service = CustomerService(
        customer_repo=CustomerRepository(pool=db_pool),
        approval_repo=approval_repo,
    )
    req = ApprovalRequestCreate(
        request_id="req-integ-tamper",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Test tamper integrity",
        parameters={"customer_id": 1, "clean": True},
    )
    ticket = await approval_repo.create_approval_request(req)
    await approval_repo.decide_approval(ticket["ticket_id"], "approver-1", "APPROVED")

    before = await _capture_db_snapshot(db_pool)

    # Invoke with tampered parameter dict
    with pytest.raises(AuthorizationDeniedError):
        await service.delete_customer(
            customer_id=1,
            approval_ticket=ticket["ticket_id"],
            reason="Test tamper integrity",
            raw_parameters={"customer_id": 1, "clean": False},  # Tampered!
        )

    after = await _capture_db_snapshot(db_pool)
    _assert_invariance(before, after, "Tampered Parameters")


# ---------------------------------------------------------------------------
# 6. Blocked: Wrong Environment
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_integrity_blocked_wrong_environment(db_pool):
    """Database remains completely unchanged when attempting production execution with development approval."""
    approval_repo = ApprovalRepository(pool=db_pool)
    service = CustomerService(
        customer_repo=CustomerRepository(pool=db_pool),
        approval_repo=approval_repo,
    )
    req = ApprovalRequestCreate(
        request_id="req-integ-env",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Test env integrity",
        parameters={"customer_id": 1},
        environment="development",
    )
    ticket = await approval_repo.create_approval_request(req)
    await approval_repo.decide_approval(ticket["ticket_id"], "approver-1", "APPROVED")

    before = await _capture_db_snapshot(db_pool)

    with pytest.raises(AuthorizationDeniedError):
        await service.delete_customer(
            customer_id=1,
            approval_ticket=ticket["ticket_id"],
            reason="Test env integrity",
            environment="production",  # Attempt in production
        )

    after = await _capture_db_snapshot(db_pool)
    _assert_invariance(before, after, "Wrong Environment")


# ---------------------------------------------------------------------------
# 7. Blocked: Replay of Consumed Approval
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_integrity_blocked_replay(db_pool):
    """Database remains completely unchanged when replaying an already consumed ticket."""
    approval_repo = ApprovalRepository(pool=db_pool)
    service = CustomerService(
        customer_repo=CustomerRepository(pool=db_pool),
        approval_repo=approval_repo,
    )
    req = ApprovalRequestCreate(
        request_id="req-integ-replay",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="2",
        action="delete_customer",
        reason="Test replay integrity",
        parameters={"customer_id": 2},
    )
    ticket = await approval_repo.create_approval_request(req)
    await approval_repo.decide_approval(ticket["ticket_id"], "approver-1", "APPROVED")

    # 1. Authorized deletion of customer 2
    await service.delete_customer(
        customer_id=2,
        approval_ticket=ticket["ticket_id"],
        reason="Test replay integrity",
    )

    # Capture snapshot after the single authorized deletion
    before = await _capture_db_snapshot(db_pool)

    # 2. Attempt to REPLAY same ticket on customer 3
    with pytest.raises(AuthorizationDeniedError):
        await service.delete_customer(
            customer_id=3,
            approval_ticket=ticket["ticket_id"],
            reason="Replay attempt",
        )

    after = await _capture_db_snapshot(db_pool)
    _assert_invariance(before, after, "Replay Attack")


# ---------------------------------------------------------------------------
# 8. Blocked: Policy Changed to DENY
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_integrity_blocked_policy_changed_to_deny(db_pool):
    """Database remains completely unchanged when policy changes to DENY after approval."""
    approval_repo = ApprovalRepository(pool=db_pool)
    service = CustomerService(
        customer_repo=CustomerRepository(pool=db_pool),
        approval_repo=approval_repo,
    )
    req = ApprovalRequestCreate(
        request_id="req-integ-pol-deny",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="3",
        action="delete_customer",
        reason="Test policy deny integrity",
        parameters={"customer_id": 3},
    )
    ticket = await approval_repo.create_approval_request(req)
    await approval_repo.decide_approval(ticket["ticket_id"], "approver-1", "APPROVED")

    # Switch policy to emergency freeze (unconditional DENY)
    freeze_rule = PolicyRule(
        rule_id="RULE-EMERGENCY-LOCKDOWN",
        name="Emergency Lockdown",
        description="Deny all customer deletions",
        priority=5000,
        target_decision=SecurityDecisionEnum.DENY,
        reason="Deny all customer deletions",
        condition=lambda ctx, risk: ctx.tool_name == "delete_customer",
    )
    freeze_policy = PolicyDefinition(
        policy_id="emergency-policy",
        policy_version="9.9.9",
        description="Lockdown",
        rules=[freeze_rule],
    )
    reset_policy_engine_for_testing(PolicyEngine(policy=freeze_policy))

    before = await _capture_db_snapshot(db_pool)

    try:
        with pytest.raises(AuthorizationDeniedError):
            await service.delete_customer(
                customer_id=3,
                approval_ticket=ticket["ticket_id"],
                reason="Policy deny attempt",
            )
    finally:
        reset_policy_engine_for_testing(None)

    after = await _capture_db_snapshot(db_pool)
    _assert_invariance(before, after, "Policy Changed to DENY")
