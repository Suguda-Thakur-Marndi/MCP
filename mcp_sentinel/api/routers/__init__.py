"""
API Routers Package for MCP-Sentinel.
Exports all endpoint routers for agent operations, approvals, audit logging,
authentication, dashboard statistics, health diagnostics, integrations,
MCP server registries, security policies, evaluation benchmarks, and tools.
"""

from mcp_sentinel.api.routers import (
    agent,
    approvals,
    audit,
    auth,
    dashboard,
    health,
    integrations,
    mcp_servers,
    policies,
    security,
    security_eval,
    tools,
)

__all__ = [
    "agent",
    "approvals",
    "audit",
    "auth",
    "dashboard",
    "health",
    "integrations",
    "mcp_servers",
    "policies",
    "security",
    "security_eval",
    "tools",
]
