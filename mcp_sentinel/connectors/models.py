"""
Data models and enumerations for the Multi-Software MCP Connector Platform.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class AuthType(str, Enum):
    OAUTH2 = "OAuth 2.0"
    OAUTH_APP = "OAuth App"
    API_KEY = "API Key"
    PAT = "PAT / Token"
    BOT_TOKEN = "Bot Token"
    NONE = "None"
    CUSTOM = "Custom"


class ProtocolType(str, Enum):
    REMOTE_MCP = "remote_mcp"
    REST_API = "rest_api"
    LOCAL_MCP = "local_mcp"


class IntegrationStatus(str, Enum):
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    DEGRADED = "DEGRADED"
    ERROR = "ERROR"


class ToolState(str, Enum):
    DISCOVERED = "DISCOVERED"
    AVAILABLE = "AVAILABLE"
    AUTHORIZED = "AUTHORIZED"
    APPROVED = "APPROVED"
    EXECUTED = "EXECUTED"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ConnectorCredentials(BaseModel):
    """
    Decrypted in-memory credentials for authenticating a connector.
    Never serialized or returned across the API.
    """
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    api_key: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    token_type: str = "Bearer"
    scopes: list[str] = Field(default_factory=list)
    expires_at: Optional[datetime] = None


class ConnectionTestResult(BaseModel):
    """Result of an integration connection test."""
    success: bool
    latency_ms: int
    message: str
    server_version: Optional[str] = None
    protocol_version: Optional[str] = None
    details: dict[str, Any] = Field(default_factory=dict)


class DiscoveredTool(BaseModel):
    """A tool discovered from an external software system or MCP server."""
    tool_id: str
    integration_id: str
    name: str
    description: str
    input_schema: dict[str, Any] = Field(default_factory=dict)
    risk_level: RiskLevel = RiskLevel.MEDIUM
    required_permissions: list[str] = Field(default_factory=list)
    approval_required: bool = False
    policy_id: str = "sentinel-core-policy"
    enabled: bool = True
    state: ToolState = ToolState.DISCOVERED
    last_used: Optional[datetime] = None


class ToolExecutionResult(BaseModel):
    """Result of an executed tool call on external software."""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    latency_ms: int = 0
    status: str = "EXECUTED"
    tool_id: str
    integration_id: str


class ConnectorHealth(BaseModel):
    """Health check outcome for a connector."""
    status: IntegrationStatus
    latency_ms: int
    last_check: datetime = Field(default_factory=datetime.utcnow)
    error_message: Optional[str] = None
    details: dict[str, Any] = Field(default_factory=dict)
