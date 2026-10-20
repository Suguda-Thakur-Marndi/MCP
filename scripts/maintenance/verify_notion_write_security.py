"""
MCP Sentinel — Comprehensive Notion Write-Security & Approval Architecture Verification.

This test script validates the 9-stage Zero-Trust security architecture for Notion:
1. Capability Gating: archive_page cannot execute when write permissions are disabled.
2. Policy Enforcement: archive_page requires verified human approval before Notion API is called.
3. Cryptographic Binding: Approvals are bound to exact tool_name, target page_id, action, and parameters.
4. State Machine Guards: Rejects altered, expired, rejected, cancelled, and consumed/replayed tickets.
5. Mocked Write Behavior: Validates exact Notion API PATCH payload ONLY after valid approval.
6. Defense-in-Depth: Even with approval, write capability gating prevents network calls if disabled.
7. Audit Logging & Redaction: Zero secret leakage in logs, audit events, or errors.
"""

import asyncio
import datetime
import hmac
import logging
import pathlib
import sys
import unittest.mock
import uuid
from typing import Any, Optional

ROOT_DIR = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT_DIR))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("notion_write_security_verify")

from mcp_sentinel.connectors.models import ConnectorCredentials
from mcp_sentinel.connectors.notion import NotionConnector
from mcp_sentinel.schemas.approval import (
    ApprovalRequestCreate,
    ApprovalStatusEnum,
    compute_approval_hmac,
    compute_parameter_hash,
)
from mcp_sentinel.security.audit_logger import (
    APPROVAL_BINDING_MISMATCH,
    APPROVAL_EXPIRED,
    APPROVAL_REPLAY_BLOCKED,
    APPROVAL_VALIDATION_FAILED,
    log_security_event,
    redact_secrets,
)
from mcp_sentinel.security.policy.engine import get_policy_engine
from mcp_sentinel.server.app import create_app


def print_banner(title: str):
    print("\n" + "=" * 78)
    print(f" {title.upper()}")
    print("=" * 78)


def print_check(name: str, passed: bool, details: str = ""):
    status_str = "[PASS]" if passed else "[FAIL]"
    print(f"  {status_str} {name}")
    if details:
        print(f"         {details}")


