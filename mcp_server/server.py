"""
MCP Server entry point forwarding to mcp_sentinel.server.app.
Provides directory compatibility with Phase 2 specification.
"""

from mcp_sentinel.server.app import app, create_app, run

__all__ = ["app", "create_app", "run"]

if __name__ == "__main__":
    run()
