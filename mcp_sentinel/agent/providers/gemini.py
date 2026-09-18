"""
Google Gemini LLM Provider for MCP-Sentinel AI Agent.
Uses the official google-genai SDK for server-side model interaction.
Complies with:
- Security Rule #1: Never trust the AI agent.
- Security Rule #5: Never expose credentials or secrets.
- Server-side only execution.
- LLM provider abstraction.
"""

import uuid
from typing import Any, Optional

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from mcp_sentinel.agent.providers.base import AgentMessage, LLMProvider, LLMResponse, ToolCall
from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.security.audit_logger import log_security_event
from mcp_sentinel.security.correlation import get_request_id
from mcp_sentinel.security.exceptions import ConfigurationError


class GeminiProvider(LLMProvider):
    """
    Production-grade Gemini provider wrapping the official Google GenAI SDK.
    Discovers MCP tools and registers them dynamically as Function Declarations.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
    ):
        settings = get_settings()
        self._api_key = api_key or settings.GEMINI_API_KEY
        self._model_name = model_name or settings.GEMINI_MODEL
        self._client: Optional[genai.Client] = None

    def _get_client(self) -> genai.Client:
        if not self._api_key:
            raise ConfigurationError(
                safe_message="Gemini API key is not configured.",
                internal_details="GEMINI_API_KEY environment variable or setting is empty.",
            )
        if self._client is None:
            self._client = genai.Client(api_key=self._api_key)
        return self._client

    def _convert_tools(self, tools: list[dict[str, Any]]) -> Optional[list[types.Tool]]:
        """Converts discovered MCP tool definitions to Gemini Tool specifications."""
        if not tools:
            return None

        function_declarations: list[types.FunctionDeclaration] = []
        for t in tools:
            schema = t.get("input_schema") or t.get("parameters") or {}
            fd = types.FunctionDeclaration(
                name=t["name"],
                description=t.get("description", ""),
                parameters=schema,
            )
            function_declarations.append(fd)

        return [types.Tool(function_declarations=function_declarations)]

    def _convert_messages(self, messages: list[AgentMessage]) -> list[types.Content]:
        """Converts unified AgentMessage history into Gemini Content objects."""
        contents: list[types.Content] = []

        for msg in messages:
            if msg.role == "user":
                part = types.Part.from_text(text=msg.content or "")
                contents.append(types.Content(role="user", parts=[part]))

            elif msg.role in ("assistant", "model"):
                parts: list[types.Part] = []
                if msg.content:
                    parts.append(types.Part.from_text(text=msg.content))
                if msg.tool_calls:
                    for tc in msg.tool_calls:
                        parts.append(types.Part.from_function_call(name=tc.name, args=tc.args))
                if parts:
                    contents.append(types.Content(role="model", parts=parts))

            elif msg.role == "tool":
                # Function response returned to the model
                tool_name = msg.name or "mcp_tool"
                response_data = {"result": msg.content or ""}
                part = types.Part.from_function_response(name=tool_name, response=response_data)
                contents.append(types.Content(role="user", parts=[part]))

        return contents

    async def generate_response(
        self,
        messages: list[AgentMessage],
        tools: list[dict[str, Any]],
        system_instruction: Optional[str] = None,
    ) -> LLMResponse:
        """
        Calls the Gemini model with conversation history and available MCP tools.
        """
        client = self._get_client()
        gemini_tools = self._convert_tools(tools)
        contents = self._convert_messages(messages)

        config = types.GenerateContentConfig(
            temperature=0.0,
            system_instruction=system_instruction,
            tools=gemini_tools,
        )

        try:
            response = await client.aio.models.generate_content(
                model=self._model_name,
                contents=contents,
                config=config,
            )
        except genai_errors.APIError as exc:
            log_security_event(
                event_type="GEMINI_API_ERROR",
                action="generate_content",
                decision="FAIL",
                risk_classification="HIGH",
                success=False,
                error_code="GEMINI_API_ERROR",
                details={"model": self._model_name, "message": str(exc)},
                request_id=get_request_id(),
            )
            return LLMResponse(
                content="Unable to complete the request because the AI service is currently unavailable.",
                finish_reason="error",
            )
        except Exception as exc:
            log_security_event(
                event_type="GEMINI_UNEXPECTED_ERROR",
                action="generate_content",
                decision="FAIL",
                risk_classification="HIGH",
                success=False,
                error_code="GEMINI_EXCEPTION",
                details={"model": self._model_name, "error_type": type(exc).__name__},
                request_id=get_request_id(),
            )
            return LLMResponse(
                content="An error occurred while communicating with the reasoning service.",
                finish_reason="error",
            )

        # Parse response candidates
        if not response.candidates:
            return LLMResponse(content="No response generated.", finish_reason="stop")

        candidate = response.candidates[0]
        text_parts: list[str] = []
        tool_calls: list[ToolCall] = []

        if candidate.content and candidate.content.parts:
            for part in candidate.content.parts:
                if part.text:
                    text_parts.append(part.text)
                if part.function_call:
                    fc = part.function_call
                    call_id = f"call_{uuid.uuid4().hex[:8]}"
                    tool_calls.append(
                        ToolCall(
                            id=call_id,
                            name=fc.name,
                            args=dict(fc.args) if fc.args else {},
                        )
                    )

        combined_text = "".join(text_parts).strip() if text_parts else None

        usage_info = None
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            usage_info = {
                "prompt_token_count": getattr(response.usage_metadata, "prompt_token_count", None),
                "candidates_token_count": getattr(
                    response.usage_metadata, "candidates_token_count", None
                ),
            }

        return LLMResponse(
            content=combined_text,
            tool_calls=tool_calls,
            finish_reason=str(candidate.finish_reason) if candidate.finish_reason else "stop",
            usage=usage_info,
        )
