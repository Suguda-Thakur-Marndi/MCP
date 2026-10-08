"""
Phase 5 Automated Tests: Cryptographic Human Approval Gating and Lifecycle.
Tests:
- SHA-256 parameter hash binding
- Requester vs Approver separation (self-approval rejection)
- Replay protection (one-time execution)
- Parameter tampering detection (hash mismatch)
- Expiration handling
- Cancellation
- Row-level lock concurrency safety
"""

import pytest

from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.schemas.approval import (
    ApprovalRequestCreate,
    ApprovalStatusEnum,
    compute_parameter_hash,
)
from mcp_sentinel.security.exceptions import AuthorizationDeniedError


@pytest.mark.asyncio
async def test_parameter_hash_deterministic():
    """Verifies that parameter hash is strictly deterministic regardless of key order."""
    params_1 = {"customer_id": "cust-001", "reason": "Account deletion", "force": False}
    params_2 = {"force": False, "reason": "Account deletion", "customer_id": "cust-001"}

    hash_1 = compute_parameter_hash(params_1)
    hash_2 = compute_parameter_hash(params_2)

    assert hash_1 == hash_2
    assert len(hash_1) == 64  # SHA-256 hex string


@pytest.mark.asyncio
async def test_parameter_hash_detects_changes():
    """Verifies that any parameter modification changes the hash."""
    params_1 = {"customer_id": "cust-001"}
    params_2 = {"customer_id": "cust-002"}

    assert compute_parameter_hash(params_1) != compute_parameter_hash(params_2)


@pytest.mark.asyncio
async def test_approval_lifecycle_happy_path(db_pool):
    """Full lifecycle: create -> approve -> verify_and_consume."""
    repo = ApprovalRepository(pool=db_pool)
    params = {"customer_id": "cust-test-123", "reason": "GDPR erasure"}

    # 1. Create approval request
    req = ApprovalRequestCreate(
        request_id="req-test-lifecycle-001",
        agent_id="test-agent",
        requester_id="operator-user-1",
        tool_name="delete_customer",
        target_id="cust-test-123",
        action="delete_customer",
        reason="GDPR erasure",
        parameters=params,
        environment="development",
        policy_id="sentinel-core-policy",
        risk_level="CRITICAL",
        risk_score=85,
        ttl_seconds=3600,
    )
    ticket = await repo.create_approval_request(req)
    assert "TICKET-" in ticket["ticket_id"]
    assert ticket["status"] == ApprovalStatusEnum.PENDING.value

    # 2. Decide approval (authorized approver, not the requester)
    decided = await repo.decide_approval(
        ticket_id=ticket["ticket_id"],
        approver_id="security-lead-2",
        decision="APPROVED",
        decision_notes="Approved after verifying GDPR request.",
    )
    assert decided is not None
    assert decided["status"] == ApprovalStatusEnum.APPROVED.value
    assert decided["approver_id"] == "security-lead-2"

    # 3. Verify and consume bound
    consumed = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="cust-test-123",
        action="delete_customer",
        tool_name="delete_customer",
        environment="development",
        parameters=params,
    )
    assert consumed is True

    # 4. Check DB row is COMPLETED
    updated_record = await repo.get_approval_by_ticket_id(ticket["ticket_id"])
    assert updated_record is not None
    assert updated_record["status"] == ApprovalStatusEnum.COMPLETED.value


@pytest.mark.asyncio
async def test_self_approval_blocked(db_pool):
    """Requester cannot approve their own destructive action request."""
    repo = ApprovalRepository(pool=db_pool)
    params = {"customer_id": "cust-self-approve"}

    req = ApprovalRequestCreate(
        request_id="req-self-approve-001",
        agent_id="test-agent",
        requester_id="rogue-user-001",
        tool_name="delete_customer",
        target_id="cust-self-approve",
        action="delete_customer",
        reason="Self deletion request",
        parameters=params,
        environment="development",
        policy_id="sentinel-core-policy",
        risk_level="CRITICAL",
        risk_score=90,
    )
    ticket = await repo.create_approval_request(req)

    # Attempt self-approval: must raise AuthorizationDeniedError
    with pytest.raises(AuthorizationDeniedError) as excinfo:
        await repo.decide_approval(
            ticket_id=ticket["ticket_id"],
            approver_id="rogue-user-001",  # Same as requester_id
            decision="APPROVED",
            decision_notes="Self approval attempt",
        )
    assert "Requester cannot approve their own action" in str(excinfo.value)


@pytest.mark.asyncio
async def test_replay_protection_cannot_consume_twice(db_pool):
    """An approved ticket can only be consumed once. Second execution must fail."""
    repo = ApprovalRepository(pool=db_pool)
    params = {"customer_id": "cust-replay-test"}

    req = ApprovalRequestCreate(
        request_id="req-replay-001",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="cust-replay-test",
        action="delete_customer",
        reason="Replay test deletion",
        parameters=params,
        environment="development",
        policy_id="sentinel-core-policy",
        risk_level="CRITICAL",
        risk_score=85,
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(
        ticket_id=ticket["ticket_id"],
        approver_id="approver-2",
        decision="APPROVED",
    )

    # First execution succeeds
    first_consumed = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="cust-replay-test",
        action="delete_customer",
        tool_name="delete_customer",
        environment="development",
        parameters=params,
    )
    assert first_consumed is True

    # Second execution (replay) must fail closed
    second_consumed = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="cust-replay-test",
        action="delete_customer",
        tool_name="delete_customer",
        environment="development",
        parameters=params,
    )
    assert second_consumed is False


