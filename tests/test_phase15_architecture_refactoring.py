"""
Phase 15 Architecture Refactoring & Non-Regression Verification Tests.

Verifies:
1. Unified error response format { status, error_type, message, detail, request_id }
2. SentinelError exception hierarchy HTTP status code mappings:
   - NotFoundError -> 404
   - ConflictError -> 409
   - RateLimitExceededError -> 429
   - ExecutionTimeoutError -> 504
   - UpstreamProviderError -> 502
   - AuthorizationDeniedError / PolicyViolationError / ApprovalRequiredError -> 403
   - SecurityValidationError -> 422
3. Safe message exposure without leaking internal diagnostics
4. API routers and package exports consistency
5. Preservation of Phase 14 zero-trust security controls
"""

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from mcp_sentinel.api.app import create_app
from mcp_sentinel.security.exceptions import (
    ApprovalRequiredError,
    AuthorizationDeniedError,
    ConflictError,
    ExecutionTimeoutError,
    NotFoundError,
    PolicyViolationError,
    RateLimitExceededError,
    SecurityValidationError,
    SecurityViolationError,
    SentinelError,
    UpstreamProviderError,
)


@pytest.fixture
def error_test_app() -> FastAPI:
    """Creates an app instance and adds test endpoints that raise various SentinelErrors."""
    app = create_app()

    @app.get("/test-errors/not-found")
    async def route_not_found():
        raise NotFoundError(
            message="Tool 'github.nonexistent' was not found.",
            internal_details="Searched registry with 14 tools, key missing.",
        )

    @app.get("/test-errors/conflict")
    async def route_conflict():
        raise ConflictError(
            message="Approval ticket already finalized.",
            internal_details="Ticket state is COMPLETED, cannot transition to APPROVED.",
        )

    @app.get("/test-errors/rate-limit")
    async def route_rate_limit():
        raise RateLimitExceededError(
            message="Too many requests. Please wait.",
            internal_details="Bucket token count 0/100 exhausted.",
        )

    @app.get("/test-errors/timeout")
    async def route_timeout():
        raise ExecutionTimeoutError(
            message="Execution exceeded bounded timeout.",
            internal_details="Subprocess terminated after 30.00s timeout.",
        )

    @app.get("/test-errors/upstream")
    async def route_upstream():
        raise UpstreamProviderError(
            message="Upstream AI provider unavailable.",
            internal_details="Gemini API returned 503 Service Unavailable.",
        )

    @app.get("/test-errors/auth-denied")
    async def route_auth_denied():
        raise AuthorizationDeniedError(
            message="Destructive operation cannot be authorized.",
            internal_details="User lacks ROLE_ADMIN privilege.",
        )

    @app.get("/test-errors/validation")
    async def route_validation():
        raise SecurityValidationError(
            message="Tool argument violates type constraints.",
            internal_details="Field 'limit' must be positive integer.",
        )

    @app.get("/test-errors/http-exc")
    async def route_http_exc():
        raise HTTPException(
            status_code=400,
            detail="Standard HTTP bad request.",
        )

    return app


def test_unified_error_format_not_found(error_test_app: FastAPI):
    """Verify NotFoundError returns 404 with unified format."""
    client = TestClient(error_test_app, raise_server_exceptions=False)
    resp = client.get("/test-errors/not-found")
    assert resp.status_code == 404
    data = resp.json()
    assert data["status"] == "error"
    assert data["error_type"] == "NotFoundError"
    assert data["message"] == "Tool 'github.nonexistent' was not found."
    assert data["detail"] == "Tool 'github.nonexistent' was not found."
    assert "request_id" in data
    # Ensure internal details are NEVER leaked
    assert "Searched registry" not in resp.text


def test_unified_error_format_conflict(error_test_app: FastAPI):
    """Verify ConflictError returns 409 with unified format."""
    client = TestClient(error_test_app, raise_server_exceptions=False)
    resp = client.get("/test-errors/conflict")
    assert resp.status_code == 409
    data = resp.json()
    assert data["status"] == "error"
    assert data["error_type"] == "ConflictError"
    assert data["message"] == "Approval ticket already finalized."
    assert data["detail"] == "Approval ticket already finalized."
    assert "request_id" in data
    assert "COMPLETED" not in resp.text


def test_unified_error_format_rate_limit(error_test_app: FastAPI):
    """Verify RateLimitExceededError returns 429 with unified format."""
    client = TestClient(error_test_app, raise_server_exceptions=False)
    resp = client.get("/test-errors/rate-limit")
    assert resp.status_code == 429
    data = resp.json()
    assert data["status"] == "error"
    assert data["error_type"] == "RateLimitExceededError"
    assert "Too many requests" in data["message"]
    assert data["message"] == data["detail"]
    assert "Bucket token count" not in resp.text


