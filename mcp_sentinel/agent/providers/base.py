"""
Base LLM Provider Abstraction for MCP-Sentinel AI Agent.
Decouples agent reasoning from specific model providers (Gemini, Mock, etc.).
Complies with:
- Security Rule #1: Never trust the AI agent.
- Security Rule #5: Never expose credentials or secrets.
- Server-side model invocation only.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ToolCall:
    """Represents a structured tool invocation requested by an LLM."""

    id: str
    name: str
    args: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentMessage:
    """Unified message structure representing conversation context."""

    role: str  # "system", "user", "model" / "assistant", "tool"
    content: Optional[str] = None
    tool_calls: Optional[list[ToolCall]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None


@dataclass
class LLMResponse:
    """Unified response returned by an LLM provider."""

    content: Optional[str] = None
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: Optional[str] = None
    usage: Optional[dict[str, Any]] = None

    @property
    def has_tool_calls(self) -> bool:
        return len(self.tool_calls) > 0


class LLMProvider(ABC):
    """
    Abstract interface for LLM model providers.
    Allows swappable backends (Google Gemini, Mock Provider, etc.).
    """

    @abstractmethod
    async def generate_response(
        self,
        messages: list[AgentMessage],
        tools: list[dict[str, Any]],
        system_instruction: Optional[str] = None,
    ) -> LLMResponse:
        """
        Invokes the underlying LLM with messages, available tools, and system prompt.

        Args:
            messages: History of agent conversation messages.
            tools: Discovered MCP tool definitions (name, description, input_schema).
            system_instruction: Boundary rules and instructions for the agent.

        Returns:
            LLMResponse containing either generated text, requested tool calls, or both.
        """
        pass
