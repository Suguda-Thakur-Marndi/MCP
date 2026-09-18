# Multi-stage secure Dockerfile for MCP-Sentinel
FROM python:3.12-slim AS base

# Prevent Python from buffering stdout and writing bytecode
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged system user
RUN groupadd -r sentinel && useradd -r -g sentinel -d /app sentinel

# Copy dependencies first for efficient layer caching
COPY requirements.txt pyproject.toml ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and scripts
COPY mcp_sentinel ./mcp_sentinel
COPY mcp_server ./mcp_server
COPY scripts ./scripts

# Set ownership
RUN chown -R sentinel:sentinel /app

# Switch to non-root user
USER sentinel

# Run FastMCP server via module
CMD ["python", "-m", "mcp_sentinel.server.app"]