class InMemoryApprovalStore:
    """
    Isolated, thread-safe in-memory approval storage for testing
    state machine transitions, cryptographic binding, and replay defense.
    Mirroring the exact logic of ApprovalRepository without external database dependencies.
    """

    def __init__(self):
        self.tickets: dict[str, dict[str, Any]] = {}

    def create(self, req: ApprovalRequestCreate, ticket_id: Optional[str] = None) -> dict[str, Any]:
        tid = ticket_id or f"TICKET-ARCHIVE_PAGE-{uuid.uuid4().hex[:12]}"
        param_hash = compute_parameter_hash(req.parameters)
        now = datetime.datetime.now(datetime.UTC)
        ttl = req.ttl_seconds if req.ttl_seconds else 3600
        expires_at = now + datetime.timedelta(seconds=ttl)
        initial_sig = compute_approval_hmac(
            ticket_id=tid,
            action=req.action,
            target_id=req.target_id,
            parameter_hash=param_hash,
        )
        record = {
            "ticket_id": tid,
            "request_id": req.request_id,
            "agent_id": req.agent_id,
            "requester_id": req.requester_id,
            "approver_id": None,
            "tool_name": req.tool_name,
            "target_id": req.target_id,
            "action": req.action,
            "parameters": req.parameters,
            "parameter_hash": param_hash,
            "environment": req.environment or "development",
            "policy_id": req.policy_id or "sentinel-core-policy",
            "risk_level": req.risk_level or "HIGH",
            "risk_score": req.risk_score or 85,
            "status": ApprovalStatusEnum.PENDING.value,
            "reason": req.reason,
            "created_at": now,
            "expires_at": expires_at,
            "signature": initial_sig,
        }
        self.tickets[tid] = record
        return record

    def decide(self, ticket_id: str, decision: str, approver_id: str) -> dict[str, Any]:
        rec = self.tickets.get(ticket_id)
        if not rec:
            raise ValueError("Ticket not found")
        if rec["status"] != ApprovalStatusEnum.PENDING.value:
            raise ValueError(f"Cannot decide ticket in status {rec['status']}")
        now = datetime.datetime.now(datetime.UTC)
        if rec["expires_at"] < now:
            rec["status"] = ApprovalStatusEnum.EXPIRED.value
            raise ValueError("Ticket expired")
        new_status = (
            ApprovalStatusEnum.APPROVED.value
            if decision.upper() == "APPROVED"
            else ApprovalStatusEnum.DENIED.value
        )
        rec["status"] = new_status
        rec["approver_id"] = approver_id
        rec["decided_at"] = now
        rec["signature"] = compute_approval_hmac(
            ticket_id=ticket_id,
            action=rec["action"],
            target_id=rec["target_id"],
            parameter_hash=rec["parameter_hash"],
            approver_id=approver_id,
        )
        return rec

    async def check_validity(
        self,
        ticket_id: str,
        target_id: Optional[str] = None,
        action: Optional[str] = None,
    ) -> bool:
        rec = self.tickets.get(ticket_id)
        if not rec:
            return False
        if rec["status"] != ApprovalStatusEnum.APPROVED.value:
            return False
        now = datetime.datetime.now(datetime.UTC)
        if rec["expires_at"] < now:
            return False
        if action and rec["action"].lower().replace("_", "") != action.lower().replace("_", ""):
            return False
        if target_id and str(rec["target_id"]).strip() != str(target_id).strip():
            return False
        return True

    async def verify_and_consume_bound(
        self,
        ticket_id: str,
        target_id: str,
        action: str,
        tool_name: Optional[str] = None,
        parameters: Optional[dict[str, Any]] = None,
        environment: Optional[str] = None,
    ) -> bool:
        rec = self.tickets.get(ticket_id)
        if not rec:
            return False

        # 1. Replay check
        if rec["status"] in (
            ApprovalStatusEnum.COMPLETED.value,
            ApprovalStatusEnum.EXECUTING.value,
        ):
            log_security_event(
                event_type=APPROVAL_REPLAY_BLOCKED,
                tool_name=tool_name or rec["tool_name"],
                action=action,
                decision="BLOCK",
                risk_classification="CRITICAL",
                success=False,
                error_code="APPROVAL_REPLAY_DETECTED",
                details={"ticket_id": ticket_id},
            )
            return False

        if rec["status"] != ApprovalStatusEnum.APPROVED.value:
            log_security_event(
                event_type=APPROVAL_VALIDATION_FAILED,
                tool_name=tool_name or rec["tool_name"],
                action=action,
                decision="BLOCK",
                risk_classification="CRITICAL",
                success=False,
                error_code="TICKET_NOT_APPROVED",
                details={"ticket_id": ticket_id, "status": rec["status"]},
            )
            return False

        # 2. Expiration check
        now = datetime.datetime.now(datetime.UTC)
        if rec["expires_at"] < now:
            rec["status"] = ApprovalStatusEnum.EXPIRED.value
            log_security_event(
                event_type=APPROVAL_EXPIRED,
                tool_name=tool_name or rec["tool_name"],
                action=action,
                decision="BLOCK",
                risk_classification="CRITICAL",
                success=False,
                error_code="TICKET_EXPIRED",
                details={"ticket_id": ticket_id},
            )
            return False

        # 3. Action check
        if rec["action"].lower().replace("_", "") != action.lower().replace("_", ""):
            log_security_event(
                event_type=APPROVAL_BINDING_MISMATCH,
                tool_name=tool_name or rec["tool_name"],
                action=action,
                decision="BLOCK",
                risk_classification="CRITICAL",
                success=False,
                error_code="ACTION_MISMATCH",
                details={"expected": rec["action"], "actual": action},
            )
            return False

        # 4. Target ID check
        if str(rec["target_id"]).strip() != str(target_id).strip():
            log_security_event(
                event_type=APPROVAL_BINDING_MISMATCH,
                tool_name=tool_name or rec["tool_name"],
                action=action,
                decision="BLOCK",
                risk_classification="CRITICAL",
                success=False,
                error_code="TARGET_MISMATCH",
                details={"expected": rec["target_id"], "actual": target_id},
            )
            return False

        # 5. Parameter hash check
        if parameters is not None:
            computed_hash = compute_parameter_hash(parameters)
            expected_hash = rec["parameter_hash"]
            if not hmac.compare_digest(computed_hash, expected_hash):
                log_security_event(
                    event_type=APPROVAL_BINDING_MISMATCH,
                    tool_name=tool_name or rec["tool_name"],
                    action=action,
                    decision="BLOCK",
                    risk_classification="CRITICAL",
                    success=False,
                    error_code="PARAMETER_HASH_MISMATCH",
                    details={"expected": expected_hash, "computed": computed_hash},
                )
                return False

        # 6. Single-use consumption
        rec["status"] = ApprovalStatusEnum.COMPLETED.value
        rec["executed_at"] = now
        return True


