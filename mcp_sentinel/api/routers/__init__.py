"""
API Routers Package for MCP-Sentinel.
Exports all endpoint routers for agent operations, approvals, audit logging,
authentication, dashboard statistics, health diagnostics, integrations,
MCP server registries, security policies, evaluation benchmarks, and tools.
"""

from mcp_sentinel.api.routers import (
    approvals,
    audit,
    auth,
    dashboard,
    health,
    integrations,
    mcp_servers,
    policies,
    tools,
)

__all__ = [
    "approvals",
    "audit",
    "auth",
    "dashboard",
    "health",
    "integrations",
    "mcp_servers",
    "policies",
    "tools",
]
