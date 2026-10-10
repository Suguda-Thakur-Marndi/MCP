"""
MCP-Sentinel Server Compatibility Entrypoint.
Delegates canonically to mcp_sentinel.server.app.
Supports direct execution: python -m mcp_server.server
"""

import sys
from pathlib import Path

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from mcp_sentinel.server.app import app, create_app, run  # noqa: E402

__all__ = ["app", "create_app", "run"]

if __name__ == "__main__":
    run()