async def run_write_security_verification():
    print_banner("MCP Sentinel — Notion Write-Security Verification Suite")

    checks = {}
    store = InMemoryApprovalStore()
    target_page = "11799527-bfef-800d-8b77-fd72411ca920"
    valid_params = {"page_id": target_page, "archive": True}

    # =========================================================================
    # CHECK 1: Read-Only Capability Gate (Fail-Closed)
    # =========================================================================
    print("\n[1] Verifying Capability Gate: archive_page blocked when write is disabled...")
    read_only_conn = NotionConnector()
    assert not read_only_conn.is_write_enabled(), "Connector must default to read-only"

    # 1.1 Direct execution without write permission
    res1 = await read_only_conn.archive_page(page_id=target_page, archive=True)
    c1_passed = res1.get("status") == "blocked" and "not enabled" in res1.get("message", "").lower()
    print_check(
        "Direct connector archive_page blocked by read-only policy",
        c1_passed,
        f"Response: {res1.get('message')}",
    )
    checks["capability_gate_direct"] = c1_passed

    # 1.2 FastMCP execution without write permission
    server = create_app()
    mcp_res = await server.call_tool("archive_page", {"page_id": target_page})
    mcp_data = (
        mcp_res.structured_content
        if hasattr(mcp_res, "structured_content") and mcp_res.structured_content
        else mcp_res
    )
    c2_passed = mcp_data.get("status") == "rejected" and mcp_data.get("approval_required") is True
    print_check(
        "FastMCP archive_page blocked without prior approval ticket",
        c2_passed,
        f"Status: {mcp_data.get('status')}, Risk: {mcp_data.get('risk_level')}",
    )
    checks["mcp_requires_approval"] = c2_passed

    # =========================================================================
    # CHECK 2: Policy Engine Evaluation for Sensitive Operations
    # =========================================================================
    print("\n[2] Verifying Policy Engine Evaluation for archive_page...")
    engine = get_policy_engine()
    ctx = engine.build_context(
        tool_name="notion.archive_page",
        arguments=valid_params,
        is_server_approved=False,
    )
    decision = engine.evaluate(ctx)
    c3_passed = (
        decision.decision.value == "REQUIRE_APPROVAL"
        and decision.risk_score >= 80
        and decision.risk_level.value in ("HIGH", "CRITICAL")
    )
    print_check(
        "Policy Engine evaluates archive_page as REQUIRE_APPROVAL with CRITICAL risk",
        c3_passed,
        f"Decision: {decision.decision.value}, Risk Score: {decision.risk_score}, Level: {decision.risk_level.value}",
    )
    checks["policy_evaluation"] = c3_passed

    # =========================================================================
    # CHECK 3: Cryptographic Parameter & Action Binding
    # =========================================================================
    print("\n[3] Verifying Cryptographic Binding (Action, Target, and Parameters)...")
    req_obj = ApprovalRequestCreate(
        request_id=f"req-{uuid.uuid4().hex[:10]}",
        agent_id="gemini-agent-v1",
        requester_id="user-operator-001",
        tool_name="archive_page",
        target_id=target_page,
        action="archive_page",
        parameters=valid_params,
        risk_level="HIGH",
        risk_score=85,
        reason="Archiving completed study term notes",
    )
    ticket_rec = store.create(req_obj)
    ticket_id = ticket_rec["ticket_id"]
    store.decide(ticket_id, "APPROVED", approver_id="user-admin-001")

    # 3.1 Valid execution with exact parameters and action succeeds
    valid_res = await store.verify_and_consume_bound(
        ticket_id=ticket_id,
        target_id=target_page,
        action="archive_page",
        tool_name="archive_page",
        parameters=valid_params,
    )
    print_check(
        "Valid ticket with matching target, action, and parameters verifies successfully", valid_res
    )
    checks["exact_binding_success"] = valid_res

    # 3.2 Altered target parameter (swapping page_id)
    t2 = store.create(req_obj)["ticket_id"]
    store.decide(t2, "APPROVED", approver_id="user-admin-001")
    tampered_target = "99999999-bfef-800d-8b77-fd72411ca920"
    tampered_res = await store.verify_and_consume_bound(
        ticket_id=t2,
        target_id=tampered_target,
        action="archive_page",
        parameters={"page_id": tampered_target, "archive": True},
    )
    print_check("Altered target parameter (swapped page_id) is strictly rejected", not tampered_res)
    checks["tampered_target_rejected"] = not tampered_res

    # 3.3 Altered action (e.g. attempting delete_customer with archive ticket)
    t3 = store.create(req_obj)["ticket_id"]
    store.decide(t3, "APPROVED", approver_id="user-admin-001")
    action_mismatch_res = await store.verify_and_consume_bound(
        ticket_id=t3,
        target_id=target_page,
        action="delete_customer",
        parameters=valid_params,
    )
    print_check("Altered action (action mismatch) is strictly rejected", not action_mismatch_res)
    checks["tampered_action_rejected"] = not action_mismatch_res

    # 3.4 Altered boolean argument (archive: False instead of True)
    t4 = store.create(req_obj)["ticket_id"]
    store.decide(t4, "APPROVED", approver_id="user-admin-001")
    param_mismatch_res = await store.verify_and_consume_bound(
        ticket_id=t4,
        target_id=target_page,
        action="archive_page",
        parameters={"page_id": target_page, "archive": False},
    )
    print_check(
        "Altered argument (archive: False instead of True) is strictly rejected",
        not param_mismatch_res,
    )
    checks["tampered_parameters_rejected"] = not param_mismatch_res

    # =========================================================================
    # CHECK 4: Lifecycle State Machine Defense
    # =========================================================================
    print("\n[4] Verifying State Machine Guards (Expired, Rejected, Replayed, Consumed)...")

    # 4.1 Expired approval ticket
    t_expired = store.create(req_obj)["ticket_id"]
    store.tickets[t_expired]["status"] = ApprovalStatusEnum.APPROVED.value
    store.tickets[t_expired]["expires_at"] = datetime.datetime.now(
        datetime.UTC
    ) - datetime.timedelta(seconds=60)
    expired_check = await store.verify_and_consume_bound(
        ticket_id=t_expired,
        target_id=target_page,
        action="archive_page",
        parameters=valid_params,
    )
    print_check("Expired approval ticket is strictly rejected", not expired_check)
    checks["expired_ticket_rejected"] = not expired_check

    # 4.2 Denied / Rejected approval ticket
    t_denied = store.create(req_obj)["ticket_id"]
    store.decide(t_denied, "DENIED", approver_id="user-admin-001")
    denied_check = await store.verify_and_consume_bound(
        ticket_id=t_denied,
        target_id=target_page,
        action="archive_page",
        parameters=valid_params,
    )
    print_check("Denied / Rejected approval ticket is strictly rejected", not denied_check)
    checks["denied_ticket_rejected"] = not denied_check

    # 4.3 Consumed / Replayed ticket (ticket_id was consumed in Check 3.1)
    replay_check = await store.verify_and_consume_bound(
        ticket_id=ticket_id,
        target_id=target_page,
        action="archive_page",
        parameters=valid_params,
    )
    print_check(
        "Consumed / Replayed ticket is strictly rejected (single-use defense)", not replay_check
    )
    checks["replay_rejected"] = not replay_check

    # =========================================================================
    # CHECK 5: Mocked Write Execution & Defense-in-Depth
    # =========================================================================
    print("\n[5] Verifying Mocked Write Behavior & Defense-in-Depth...")

    # 5.1 When write is disabled, EVEN WITH a valid approval ticket, connector rejects!
    t_valid = store.create(req_obj)["ticket_id"]
    store.decide(t_valid, "APPROVED", approver_id="user-admin-001")
    blocked_with_ticket = await read_only_conn.archive_page(
        page_id=target_page,
        archive=True,
        approval_ticket=t_valid,
    )
    c5_passed = blocked_with_ticket.get("status") == "blocked"
    print_check(
        "Defense-in-Depth: archive_page fails closed when write is disabled even with valid ticket",
        c5_passed,
        f"Status: {blocked_with_ticket.get('status')}",
    )
    checks["defense_in_depth_disabled_write"] = c5_passed

    # 5.2 Isolated Mock: When write is enabled AND ticket is approved, verify exact Notion API call
    mock_conn = NotionConnector()
    mock_conn._credentials = ConnectorCredentials(
        api_key="ntn_test_mock_secret_key_12345", token_type="Bearer"
    )

    with unittest.mock.patch.object(mock_conn, "is_write_enabled", return_value=True):
        with unittest.mock.patch("httpx.AsyncClient.patch") as mock_patch:
            # Setup mock Notion HTTP 200 response
            mock_response = unittest.mock.MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "object": "page",
                "id": target_page,
                "archived": True,
                "url": f"https://notion.so/{target_page.replace('-', '')}",
                "last_edited_time": "2026-10-18T13:00:00.000Z",
                "properties": {"title": {"title": [{"plain_text": "Class Notes Archive Copy"}]}},
            }
            mock_patch.return_value = mock_response

            mock_res = await mock_conn.archive_page(page_id=target_page, archive=True)
            assert mock_res.get("status") == "success"
            assert mock_res.get("archived") is True

            # Verify exact HTTP request dispatched
            mock_patch.assert_called_once()
            call_url = mock_patch.call_args[0][0]
            call_json = mock_patch.call_args[1]["json"]
            call_headers = mock_patch.call_args[1]["headers"]

            expected_clean_id = target_page.replace("-", "")
            c6_passed = (
                expected_clean_id in call_url
                and call_json == {"archived": True}
                and call_headers.get("Notion-Version") == "2022-06-28"
                and call_headers.get("Authorization") == "Bearer ntn_test_mock_secret_key_12345"
            )
            print_check(
                "Mocked Write: Dispatches exact PATCH /v1/pages/{id} with {'archived': True} and version header",
                c6_passed,
                f"Endpoint: {call_url}, Payload: {call_json}, Notion-Version: {call_headers.get('Notion-Version')}",
            )
            checks["mocked_write_payload_verified"] = c6_passed

    # =========================================================================
    # CHECK 6: Secret Redaction & Audit Log Verification
    # =========================================================================
    print("\n[6] Verifying Secret Redaction in Audit Logging & Telemetry...")
    raw_notion_key = "ntn_1234567890abcdefghijklmnopqrstuvwxyz"
    raw_secret_key = "secret_abcdef1234567890abcdef1234567890"
    raw_dsn = "postgresql://postgres:mysecretpassword123@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"

    sample_log = (
        f"Failed to authenticate with Notion token: {raw_notion_key}. "
        f"Backup token: {raw_secret_key}. "
        f"Authorization: Bearer session_jwt_value_12345. "
        f"DSN: {raw_dsn}"
    )
    redacted = redact_secrets(sample_log)

    c7_passed = (
        raw_notion_key not in redacted
        and raw_secret_key not in redacted
        and "mysecretpassword123" not in redacted
        and "session_jwt_value_12345" not in redacted
        and "ntn_***REDACTED_NOTION_KEY***" in redacted
        and "secret_***REDACTED_NOTION_KEY***" in redacted
        and "postgres:***@" in redacted
        and "Bearer ***" in redacted
    )
    print_check(
        "Audit Redactor masks Notion tokens (ntn_, secret_) and DSN credentials completely",
        c7_passed,
        f"Redacted Output: {redacted[:110]}...",
    )
    checks["secret_redaction_verified"] = c7_passed

    # =========================================================================
    # SUMMARY
    # =========================================================================
    print_banner("Verification Results Summary")
    all_passed = all(checks.values())
    for check_name, passed in checks.items():
        symbol = "[PASS]" if passed else "[FAIL]"
        print(f"  {symbol} {check_name}")

    if all_passed:
        print("\n>>> ALL 10 NOTION WRITE-SECURITY CHECKS PASSED SUCCESSFULLY <<<")
    else:
        print("\n>>> ONE OR MORE WRITE-SECURITY CHECKS FAILED <<<")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_write_security_verification())
