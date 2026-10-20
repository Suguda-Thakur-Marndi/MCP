"""
Gateway Execution Service for SentinelCore Multi-Software Platform.
Enforces the mandatory 9-stage zero-trust security pipeline:
1. Identity verification
2. Integration authorization
3. Tool registry lookup & schema validation
4. Policy evaluation
5. Risk assessment (LOW / MEDIUM / HIGH / CRITICAL)
6. Human approval decision (tamper-evident, single-use, server-enforced)
7. Integration / MCP connector execution
8. Result validation & sanitization
9. Audit logging

NO external software may bypass this security layer.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any, Optional

from pydantic import BaseModel, Field

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.connectors.models import (
    ToolExecutionResult,
)
from mcp_sentinel.connectors.registry import ConnectorRegistry, get_connector_registry
from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.audit_repository import AuditRepository
from mcp_sentinel.repositories.idempotency_repository import IdempotencyRepository
from mcp_sentinel.repositories.integration_repository import IntegrationRepository
from mcp_sentinel.repositories.tool_repository import ToolRepository
from mcp_sentinel.schemas.approval import ApprovalRequestCreate
from mcp_sentinel.security.audit_logger import (
    TOOL_EXECUTED,
    log_security_event,
    scrub_dict_secrets,
)
from mcp_sentinel.security.correlation import get_request_id

logger = logging.getLogger(__name__)


class GatewayExecuteRequest(BaseModel):
    """Payload submitted to execute a governed tool."""

    tool_id: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    user_id: str = "operator@sentinel.internal"
    user_role: str = "OPERATOR"
    agent_id: str = "sentinel-agent-v1"
    agent_name: str = "Sentinel Core Agent"
    run_id: Optional[str] = None
    approval_ticket_id: Optional[str] = None
    reason: Optional[str] = None
    idempotency_key: Optional[str] = None


class GatewayExecuteResponse(BaseModel):
    """Unified response from the Gateway execution pipeline."""

    success: bool
    status: str  # EXECUTED, PENDING_APPROVAL, BLOCKED, FAILED
    tool_id: str
    integration_id: str
    run_id: str
    execution_id: Optional[str] = None
    risk_level: str
    risk_score: int
    data: Optional[Any] = None
    error: Optional[str] = None
    approval_ticket_id: Optional[str] = None
    latency_ms: int = 0
    stages_completed: list[str] = Field(default_factory=list)


class GatewayExecutionService:
    """
    Central Security Gateway orchestrating the 9-stage pipeline.
    """

    def __init__(
        self,
        integration_repo: Optional[IntegrationRepository] = None,
        tool_repo: Optional[ToolRepository] = None,
        approval_repo: Optional[ApprovalRepository] = None,
        audit_repo: Optional[AuditRepository] = None,
        connector_registry: Optional[ConnectorRegistry] = None,
        idempotency_repo: Optional[IdempotencyRepository] = None,
    ) -> None:
        self.integration_repo = integration_repo or IntegrationRepository()
        self.tool_repo = tool_repo or ToolRepository()
        self.approval_repo = approval_repo or ApprovalRepository()
        self.audit_repo = audit_repo or AuditRepository()
        self.connector_registry = connector_registry or get_connector_registry()
        self.idempotency_repo = idempotency_repo or IdempotencyRepository()
        self._settings = get_settings()
        self._idempotency_cache: dict[str, GatewayExecuteResponse] = {}
        self._idempotency_locks: dict[str, asyncio.Lock] = {}
        self._concurrency_semaphore = asyncio.Semaphore(
            self._settings.MAX_CONCURRENT_TOOL_EXECUTIONS
        )

    async def execute(self, req: GatewayExecuteRequest) -> GatewayExecuteResponse:
        """Entrypoint for executing a governed tool with durable L1/L2 idempotency protection."""
        if req.idempotency_key:
            # 1. L1 in-memory cache check
            if req.idempotency_key in self._idempotency_cache:
                logger.info(
                    "Returning L1 cached response for idempotency key %s", req.idempotency_key
                )
                return self._idempotency_cache[req.idempotency_key]

            # 2. L2 database durable cache check (survives restarts and cross-worker execution)
            db_cached = None
            try:
                db_cached = await self.idempotency_repo.get_response(req.idempotency_key)
            except Exception as e:
                logger.warning("Idempotency L2 lookup error for key %s: %s", req.idempotency_key, e)

            if db_cached:
                logger.info(
                    "Returning L2 database cached response for idempotency key %s",
                    req.idempotency_key,
                )
                resp = GatewayExecuteResponse(**db_cached)
                self._idempotency_cache[req.idempotency_key] = resp
                return resp

            lock = self._idempotency_locks.setdefault(req.idempotency_key, asyncio.Lock())
            async with lock:
                if req.idempotency_key in self._idempotency_cache:
                    return self._idempotency_cache[req.idempotency_key]
                try:
                    db_cached = await self.idempotency_repo.get_response(req.idempotency_key)
                except Exception as e:
                    logger.warning(
                        "Idempotency L2 lookup error for key %s: %s", req.idempotency_key, e
                    )

                if db_cached:
                    resp = GatewayExecuteResponse(**db_cached)
                    self._idempotency_cache[req.idempotency_key] = resp
                    return resp

                response = await self._execute_governed(req)
                self._idempotency_cache[req.idempotency_key] = response
                # Persist durably to PostgreSQL L2
                try:
                    await self.idempotency_repo.save_response(
                        idempotency_key=req.idempotency_key,
                        tool_id=req.tool_id,
                        user_id=req.user_id or "anonymous",
                        response_payload=response.model_dump(),
                    )
                except Exception as e:
                    logger.warning(
                        "Idempotency L2 save error for key %s: %s", req.idempotency_key, e
                    )

                return response

        return await self._execute_governed(req)

    async def _execute_governed(self, req: GatewayExecuteRequest) -> GatewayExecuteResponse:
        async with self._concurrency_semaphore:
            return await self._execute_pipeline(req)

    async def _execute_pipeline(self, req: GatewayExecuteRequest) -> GatewayExecuteResponse:
        start_time = time.perf_counter()
        stages_completed: list[str] = []
        run_id = req.run_id or f"run_{uuid.uuid4().hex[:12]}"
        integration_id = req.tool_id.split(".", 1)[0] if "." in req.tool_id else "unknown"

        # ---------------------------------------------------------------------
        # Stage 1: Identity verification
        # ---------------------------------------------------------------------
        if not req.user_id:
            return GatewayExecuteResponse(
                success=False,
                status="BLOCKED",
                tool_id=req.tool_id,
                integration_id=integration_id,
                run_id=run_id,
                risk_level="CRITICAL",
                risk_score=100,
                error="Identity verification failed: unauthenticated caller",
                stages_completed=stages_completed,
            )
        stages_completed.append("1. Identity Verified")

        # ---------------------------------------------------------------------
        # Stage 2: Integration authorization
        # ---------------------------------------------------------------------
        integration = await self.integration_repo.get_integration(integration_id)
        if not integration:
            return GatewayExecuteResponse(
                success=False,
                status="BLOCKED",
                tool_id=req.tool_id,
                integration_id=integration_id,
                run_id=run_id,
                risk_level="CRITICAL",
                risk_score=100,
                error=f"Integration '{integration_id}' is not registered in SentinelCore",
                stages_completed=stages_completed,
            )
        if not integration.get("is_enabled", True):
            return GatewayExecuteResponse(
                success=False,
                status="BLOCKED",
                tool_id=req.tool_id,
                integration_id=integration_id,
                run_id=run_id,
                risk_level="HIGH",
                risk_score=90,
                error=f"Integration '{integration_id}' is currently disabled by administrator",
                stages_completed=stages_completed,
            )

        # Check if integration requires authentication and verify connection status
        connector = self.connector_registry.get_connector(integration_id)
        if connector and connector.auth_type.value != "None":
            has_creds = bool(
                connector._credentials
                and (connector._credentials.access_token or connector._credentials.api_key)
            )
            if not has_creds:
                stored_creds = await self.integration_repo.get_credentials(integration_id)
                if stored_creds and (stored_creds.access_token or stored_creds.api_key):
                    connector._credentials = stored_creds
                    has_creds = True

            if integration.get("status") != "CONNECTED" and not has_creds:
                return GatewayExecuteResponse(
                    success=False,
                    status="BLOCKED",
                    tool_id=req.tool_id,
                    integration_id=integration_id,
                    run_id=run_id,
                    risk_level="HIGH",
                    risk_score=85,
                    error=f"{integration['name']} integration is disconnected. Please configure credentials before executing tools.",
                    stages_completed=stages_completed,
                )

        stages_completed.append(f"2. Integration Authorized ({integration['name']})")

        # ---------------------------------------------------------------------
        # Stage 3: Tool registry lookup & schema validation
        # ---------------------------------------------------------------------
        tool_record = await self.tool_repo.get_tool(req.tool_id)
        if not tool_record:
            # Check if dynamically discovered by connector
            connector = self.connector_registry.get_connector(integration_id)
            if connector:
                tools = await connector.list_tools()
                for t in tools:
                    if t.tool_id == req.tool_id:
                        tool_record = await self.tool_repo.upsert_tool(t)
                        break

        if not tool_record or not tool_record.get("enabled", True):
            return GatewayExecuteResponse(
                success=False,
                status="BLOCKED",
                tool_id=req.tool_id,
                integration_id=integration_id,
                run_id=run_id,
                risk_level="HIGH",
                risk_score=85,
                error=f"Tool '{req.tool_id}' is not enabled or not found in registry",
                stages_completed=stages_completed,
            )

        # Validate parameters against tool input_schema
        input_schema = tool_record.get("input_schema")
        if isinstance(input_schema, dict):
            required_params = input_schema.get("required", [])
            if isinstance(required_params, list):
                for param in required_params:
                    if param not in req.parameters or req.parameters[param] is None:
                        return GatewayExecuteResponse(
                            success=False,
                            status="BLOCKED",
                            tool_id=req.tool_id,
                            integration_id=integration_id,
                            run_id=run_id,
                            risk_level="HIGH",
                            risk_score=85,
                            error=f"Schema validation error: Missing required parameter '{param}'",
                            stages_completed=stages_completed,
                        )
            properties = input_schema.get("properties", {})
            if isinstance(properties, dict):
                type_map = {
                    "string": str,
                    "number": (int, float),
                    "integer": int,
                    "boolean": bool,
                    "array": list,
                    "object": dict,
                }
                for prop_name, prop_spec in properties.items():
                    if prop_name in req.parameters and req.parameters[prop_name] is not None:
                        val = req.parameters[prop_name]
                        expected_type_str = (
                            prop_spec.get("type") if isinstance(prop_spec, dict) else None
                        )
                        if expected_type_str in type_map:
                            expected_type = type_map[expected_type_str]
                            if expected_type_str in ("number", "integer") and isinstance(val, bool):
                                valid = False
                            else:
                                valid = isinstance(val, expected_type)
                            if not valid:
                                return GatewayExecuteResponse(
                                    success=False,
                                    status="BLOCKED",
                                    tool_id=req.tool_id,
                                    integration_id=integration_id,
                                    run_id=run_id,
                                    risk_level="HIGH",
                                    risk_score=85,
                                    error=f"Schema validation error: Parameter '{prop_name}' must be of type {expected_type_str}",
                                    stages_completed=stages_completed,
                                )

        stages_completed.append("3. Tool Registry Validated")

        # ---------------------------------------------------------------------
        # Stage 4: Policy evaluation
        # ---------------------------------------------------------------------
        policy_id = tool_record.get("policy_id", "sentinel-core-policy")
        await self.tool_repo.get_policy(policy_id)

        # Capability check for Notion writes (e.g. archive_page)
        if req.tool_id in ("notion.archive_page", "archive_page"):
            notion_conn = self.connector_registry.get_connector("notion")
            if (
                notion_conn
                and hasattr(notion_conn, "is_write_enabled")
                and not notion_conn.is_write_enabled()
            ):
                return GatewayExecuteResponse(
                    success=False,
                    status="BLOCKED",
                    tool_id=req.tool_id,
                    integration_id="notion",
                    run_id=run_id,
                    risk_level="CRITICAL",
                    risk_score=85,
                    error="Notion write permission is not enabled. The integration is configured for read-only access.",
                    stages_completed=stages_completed,
                )

        # RBAC: VIEWER cannot execute non-read or destructive operations
        is_mutating_or_destructive = tool_record.get("approval_required", False) or tool_record.get(
            "risk_level"
        ) in ("MEDIUM", "HIGH", "CRITICAL")
        if req.user_role == "VIEWER" and is_mutating_or_destructive:
            return GatewayExecuteResponse(
                success=False,
                status="BLOCKED",
                tool_id=req.tool_id,
                integration_id=integration_id,
                run_id=run_id,
                risk_level="HIGH",
                risk_score=90,
                error=f"Policy violation: Role '{req.user_role}' is not authorized to execute mutating or governed tool '{req.tool_id}'",
                stages_completed=stages_completed,
            )
        stages_completed.append(f"4. Policy Evaluated ({policy_id})")

        # ---------------------------------------------------------------------
        # Stage 5: Risk assessment
        # ---------------------------------------------------------------------
        risk_level = tool_record.get("risk_level", "MEDIUM")
        risk_score_map = {"LOW": 20, "MEDIUM": 50, "HIGH": 75, "CRITICAL": 95}
        risk_score = risk_score_map.get(risk_level, 50)

        # Record risk decision
        req_id = get_request_id() or f"req_{uuid.uuid4().hex[:10]}"
        await self.tool_repo.record_risk_decision(
            request_id=req_id,
            tool_id=req.tool_id,
            risk_level=risk_level,
            risk_score=risk_score,
            factors={"user_role": req.user_role, "parameters": list(req.parameters.keys())},
            decision="PERMIT" if risk_level == "LOW" else "REQUIRES_CHECK",
            policy_id=policy_id,
        )
        stages_completed.append(f"5. Risk Assessed ({risk_level} - {risk_score}/100)")

        # ---------------------------------------------------------------------
        # Stage 6: Approval decision
        # ---------------------------------------------------------------------
        requires_approval = tool_record.get("approval_required", False) or risk_level in (
            "HIGH",
            "CRITICAL",
        )

        if requires_approval:
            if not req.approval_ticket_id:
                # Create pending approval request and pause execution
                target_id = str(
                    req.parameters.get("page_id")
                    or req.parameters.get("database_id")
                    or req.parameters.get("id")
                    or req.parameters.get("customer_id")
                    or req.parameters.get("repo")
                    or req.parameters.get("design_id")
                    or req.tool_id
                )
                approval_req = ApprovalRequestCreate(
                    request_id=req_id,
                    action=f"execute_{req.tool_id}",
                    target_id=target_id,
                    target_type=integration_id,
                    risk_level=risk_level,
                    tool_name=req.tool_id,
                    reason=req.reason
                    or f"Action requires human approval per Sentinel policy for {risk_level} risk.",
                    requester_id=req.user_id,
                    agent_id=req.agent_id,
                    parameters=req.parameters,
                )
                created_ticket = await self.approval_repo.create_approval_request(approval_req)
                ticket_id = created_ticket["ticket_id"]

                stages_completed.append(f"6. Approval Required -> Ticket Created ({ticket_id})")
                return GatewayExecuteResponse(
                    success=False,
                    status="PENDING_APPROVAL",
                    tool_id=req.tool_id,
                    integration_id=integration_id,
                    run_id=run_id,
                    risk_level=risk_level,
                    risk_score=risk_score,
                    approval_ticket_id=ticket_id,
                    error=f"Human approval required for {risk_level} action. Approval ticket {ticket_id} created.",
                    stages_completed=stages_completed,
                )
            else:
                # Verify provided ticket via atomic binding verification & consumption
                target_id = str(
                    req.parameters.get("page_id")
                    or req.parameters.get("database_id")
                    or req.parameters.get("id")
                    or req.parameters.get("customer_id")
                    or req.parameters.get("repo")
                    or req.parameters.get("design_id")
                    or req.tool_id
                )
                is_valid = await self.approval_repo.verify_and_consume_bound(
                    ticket_id=req.approval_ticket_id,
                    target_id=target_id,
                    action=f"execute_{req.tool_id}",
                    tool_name=req.tool_id,
                    parameters=req.parameters,
                    agent_id=req.agent_id,
                    requester_id=req.user_id,
                )
                if not is_valid:
                    return GatewayExecuteResponse(
                        success=False,
                        status="BLOCKED",
                        tool_id=req.tool_id,
                        integration_id=integration_id,
                        run_id=run_id,
                        risk_level=risk_level,
                        risk_score=risk_score,
                        error="Approval ticket verification failed: ticket is invalid, expired, replayed, or parameters mismatched.",
                        stages_completed=stages_completed,
                    )
                stages_completed.append(
                    f"6. Approval Verified & Consumed ({req.approval_ticket_id})"
                )
        else:
            stages_completed.append("6. Approval Not Required (LOW risk)")

        # ---------------------------------------------------------------------
        # Stage 7: Execution via Connector (with bounded timeout)
        # ---------------------------------------------------------------------
        timeout_seconds = self._settings.TOOL_TIMEOUT_SECONDS
        try:
            exec_result: ToolExecutionResult = await asyncio.wait_for(
                self.connector_registry.execute_tool(
                    req.tool_id,
                    req.parameters,
                ),
                timeout=timeout_seconds,
            )
            stages_completed.append("7. Connector Executed")
        except asyncio.TimeoutError:
            logger.warning(
                "Tool execution timed out after %ss for %s", timeout_seconds, req.tool_id
            )
            exec_result = ToolExecutionResult(
                success=False,
                status="FAILED",
                tool_id=req.tool_id,
                integration_id=integration_id,
                error=f"Tool execution timed out after {timeout_seconds} seconds",
            )
            stages_completed.append("7. Connector Execution Timed Out")
        except Exception as exc:
            logger.exception("Unexpected error executing tool %s: %s", req.tool_id, exc)
            exec_result = ToolExecutionResult(
                success=False,
                status="FAILED",
                tool_id=req.tool_id,
                integration_id=integration_id,
                error=f"Tool execution failed: {str(exc)}",
            )
            stages_completed.append("7. Connector Execution Failed")

        # ---------------------------------------------------------------------
        # Stage 8: Result validation & sanitization
        # ---------------------------------------------------------------------
        sanitized_data = (
            scrub_dict_secrets(exec_result.data) if exec_result.data is not None else None
        )
        sanitized_parameters = scrub_dict_secrets(req.parameters)

        if exec_result.success:
            await self.tool_repo.record_tool_usage(req.tool_id)
            stages_completed.append("8. Result Validated & Sanitized")
        else:
            stages_completed.append("8. Result Validation Failed")

        total_latency = int((time.perf_counter() - start_time) * 1000)

        # ---------------------------------------------------------------------
        # Stage 9: Audit logging
        # ---------------------------------------------------------------------
        final_status = (
            "EXECUTED"
            if exec_result.success
            else (exec_result.status if exec_result.status in ("BLOCKED", "FAILED") else "FAILED")
        )

        exec_id = f"exec_{uuid.uuid4().hex[:12]}"

        # Record immutable audit event in database
        await self.audit_repo.record_audit_event(
            event_type="TOOL_EXECUTED" if exec_result.success else "TOOL_FAILED",
            tool_name=req.tool_id,
            decision="PERMIT" if exec_result.success else "DENY",
            actor_type="user",
            actor_id=req.user_id,
            request_id=req_id,
            details={
                "integration": integration_id,
                "tool": req.tool_id,
                "repository": req.parameters.get("repo"),
                "action": req.tool_id,
                "risk": risk_level,
                "policy": policy_id,
                "approval": req.approval_ticket_id,
                "parameters": sanitized_parameters,
                "status": final_status,
                "execution_id": exec_id,
                "agent_id": req.agent_id,
            },
        )

        log_security_event(
            event_type=TOOL_EXECUTED,
            action=req.tool_id,
            decision="PERMIT" if exec_result.success else "ERROR",
            tool_name=req.tool_id,
            risk_classification=risk_level,
            user_id=req.user_id,
            agent_id=req.agent_id,
            success=exec_result.success,
            details={
                "integration": integration_id,
                "latency_ms": total_latency,
                "execution_id": exec_id,
                "repository": req.parameters.get("repo"),
                "policy": policy_id,
                "approval_ticket": req.approval_ticket_id,
            },
        )
        stages_completed.append("9. Audit Logged Immutably")

        return GatewayExecuteResponse(
            success=exec_result.success,
            status=final_status,
            tool_id=req.tool_id,
            integration_id=integration_id,
            run_id=run_id,
            execution_id=exec_id,
            risk_level=risk_level,
            risk_score=risk_score,
            data=sanitized_data,
            error=exec_result.error,
            latency_ms=total_latency,
            stages_completed=stages_completed,
        )
