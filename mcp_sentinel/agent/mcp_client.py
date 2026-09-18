"""
Secure MCP Client Adapter for MCP-Sentinel AI Agent.
Connects dynamically to the Phase 2 FastMCP Server.
Complies with:
- Security Rule #1: Never trust the AI agent.
- Security Rule #2: Never trust tool annotations as the sole security boundary.
- Security Rule #3: Never trust client-provided approval information.
- Security Rule #4: Never execute arbitrary SQL (no raw SQL tools).
- Security Rule #7: The MCP server itself must enforce security.
- Security Rule #9: Do not expose internal secrets or stack traces.
- Security Rule #10: Fail closed for security-sensitive failures.
"""

import asyncio
import json
import time
from typing import Any, Optional

from fastmcp import Client, FastMCP

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.security.audit_logger import (
    DESTRUCTIVE_ACTION_BLOCKED,
    TOOL_DENIED,
    TOOL_EXECUTED,
    TOOL_REQUESTED,
    TOOL_TIMEOUT,
    log_security_event,
)
from mcp_sentinel.security.correlation import get_request_id, set_request_id
from mcp_sentinel.server.app import create_app

# Allow-listed read tools that are safe for conservative single retry on transient error
SAFE_IDEMPOTENT_READ_TOOLS = {
    "get_customer",
    "get_order",
    "get_customer_orders",
    "query_customer_records",
}

# High-risk destructive tools that strictly require server-side approval
DESTRUCTIVE_TOOLS = {
    "delete_customer",
    "purge_inactive_customer_data",
}

# Prohibited dangerous tools that must NEVER be discovered or executed
FORBIDDEN_SQL_TOOLS = {
    "execute_sql",
    "run_sql",
    "raw_sql",
    "raw_query",
    "database_query",
    "execute_query",
}


