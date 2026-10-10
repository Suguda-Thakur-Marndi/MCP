"""
MCP-Sentinel Server Compatibility Package.
Provides backward-compatibility imports mapping to canonical mcp_sentinel.server.app.
"""

from mcp_sentinel.server.app import app, create_app, run

__all__ = ["app", "create_app", "run"]
