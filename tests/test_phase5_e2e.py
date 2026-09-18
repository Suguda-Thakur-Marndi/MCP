"""
Phase 5 End-to-End Workflow Test (Complies strictly with Section 38).
Executes the full 22-step human-in-the-loop approval gating workflow:
1. Request normal read.
2. Confirm it works.
3. Request destructive operation.
4. Confirm policy returns REQUIRE_APPROVAL.
5. Confirm approval is created.
6. Confirm destructive DB operation DID NOT happen.
7. Approve using valid human/test actor.
8. Execute the approved operation.
9. Confirm database changed exactly as expected.
10. Attempt replay.
11. Confirm replay is blocked.
12. Modify parameters.
13. Confirm modified execution is blocked.
14. Attempt wrong tool.
15. Confirm it is blocked.
16. Test expired approval.
17. Confirm it is blocked.
18. Test denial.
19. Confirm it is blocked.
20. Test concurrent execution.
21. Confirm only one execution succeeds.
22. Verify audit records.
"""

import asyncio
import datetime
import json

import pytest

from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.audit_repository import AuditRepository
from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.repositories.order_repository import OrderRepository
from mcp_sentinel.schemas.approval import ApprovalRequestCreate
from mcp_sentinel.server.app import create_app
from mcp_sentinel.services.audit_service import AuditService
from mcp_sentinel.services.customer_service import CustomerService
from mcp_sentinel.services.order_service import OrderService


def extract_data(res) -> dict:
    if hasattr(res, "structured_content") and res.structured_content:
        return res.structured_content
    elif hasattr(res, "content") and res.content and hasattr(res.content[0], "text"):
        return json.loads(res.content[0].text)
    elif isinstance(res, dict):
        return res
    return res


