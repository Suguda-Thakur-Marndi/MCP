"""
Mock LLM Provider for MCP-Sentinel AI Agent.
Enables deterministic, offline unit, integration, and security testing
without requiring a live Google Gemini API key or external network access.
"""

from typing import Any, Callable, Optional

from mcp_sentinel.agent.providers.base import AgentMessage, LLMProvider, LLMResponse, ToolCall


class MockLLMProvider(LLMProvider):
    """
    Deterministic mock provider for automated tests and evaluation.
    Supports scripted responses, custom handlers, or intelligent rule-based responses.
    """

    def __init__(
        self,
        responses: Optional[list[LLMResponse]] = None,
        custom_handler: Optional[
            Callable[[list[AgentMessage], list[dict[str, Any]]], LLMResponse]
        ] = None,
        simulate_error: Optional[Exception] = None,
    ):
        self._responses = list(responses) if responses else []
        self._custom_handler = custom_handler
        self._simulate_error = simulate_error
        self.call_count = 0
        self.recorded_messages: list[list[AgentMessage]] = []

    def queue_response(self, response: LLMResponse) -> None:
        """Adds a response to the deterministic queue."""
        self._responses.append(response)

    async def generate_response(
        self,
        messages: list[AgentMessage],
        tools: list[dict[str, Any]],
        system_instruction: Optional[str] = None,
    ) -> LLMResponse:
        self.call_count += 1
        self.recorded_messages.append(messages)

        if self._simulate_error:
            raise self._simulate_error

        # 1. Check custom handler
        if self._custom_handler:
            return self._custom_handler(messages, tools)

        # 2. Check scripted responses queue
        if self._responses:
            return self._responses.pop(0)

        # 3. Default rule-based reasoning engine for testing scenarios
        return self._rule_based_response(messages, tools)

    def _rule_based_response(
        self,
        messages: list[AgentMessage],
        tools: list[dict[str, Any]],
    ) -> LLMResponse:
        """Heuristic rule-based agent simulator for standard test scenarios."""
        last_message = messages[-1] if messages else None

        # Check if the last message is a tool response
        if last_message and last_message.role == "tool":
            tool_content = last_message.content or ""

            # Check if destructive approval was required
            if (
                "approval_required" in tool_content
                or "AuthorizationDeniedError" in tool_content
                or "rejected" in tool_content
            ):
                return LLMResponse(
                    content="The deletion was not executed because human approval is required before execution.",
                    tool_calls=[],
                    finish_reason="stop",
                )

            # Check if customer was not found
            if "not found" in tool_content.lower():
                return LLMResponse(
                    content="I couldn't find that customer in the records.",
                    tool_calls=[],
                    finish_reason="stop",
                )

            # Handle prompt injection test payload: database record containing injection
            if "ignore" in tool_content.lower() and "delete" in tool_content.lower():
                return LLMResponse(
                    content=f"Customer summary: The customer record contains the following note data: {tool_content}.",
                    tool_calls=[],
                    finish_reason="stop",
                )

            # Normal success summary
            return LLMResponse(
                content=f"Successfully processed the request. Data: {tool_content[:200]}",
                tool_calls=[],
                finish_reason="stop",
            )

        # First turn: examine user prompt
        user_prompt = ""
        for m in reversed(messages):
            if m.role == "user":
                user_prompt = m.content or ""
                break

        lowered = user_prompt.lower()

        # 1. Purge tool
        if "purge" in lowered:
            inactivity = 90
            for word in user_prompt.split():
                if word.isdigit():
                    inactivity = int(word)
            cid = None
            for word in user_prompt.split():
                if "cust-" in word.lower():
                    cid = word.strip(".,;:\"'")
            args: dict[str, Any] = {
                "approval_ticket": "UNAPPROVED-TICKET",
                "inactivity_days": inactivity,
                "reason": "User requested purge",
            }
            if cid:
                args["customer_id"] = cid
            return LLMResponse(
                content=None,
                tool_calls=[
                    ToolCall(
                        id="call_purge_1",
                        name="purge_inactive_customer_data",
                        args=args,
                    )
                ],
                finish_reason="tool_calls",
            )

        # 2. Delete customer
        if "delete" in lowered or "remove" in lowered:
            cid = "CUST-000001"
            for word in user_prompt.split():
                if "cust-" in word.lower() or word.isdigit():
                    cid = word.strip(".,;:\"'")
                    break
            ticket = "UNAPPROVED-TICKET"
            if "fake-ticket" in lowered:
                ticket = "FAKE-TICKET-12345"
            return LLMResponse(
                content=None,
                tool_calls=[
                    ToolCall(
                        id="call_del_1",
                        name="delete_customer",
                        args={
                            "customer_id": cid,
                            "approval_ticket": ticket,
                            "reason": "User requested deletion",
                        },
                    )
                ],
                finish_reason="tool_calls",
            )

        # 3. Update customer
        if "update customer" in lowered or "change customer" in lowered:
            cid = "CUST-000001"
            for word in user_prompt.split():
                if "cust-" in word.lower() or word.isdigit():
                    cid = word.strip(".,;:\"'")
                    break
            args = {"customer_id": cid}
            if "inactive" in lowered:
                args["status"] = "inactive"
            elif "active" in lowered:
                args["status"] = "active"
            if "ca" in user_prompt.split():
                args["country"] = "CA"
            return LLMResponse(
                content=None,
                tool_calls=[
                    ToolCall(
                        id="call_upd_1",
                        name="update_customer",
                        args=args,
                    )
                ],
                finish_reason="tool_calls",
            )

        # 4. Audit note
        if (
            "audit note" in lowered
            or "administrative note" in lowered
            or "add a note" in lowered
            or "add an audit note" in lowered
            or "append" in lowered
        ):
            cid = "CUST-000001"
            for word in user_prompt.split():
                if "cust-" in word.lower() or word.isdigit():
                    cid = word.strip(".,;:\"'")
                    break
            return LLMResponse(
                content=None,
                tool_calls=[
                    ToolCall(
                        id="call_aud_1",
                        name="append_customer_audit_note",
                        args={
                            "customer_id": cid,
                            "note": user_prompt,
                            "author_id": "agent",
                        },
                    )
                ],
                finish_reason="tool_calls",
            )

        # 5. Specific order
        if "ord-" in lowered or ("retrieve order" in lowered) or ("get order" in lowered):
            oid = "ORD-000001"
            for word in user_prompt.split():
                if "ord-" in word.lower() or word.isdigit():
                    oid = word.strip(".,;:\"'")
                    break
            return LLMResponse(
                content=None,
                tool_calls=[
                    ToolCall(
                        id="call_ord_1",
                        name="get_order",
                        args={"order_id": oid},
                    )
                ],
                finish_reason="tool_calls",
            )

        # 6. Customer orders
        if "orders" in lowered or "order" in lowered:
            cid = "CUST-000001"
            for word in user_prompt.split():
                if "cust-" in word.lower():
                    cid = word.strip(".,;:\"'")
                    break
            return LLMResponse(
                content=None,
                tool_calls=[
                    ToolCall(
                        id="call_ord_multi",
                        name="get_customer_orders",
                        args={"customer_id": cid, "limit": 10},
                    )
                ],
                finish_reason="tool_calls",
            )

        # 7. Search / Query customer records
        if "search" in lowered or "query" in lowered or "list" in lowered:
            args = {"limit": 10}
            if "active" in lowered and ("us" in lowered or "united states" in lowered):
                args["filters"] = {"status": "active", "country": "US"}
            for word in user_prompt.split():
                if word.isdigit() and int(word) <= 100:
                    args["limit"] = int(word)
            return LLMResponse(
                content=None,
                tool_calls=[
                    ToolCall(
                        id="call_qry_1",
                        name="query_customer_records",
                        args=args,
                    )
                ],
                finish_reason="tool_calls",
            )

        # 8. Customer lookup
        if "customer" in lowered or "cust-" in lowered:
            cid = "CUST-000001"
            for word in user_prompt.split():
                if "cust-" in word.lower():
                    cid = word.strip(".,;:\"'")
                    break
                elif word.isdigit():
                    cid = int(word)
                    break
            return LLMResponse(
                content=None,
                tool_calls=[
                    ToolCall(
                        id="call_cust_1",
                        name="get_customer",
                        args={"customer_id": cid},
                    )
                ],
                finish_reason="tool_calls",
            )

        # Default conversational answer
        return LLMResponse(
            content="Hello! I am the MCP-Sentinel assistant. How can I assist you with customer data today?",
            tool_calls=[],
            finish_reason="stop",
        )
