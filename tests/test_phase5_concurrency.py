"""
Phase 5 Mandatory Concurrency Test: Race Condition & Atomic Execution Under Load.
Complies with Section 26:
- Concurrently invokes the SAME approved destructive deletion with multiple parallel workers.
- Guarantees that EXACTLY ONE execution succeeds.
- Guarantees that all other concurrent requests are blocked safely.
- Verifies database integrity (count before - 1 == count after).
"""

import asyncio

import pytest

from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.schemas.approval import ApprovalRequestCreate
from mcp_sentinel.services.customer_service import CustomerService


@pytest.mark.asyncio
async def test_concurrent_execution_race_condition(db_pool):
    """
    Simulates high-concurrency race condition:
    10 simultaneous requests attempt to execute the exact same approved customer deletion.
    Expected:
    - Exactly ONE request successfully executes and deletes customer 1.
    - 9 requests fail safely (blocked by atomic row-level lock and COMPLETED status).
    - Database customer count drops by exactly 1.
    """
    approval_repo = ApprovalRepository(pool=db_pool)
    customer_repo = CustomerRepository(pool=db_pool)
    service = CustomerService(customer_repo=customer_repo, approval_repo=approval_repo)

    # 1. Capture initial DB state
    async with db_pool.acquire() as conn:
        initial_count = await conn.fetchval("SELECT COUNT(*) FROM customers")
        exists_before = await conn.fetchval("SELECT COUNT(*) FROM customers WHERE id = 1")
    assert exists_before > 0

    # 2. Create approval request for deleting customer 1
    params = {"customer_id": 1, "reason": "Authorized account closure"}
    req = ApprovalRequestCreate(
        request_id="req-concurrency-001",
        agent_id="test-agent",
        requester_id="user-operator-1",
        tool_name="delete_customer",
        target_id="1",
        action="delete_customer",
        reason="Authorized account closure",
        parameters=params,
        environment="development",
    )
    ticket = await approval_repo.create_approval_request(req)
    ticket_id = ticket["ticket_id"]

    # 3. Human Approver approves the ticket
    await approval_repo.decide_approval(
        ticket_id=ticket_id,
        approver_id="user-approver-lead",
        decision="APPROVED",
        decision_notes="Approved for concurrent execution test.",
    )

    # 4. Concurrently trigger deletion from 10 parallel tasks using the SAME ticket
    async def _execute_attempt(worker_idx: int):
        try:
            res = await service.delete_customer(
                customer_id=1,
                approval_ticket=ticket_id,
                reason="Authorized account closure",
                raw_parameters=params,
            )
            return {"worker": worker_idx, "success": True, "result": res}
        except Exception as exc:
            return {"worker": worker_idx, "success": False, "error": str(exc)}

    workers = 10
    tasks = [_execute_attempt(i) for i in range(workers)]
    outcomes = await asyncio.gather(*tasks)

    # 5. Evaluate outcomes
    successes = [o for o in outcomes if o["success"]]
    failures = [o for o in outcomes if not o["success"]]

    assert len(successes) == 1, (
        f"Concurrency failure! Expected exactly 1 success, got {len(successes)}: {successes}"
    )
    assert len(failures) == workers - 1

    for f in failures:
        assert "Access Denied" in f["error"] or "invalid" in f["error"].lower()

    # 6. Verify database state
    async with db_pool.acquire() as conn:
        final_count = await conn.fetchval("SELECT COUNT(*) FROM customers")
        exists_after = await conn.fetchval("SELECT COUNT(*) FROM customers WHERE id = 1")
    assert final_count == initial_count - 1
    assert exists_after == 0

    # 7. Check ticket status is COMPLETED
    rec = await approval_repo.get_approval_by_ticket_id(ticket_id)
    assert rec["status"] == "COMPLETED"