@pytest.mark.asyncio
async def test_section_38_complete_manual_e2e_sequence(db_pool):
    cust_repo = CustomerRepository(pool=db_pool)
    appr_repo = ApprovalRepository(pool=db_pool)
    ord_repo = OrderRepository(pool=db_pool)
    aud_repo = AuditRepository(pool=db_pool)

    cust_svc = CustomerService(
        customer_repo=cust_repo, approval_repo=appr_repo, audit_repo=aud_repo
    )
    ord_svc = OrderService(order_repo=ord_repo, audit_repo=aud_repo)
    aud_svc = AuditService(audit_repo=aud_repo)

    server = create_app(
        customer_service=cust_svc,
        order_service=ord_svc,
        audit_service=aud_svc,
    )

    # -------------------------------------------------------------------------
    # STEP 1 & 2: Request normal read and confirm it works
    # -------------------------------------------------------------------------
    read_res = await server.call_tool(
        name="get_customer",
        arguments={"customer_id": "CUST-000001"},
    )
    read_data = extract_data(read_res)
    assert read_data["status"] == "success", "Step 2 failed: Normal read must succeed"
    assert read_data["customer"]["customer_code"] == "CUST-000001"

    # -------------------------------------------------------------------------
    # STEP 3 & 4: Request destructive operation and confirm REQUIRE_APPROVAL
    # -------------------------------------------------------------------------
    del_res = await server.call_tool(
        name="delete_customer",
        arguments={
            "customer_id": "CUST-000001",
            "reason": "GDPR erasure request",
        },
    )
    del_data = extract_data(del_res)
    assert del_data["approval_required"] is True, (
        "Step 4 failed: Policy must return REQUIRE_APPROVAL"
    )
    assert del_data["decision"] == "REQUIRE_APPROVAL"
    assert "ticket_id" in del_data or "approval_id" in del_data

    ticket_id = del_data.get("ticket_id") or del_data.get("approval_id")

    # -------------------------------------------------------------------------
    # STEP 5: Confirm approval record was created in database
    # -------------------------------------------------------------------------
    rec = await appr_repo.get_approval_by_ticket_id(ticket_id)
    assert rec is not None, "Step 5 failed: Approval record must exist in database"
    assert rec["status"] == "PENDING"
    assert rec["tool_name"] == "delete_customer"

    # -------------------------------------------------------------------------
    # STEP 6: Confirm destructive DB operation DID NOT happen
    # -------------------------------------------------------------------------
    async with db_pool.acquire() as conn:
        exists_1 = await conn.fetchval("SELECT COUNT(*) FROM customers WHERE id = 1")
    assert exists_1 == 1, "Step 6 failed: Customer 1 must still exist in DB before human approval"

    # -------------------------------------------------------------------------
    # STEP 7: Approve using valid human/test actor
    # -------------------------------------------------------------------------
    await appr_repo.decide_approval(
        ticket_id=ticket_id,
        approver_id="security-lead-001",
        decision="APPROVED",
        decision_notes="Verified GDPR erasure request authenticity.",
    )
    approved_rec = await appr_repo.get_approval_by_ticket_id(ticket_id)
    assert approved_rec["status"] == "APPROVED", "Step 7 failed: Ticket status must be APPROVED"

    # -------------------------------------------------------------------------
    # STEP 8 & 9: Execute the approved operation and confirm DB changed exactly
    # -------------------------------------------------------------------------
    exec_res = await server.call_tool(
        name="delete_customer",
        arguments={
            "customer_id": "CUST-000001",
            "approval_ticket": ticket_id,
            "reason": "GDPR erasure request",
        },
    )
    exec_data = extract_data(exec_res)
    assert exec_data["status"] == "success", (
        f"Step 8 failed: Approved execution failed: {exec_data}"
    )

    async with db_pool.acquire() as conn:
        exists_after = await conn.fetchval("SELECT COUNT(*) FROM customers WHERE id = 1")
    assert exists_after == 0, "Step 9 failed: Customer 1 must be deleted from DB"

    # -------------------------------------------------------------------------
    # STEP 10 & 11: Attempt replay and confirm replay is blocked
    # -------------------------------------------------------------------------
    replay_res = await server.call_tool(
        name="delete_customer",
        arguments={
            "customer_id": "CUST-000001",
            "approval_ticket": ticket_id,
            "reason": "GDPR erasure request",
        },
    )
    replay_data = extract_data(replay_res)
    assert replay_data["status"] in ("rejected", "error"), (
        "Step 11 failed: Replay attempt must be blocked"
    )
    assert "Access Denied" in replay_data.get("message", "") or "rejected" in replay_data.get(
        "status", ""
    )

    # -------------------------------------------------------------------------
    # STEP 12 & 13: Modify parameters and confirm modified execution is blocked
    # -------------------------------------------------------------------------
    params_orig = {"customer_id": 2, "reason": "Original delete reason"}
    req_tamper = ApprovalRequestCreate(
        request_id="req-e2e-tamper",
        agent_id="test-agent",
        requester_id="user-operator",
        tool_name="delete_customer",
        target_id="2",
        action="delete_customer",
        reason="Original delete reason",
        parameters=params_orig,
        environment="development",
    )
    tamper_ticket = await appr_repo.create_approval_request(req_tamper)
    await appr_repo.decide_approval(tamper_ticket["ticket_id"], "approver-sec", "APPROVED")

    # Verify that executing with modified parameters fails bound check
    tamper_blocked = await appr_repo.verify_and_consume_bound(
        ticket_id=tamper_ticket["ticket_id"],
        target_id="2",
        action="delete_customer",
        tool_name="delete_customer",
        parameters={"customer_id": 2, "reason": "TAMPERED_REASON"},
    )
    assert tamper_blocked is False, "Step 13 failed: Modified parameters must be blocked"

    # -------------------------------------------------------------------------
    # STEP 14 & 15: Attempt wrong tool and confirm it is blocked
    # -------------------------------------------------------------------------
    wrong_tool_blocked = await appr_repo.verify_and_consume_bound(
        ticket_id=tamper_ticket["ticket_id"],
        target_id="2",
        action="delete_customer",
        tool_name="purge_inactive_customer_data",  # Wrong tool!
        parameters=params_orig,
    )
    assert wrong_tool_blocked is False, "Step 15 failed: Wrong tool must be blocked"

    # -------------------------------------------------------------------------
    # STEP 16 & 17: Test expired approval and confirm it is blocked
    # -------------------------------------------------------------------------
    exp_req = ApprovalRequestCreate(
        request_id="req-e2e-exp",
        agent_id="test-agent",
        requester_id="user-operator",
        tool_name="delete_customer",
        target_id="2",
        action="delete_customer",
        reason="Expired ticket test",
        parameters={"customer_id": 2},
    )
    exp_ticket = await appr_repo.create_approval_request(exp_req)
    await appr_repo.decide_approval(exp_ticket["ticket_id"], "approver-sec", "APPROVED")
    # Expire it manually in DB
    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE approval_requests SET expires_at = $1 WHERE ticket_id = $2",
            datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=10),
            exp_ticket["ticket_id"],
        )
    exp_blocked = await appr_repo.verify_and_consume_bound(
        ticket_id=exp_ticket["ticket_id"],
        target_id="2",
        action="delete_customer",
        tool_name="delete_customer",
        parameters={"customer_id": 2},
    )
    assert exp_blocked is False, "Step 17 failed: Expired approval must be blocked"

    # -------------------------------------------------------------------------
    # STEP 18 & 19: Test denial and confirm it is blocked
    # -------------------------------------------------------------------------
    deny_req = ApprovalRequestCreate(
        request_id="req-e2e-deny",
        agent_id="test-agent",
        requester_id="user-operator",
        tool_name="delete_customer",
        target_id="2",
        action="delete_customer",
        reason="Denial test",
        parameters={"customer_id": 2},
    )
    deny_ticket = await appr_repo.create_approval_request(deny_req)
    await appr_repo.decide_approval(
        ticket_id=deny_ticket["ticket_id"],
        approver_id="approver-sec",
        decision="DENIED",
        decision_notes="Unauthorized account deletion request rejected.",
    )
    deny_blocked = await appr_repo.verify_and_consume_bound(
        ticket_id=deny_ticket["ticket_id"],
        target_id="2",
        action="delete_customer",
        tool_name="delete_customer",
        parameters={"customer_id": 2},
    )
    assert deny_blocked is False, "Step 19 failed: Denied ticket must be blocked"

    # -------------------------------------------------------------------------
    # STEP 20 & 21: Test concurrent execution and confirm only one succeeds
    # -------------------------------------------------------------------------
    conc_params = {"customer_id": 2, "reason": "Concurrent execution test"}
    conc_req = ApprovalRequestCreate(
        request_id="req-e2e-conc",
        agent_id="test-agent",
        requester_id="user-operator",
        tool_name="delete_customer",
        target_id="2",
        action="delete_customer",
        reason="Concurrent execution test",
        parameters=conc_params,
        environment="development",
    )
    conc_ticket = await appr_repo.create_approval_request(conc_req)
    await appr_repo.decide_approval(conc_ticket["ticket_id"], "approver-lead", "APPROVED")

    async def _try_exec(worker_id: int):
        try:
            res = await cust_svc.delete_customer(
                customer_id=2,
                approval_ticket=conc_ticket["ticket_id"],
                reason="Concurrent execution test",
                raw_parameters=conc_params,
            )
            return {"worker": worker_id, "success": True, "result": res}
        except Exception as exc:
            return {"worker": worker_id, "success": False, "error": str(exc)}

    conc_results = await asyncio.gather(*[_try_exec(i) for i in range(5)])
    success_count = sum(1 for r in conc_results if r["success"])
    fail_count = sum(1 for r in conc_results if not r["success"])
    assert success_count == 1, f"Step 21 failed: Expected exactly 1 success, got {success_count}"
    assert fail_count == 4, f"Step 21 failed: Expected exactly 4 blocked attempts, got {fail_count}"

    # -------------------------------------------------------------------------
    # STEP 22: Verify audit records
    # -------------------------------------------------------------------------
    async with db_pool.acquire() as conn:
        audit_records = await conn.fetch(
            "SELECT event_type, tool_name, decision FROM audit_events ORDER BY id DESC LIMIT 50"
        )
    event_types = {r["event_type"] for r in audit_records}
    assert "APPROVAL_CREATED" in event_types or "APPROVAL_REQUIRED" in event_types, (
        "Step 22 failed: Missing APPROVAL_CREATED in audit events"
    )
    assert "DESTRUCTIVE_ACTION_EXECUTED" in event_types, (
        "Step 22 failed: Missing DESTRUCTIVE_ACTION_EXECUTED in audit events"
    )
    assert "DESTRUCTIVE_ACTION_BLOCKED" in event_types, (
        "Step 22 failed: Missing DESTRUCTIVE_ACTION_BLOCKED in audit events"
    )