def test_unified_error_format_timeout(error_test_app: FastAPI):
    """Verify ExecutionTimeoutError returns 504 with unified format."""
    client = TestClient(error_test_app, raise_server_exceptions=False)
    resp = client.get("/test-errors/timeout")
    assert resp.status_code == 504
    data = resp.json()
    assert data["status"] == "error"
    assert data["error_type"] == "ExecutionTimeoutError"
    assert "bounded timeout" in data["message"]
    assert data["message"] == data["detail"]
    assert "Subprocess terminated" not in resp.text


def test_unified_error_format_upstream(error_test_app: FastAPI):
    """Verify UpstreamProviderError returns 502 with unified format."""
    client = TestClient(error_test_app, raise_server_exceptions=False)
    resp = client.get("/test-errors/upstream")
    assert resp.status_code == 502
    data = resp.json()
    assert data["status"] == "error"
    assert data["error_type"] == "UpstreamProviderError"
    assert "Upstream AI provider" in data["message"]
    assert data["message"] == data["detail"]
    assert "Gemini API" not in resp.text


def test_unified_error_format_auth_denied(error_test_app: FastAPI):
    """Verify AuthorizationDeniedError returns 403 with unified format."""
    client = TestClient(error_test_app, raise_server_exceptions=False)
    resp = client.get("/test-errors/auth-denied")
    assert resp.status_code == 403
    data = resp.json()
    assert data["status"] == "error"
    assert data["error_type"] == "AuthorizationDeniedError"
    assert "Destructive operation cannot be authorized." in data["message"]
    assert data["message"] == data["detail"]
    assert "ROLE_ADMIN" not in resp.text


def test_unified_error_format_validation(error_test_app: FastAPI):
    """Verify SecurityValidationError returns 422 with unified format."""
    client = TestClient(error_test_app, raise_server_exceptions=False)
    resp = client.get("/test-errors/validation")
    assert resp.status_code == 422
    data = resp.json()
    assert data["status"] == "error"
    assert data["error_type"] == "SecurityValidationError"
    assert "Tool argument violates type constraints." in data["message"]
    assert data["message"] == data["detail"]


def test_unified_error_format_http_exception(error_test_app: FastAPI):
    """Verify standard HTTPException includes both message and detail."""
    client = TestClient(error_test_app, raise_server_exceptions=False)
    resp = client.get("/test-errors/http-exc")
    assert resp.status_code == 400
    data = resp.json()
    assert data["status"] == "error"
    assert data["error_type"] == "HTTPException"
    assert data["message"] == "Standard HTTP bad request."
    assert data["detail"] == "Standard HTTP bad request."
    assert "request_id" in data


def test_api_routers_package_exports():
    """Verify all 12 API routers are cleanly exported from mcp_sentinel.api.routers."""
    from mcp_sentinel.api import routers

    expected_routers = [
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
    for r in expected_routers:
        assert hasattr(routers, r), f"Router {r} should be exported from mcp_sentinel.api.routers"
        module = getattr(routers, r)
        assert hasattr(module, "router"), f"Module {r} should expose an APIRouter named 'router'"


def test_repositories_package_exports():
    """Verify repositories package exports clean data access abstractions."""
    import mcp_sentinel.repositories as repos

    expected_repos = [
        "ApprovalRepository",
        "AuditRepository",
        "CustomerRepository",
        "OrderRepository",
        "SecurityEvalRepository",
        "SessionRepository",
        "UserRepository",
    ]
    for repo_name in expected_repos:
        assert hasattr(repos, repo_name), f"Repository {repo_name} should be exported"


def test_services_package_exports():
    """Verify services package exports clean domain service abstractions."""
    import mcp_sentinel.services as services

    expected_services = [
        "ApprovalService",
        "AuditService",
        "CustomerService",
        "OrderService",
    ]
    for svc_name in expected_services:
        assert hasattr(services, svc_name), f"Service {svc_name} should be exported"


def test_exception_status_code_attribute_hierarchy():
    """Verify all SentinelError subclasses define an appropriate http_status_code."""
    assert SentinelError.http_status_code == 400
    assert NotFoundError.http_status_code == 404
    assert ConflictError.http_status_code == 409
    assert RateLimitExceededError.http_status_code == 429
    assert ExecutionTimeoutError.http_status_code == 504
    assert UpstreamProviderError.http_status_code == 502
    assert AuthorizationDeniedError.http_status_code == 403
    assert SecurityViolationError.http_status_code == 403
    assert PolicyViolationError.http_status_code == 403
    assert ApprovalRequiredError.http_status_code == 403
    assert SecurityValidationError.http_status_code == 422
