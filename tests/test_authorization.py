"""
Category D: Authorization & Gating Tests.
Verifies:
- Security Rule #1: Never trust the AI agent.
- Security Rule #3: Never trust client-provided approval information.
- Security Rule #7: The MCP server itself must enforce security.
- Security Rule #10: Fail closed for security-sensitive failures.
"""

import pytest

from mcp_sentinel.tools.destructive_tools import handle_purge_inactive_customer_data


@pytest.mark.asyncio
async def test_destructive_purge_without_ticket_fails_closed(customer_repo, approval_repo):
    """Verifies that missing or empty approval ticket is blocked."""
    args = {
        "customer_id": 3,
        "approval_ticket": "",
        "reason": "Test purge without ticket",
    }
    res = await handle_purge_inactive_customer_data(customer_repo, approval_repo, args)
    assert res["status"] in ("error", "rejected")


@pytest.mark.asyncio
async def test_destructive_purge_with_fake_ticket_fails_closed(customer_repo, approval_repo):
    """Verifies that fabricated non-existent ticket is blocked."""
    args = {
        "customer_id": 3,
        "approval_ticket": "TICKET-FABRICATED-FAKE-999",
        "reason": "Unauthorized deletion attempt",
    }
    res = await handle_purge_inactive_customer_data(customer_repo, approval_repo, args)
    assert res["status"] == "rejected"
    assert "Access Denied" in res["message"]


@pytest.mark.asyncio
async def test_destructive_purge_with_unapproved_ticket_fails_closed(customer_repo, approval_repo):
    """Verifies that unapproved ticket (approved=FALSE) is blocked."""
    args = {
        "customer_id": 5,
        "approval_ticket": "TICKET-UNAPPROVED-005",
        "reason": "Attempting purge with unapproved ticket",
    }
    res = await handle_purge_inactive_customer_data(customer_repo, approval_repo, args)
    assert res["status"] == "rejected"


@pytest.mark.asyncio
async def test_destructive_purge_with_consumed_ticket_fails_closed_replay_defense(
    customer_repo, approval_repo
):
    """Verifies replay attack defense: consumed tickets cannot be reused."""
    args = {
        "customer_id": 1,
        "approval_ticket": "TICKET-CONSUMED-001",
        "reason": "Replaying previously consumed authorization",
    }
    res = await handle_purge_inactive_customer_data(customer_repo, approval_repo, args)
    assert res["status"] == "rejected"


@pytest.mark.asyncio
async def test_destructive_purge_with_expired_ticket_fails_closed(customer_repo, approval_repo):
    """Verifies that expired approval tickets are blocked."""
    args = {
        "customer_id": 7,
        "approval_ticket": "TICKET-EXPIRED-007",
        "reason": "Attempting purge with expired ticket",
    }
    res = await handle_purge_inactive_customer_data(customer_repo, approval_repo, args)
    assert res["status"] == "rejected"


@pytest.mark.asyncio
async def test_destructive_purge_target_mismatch_fails_closed(customer_repo, approval_repo):
    """Verifies that ticket for customer 3 cannot be used to purge customer 4."""
    args = {
        "customer_id": 4,
        "approval_ticket": "TICKET-VALID-PURGE-003",
        "reason": "Cross-customer authorization bypass attempt",
    }
    res = await handle_purge_inactive_customer_data(customer_repo, approval_repo, args)
    assert res["status"] == "rejected"


@pytest.mark.asyncio
async def test_destructive_purge_action_mismatch_fails_closed(customer_repo, approval_repo):
    """Verifies that ticket for EXPORT cannot be used for PURGE."""
    args = {
        "customer_id": 3,
        "approval_ticket": "TICKET-WRONG-ACTION-003",
        "reason": "Cross-action authorization escalation attempt",
    }
    res = await handle_purge_inactive_customer_data(customer_repo, approval_repo, args)
    assert res["status"] == "rejected"


@pytest.mark.asyncio
async def test_destructive_purge_client_assertions_ignored(customer_repo, approval_repo):
    """Verifies that client passing 'approved: true' cannot bypass server gating."""
    args = {
        "customer_id": 3,
        "approval_ticket": "TICKET-INVALID-123",
        "reason": "Purge attempt with client claim",
        "approved": True,  # Client asserting approved=True
    }
    res = await handle_purge_inactive_customer_data(customer_repo, approval_repo, args)
    # Extra field rejected or ticket validation fails
    assert res["status"] in ("error", "rejected")