class SentinelMCPClient:
    """
    Secure client interface mediating all agent interactions with the MCP server.
    Dynamically discovers tools and enforces timeouts, audits, and data boundaries.
    """

    def __init__(
        self,
        server_instance: Optional[FastMCP] = None,
        server_url: Optional[str] = None,
    ):
        self._settings = get_settings()
        self._server_url = server_url or self._settings.MCP_SERVER_URL
        self._server_instance = server_instance
        self._tools_cache: dict[str, dict[str, Any]] = {}
        self._client: Optional[Client] = None

    def _get_client_target(self) -> Any:
        if self._server_instance is not None:
            return self._server_instance
        if self._server_url:
            return self._server_url
        # Default: in-process secure FastMCP instance
        self._server_instance = create_app()
        return self._server_instance

    def _get_client(self) -> Client:
        if self._client is None:
            target = self._get_client_target()
            self._client = Client(target)
        return self._client

    async def discover_tools(self) -> list[dict[str, Any]]:
        """
        Dynamically discovers all available tools from the MCP server.
        Extracts tool name, description, and input schema.
        Validates absence of raw SQL tools.
        """
        client = self._get_client()
        async with client:
            tools = await client.list_tools()

        discovered: list[dict[str, Any]] = []
        self._tools_cache.clear()

        for t in tools:
            # Enforce prohibition of raw SQL tools
            if t.name in FORBIDDEN_SQL_TOOLS:
                log_security_event(
                    event_type=TOOL_DENIED,
                    tool_name=t.name,
                    action="discover_tools",
                    decision="BLOCK",
                    risk_classification="CRITICAL",
                    success=False,
                    error_code="FORBIDDEN_TOOL_BLOCKED",
                )
                continue

            # Extract schema safely across MCP SDK versions
            schema = getattr(t, "input_schema", None) or getattr(t, "parameters", None) or {}

            tool_def = {
                "name": t.name,
                "description": t.description or "",
                "input_schema": schema,
                "is_destructive": t.name in DESTRUCTIVE_TOOLS,
            }
            discovered.append(tool_def)
            self._tools_cache[t.name] = tool_def

        return discovered

    def get_tool_definitions(self) -> list[dict[str, Any]]:
        """Returns cached tool definitions."""
        return list(self._tools_cache.values())

    async def call_tool(
        self,
        name: str,
        arguments: dict[str, Any],
        request_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Invokes an MCP tool on the server with structured arguments, audit logging,
        timeout enforcement, and conservative retries for read operations.
        """
        rid = request_id or get_request_id()
        set_request_id(rid)
        agent_id = self._settings.AGENT_ID

        # Verify tool is not forbidden SQL tool
        if name in FORBIDDEN_SQL_TOOLS:
            log_security_event(
                event_type=TOOL_DENIED,
                tool_name=name,
                action="call_tool",
                decision="BLOCK",
                risk_classification="CRITICAL",
                agent_id=agent_id,
                success=False,
                error_code="RAW_SQL_TOOL_PROHIBITED",
                request_id=rid,
            )
            return {
                "status": "error",
                "error_type": "SecurityPolicyViolation",
                "message": f"Tool '{name}' is strictly forbidden by policy.",
            }

        # Log invocation request
        log_security_event(
            event_type=TOOL_REQUESTED,
            tool_name=name,
            action=name,
            decision="PROCESS",
            risk_classification="CRITICAL" if name in DESTRUCTIVE_TOOLS else "NORMAL",
            agent_id=agent_id,
            success=True,
            details={"arguments_keys": list(arguments.keys())},
            request_id=rid,
        )

        # Execute with timeout and safe retries
        timeout_seconds = self._settings.TOOL_TIMEOUT_SECONDS
        is_safe_read = name in SAFE_IDEMPOTENT_READ_TOOLS

        max_attempts = 2 if is_safe_read else 1

        for attempt in range(1, max_attempts + 1):
            t0 = time.perf_counter()
            try:
                client = self._get_client()
                async with client:
                    result = await asyncio.wait_for(
                        client.call_tool(name=name, arguments=arguments),
                        timeout=timeout_seconds,
                    )

                duration = time.perf_counter() - t0
                extracted = self._extract_result_data(result)

                # Check if server-side approval check blocked the action
                is_destructive = name in DESTRUCTIVE_TOOLS
                is_approval_blocked = (
                    extracted.get("status") == "rejected"
                    or extracted.get("error_type") == "AuthorizationDeniedError"
                    or (is_destructive and "approval_ticket" in str(extracted.get("message", "")))
                )
                if is_approval_blocked:
                    log_security_event(
                        event_type=DESTRUCTIVE_ACTION_BLOCKED,
                        tool_name=name,
                        action=name,
                        decision="BLOCK",
                        risk_classification="CRITICAL",
                        agent_id=agent_id,
                        success=False,
                        error_code="APPROVAL_REQUIRED",
                        details={"message": extracted.get("message")},
                        request_id=rid,
                    )
                    try:
                        from mcp_sentinel.observability.metrics import get_metrics

                        get_metrics().record_mcp_tool_call(name, "approval_required", duration)
                    except Exception:
                        pass
                    return {
                        "status": "approval_required",
                        "tool": name,
                        "message": "Human approval is required before execution.",
                        "details": extracted,
                    }

                # Log successful execution
                log_security_event(
                    event_type=TOOL_EXECUTED,
                    tool_name=name,
                    action=name,
                    decision="COMPLETE",
                    risk_classification="CRITICAL" if name in DESTRUCTIVE_TOOLS else "NORMAL",
                    agent_id=agent_id,
                    success=extracted.get("status") == "success",
                    request_id=rid,
                )
                try:
                    from mcp_sentinel.observability.metrics import get_metrics

                    tool_stat = "success" if extracted.get("status") == "success" else "error"
                    get_metrics().record_mcp_tool_call(name, tool_stat, duration)
                except Exception:
                    pass
                return extracted

            except asyncio.TimeoutError:
                log_security_event(
                    event_type=TOOL_TIMEOUT,
                    tool_name=name,
                    action=name,
                    decision="ABORT",
                    risk_classification="HIGH",
                    agent_id=agent_id,
                    success=False,
                    error_code="TIMEOUT",
                    details={"timeout_seconds": timeout_seconds, "attempt": attempt},
                    request_id=rid,
                )
                if attempt == max_attempts:
                    return {
                        "status": "error",
                        "error_type": "TimeoutError",
                        "message": f"MCP tool '{name}' timed out after {timeout_seconds} seconds.",
                    }

            except Exception as exc:
                if attempt == max_attempts:
                    log_security_event(
                        event_type="TOOL_ERROR",
                        tool_name=name,
                        action=name,
                        decision="FAIL",
                        risk_classification="HIGH",
                        agent_id=agent_id,
                        success=False,
                        error_code="EXECUTION_FAILURE",
                        details={"error_type": type(exc).__name__},
                        request_id=rid,
                    )
                    return {
                        "status": "error",
                        "error_type": type(exc).__name__,
                        "message": "Unable to complete the MCP tool request.",
                    }

        return {
            "status": "error",
            "error_type": "UnknownError",
            "message": "Tool execution ended unexpectedly.",
        }

    def _extract_result_data(self, res: Any) -> dict[str, Any]:
        """Extracts and standardizes dictionary results from CallToolResult."""
        if hasattr(res, "structured_content") and res.structured_content:
            return res.structured_content
        if hasattr(res, "data") and isinstance(res.data, dict):
            return res.data
        if hasattr(res, "content") and res.content and hasattr(res.content[0], "text"):
            try:
                return json.loads(res.content[0].text)
            except Exception:
                return {"status": "success", "text": res.content[0].text}
        if isinstance(res, dict):
            return res
        return {"status": "success", "raw": str(res)}

    @staticmethod
    def wrap_untrusted_data(tool_name: str, data: dict[str, Any]) -> str:
        """
        Wraps tool results in untrusted data delimiters.
        Ensures the agent treats returned database content strictly as passive data,
        neutralizing prompt injection attempts embedded inside records.
        """
        serialized = json.dumps(data, ensure_ascii=False)
        return f"[UNTRUSTED_TOOL_DATA: {tool_name}]\n{serialized}\n[/UNTRUSTED_TOOL_DATA]"