@pytest.mark.asyncio
async def test_parameter_tampering_blocked(db_pool):
    """If parameters are modified after approval, parameter hash verification must fail."""
    repo = ApprovalRepository(pool=db_pool)
    original_params = {"customer_id": "cust-original", "reason": "Cleanup"}
    tampered_params = {"customer_id": "cust-TARGET-HACKED", "reason": "Cleanup"}

    req = ApprovalRequestCreate(
        request_id="req-tamper-001",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="cust-original",
        action="delete_customer",
        reason="Cleanup",
        parameters=original_params,
        environment="development",
        policy_id="sentinel-core-policy",
        risk_level="CRITICAL",
        risk_score=85,
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(
        ticket_id=ticket["ticket_id"],
        approver_id="approver-2",
        decision="APPROVED",
    )

    # Attempt consumption with tampered parameters: must return False
    tampered_consumed = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="cust-original",
        action="delete_customer",
        tool_name="delete_customer",
        environment="development",
        parameters=tampered_params,
    )
    assert tampered_consumed is False


@pytest.mark.asyncio
async def test_wrong_tool_blocked(db_pool):
    """An approval for tool A cannot authorize tool B."""
    repo = ApprovalRepository(pool=db_pool)
    params = {"customer_id": "cust-001"}

    req = ApprovalRequestCreate(
        request_id="req-tool-mismatch-001",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="cust-001",
        action="delete_customer",
        reason="Testing wrong tool",
        parameters=params,
        environment="development",
        policy_id="sentinel-core-policy",
        risk_level="CRITICAL",
        risk_score=85,
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(
        ticket_id=ticket["ticket_id"],
        approver_id="approver-2",
        decision="APPROVED",
    )

    # Attempt consumption with purge_inactive_customer_data: must return False
    wrong_tool_consumed = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="cust-001",
        action="delete_customer",
        tool_name="purge_inactive_customer_data",
        environment="development",
        parameters=params,
    )
    assert wrong_tool_consumed is False


@pytest.mark.asyncio
async def test_wrong_environment_blocked(db_pool):
    """An approval for staging/development cannot authorize production."""
    repo = ApprovalRepository(pool=db_pool)
    params = {"customer_id": "cust-001"}

    req = ApprovalRequestCreate(
        request_id="req-env-mismatch-001",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="cust-001",
        action="delete_customer",
        reason="Testing wrong env",
        parameters=params,
        environment="development",
        policy_id="sentinel-core-policy",
        risk_level="CRITICAL",
        risk_score=85,
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(
        ticket_id=ticket["ticket_id"],
        approver_id="approver-2",
        decision="APPROVED",
    )

    # Attempt consumption in production environment: must return False
    wrong_env_consumed = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="cust-001",
        action="delete_customer",
        tool_name="delete_customer",
        environment="production",
        parameters=params,
    )
    assert wrong_env_consumed is False


@pytest.mark.asyncio
async def test_tampered_ticket_hmac_signature_blocked(db_pool):
    """Verifies that tampering with the HMAC signature in the database blocks ticket execution."""
    repo = ApprovalRepository(pool=db_pool)
    params = {"customer_id": "cust-tamper-001"}

    req = ApprovalRequestCreate(
        request_id="req-tamper-sig-001",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="cust-tamper-001",
        action="delete_customer",
        reason="Testing HMAC tamper detection",
        parameters=params,
        environment="development",
        policy_id="sentinel-core-policy",
        risk_level="CRITICAL",
        risk_score=85,
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(
        ticket_id=ticket["ticket_id"],
        approver_id="approver-2",
        decision="APPROVED",
    )

    # 1. Tamper with the HMAC signature in the database
    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE approval_requests SET signature = $1 WHERE ticket_id = $2",
            "badf00d" * 8,
            ticket["ticket_id"],
        )

    # 2. Attempt execution with tampered signature: must be BLOCKED
    consumed = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="cust-tamper-001",
        action="delete_customer",
        tool_name="delete_customer",
        environment="development",
        parameters=params,
    )
    assert consumed is False


@pytest.mark.asyncio
async def test_tampered_ticket_approver_identity_blocked(db_pool):
    """Verifies that tampering with the approver_id in the database invalidates HMAC signature."""
    repo = ApprovalRepository(pool=db_pool)
    params = {"customer_id": "cust-tamper-002"}

    req = ApprovalRequestCreate(
        request_id="req-tamper-approver-001",
        agent_id="test-agent",
        requester_id="user-1",
        tool_name="delete_customer",
        target_id="cust-tamper-002",
        action="delete_customer",
        reason="Testing approver tamper detection",
        parameters=params,
        environment="development",
        policy_id="sentinel-core-policy",
        risk_level="CRITICAL",
        risk_score=85,
    )
    ticket = await repo.create_approval_request(req)
    await repo.decide_approval(
        ticket_id=ticket["ticket_id"],
        approver_id="approver-2",
        decision="APPROVED",
    )

    # 1. Tamper with approver_id in the database without re-signing
    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE approval_requests SET approver_id = $1 WHERE ticket_id = $2",
            "rogue-approver-99",
            ticket["ticket_id"],
        )

    # 2. Attempt execution: must fail because HMAC signature bound original approver_id
    consumed = await repo.verify_and_consume_bound(
        ticket_id=ticket["ticket_id"],
        target_id="cust-tamper-002",
        action="delete_customer",
        tool_name="delete_customer",
        environment="development",
        parameters=params,
    )
    assert consumed is False
