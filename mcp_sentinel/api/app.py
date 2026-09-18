"""
Root FastAPI Application for MCP-Sentinel Security Platform.
Provides production REST API endpoints for agent interaction, human approvals,
authentication, security evaluation, audit event log inspection, and system metrics.
Phase 9 Hardened:
- OpenTelemetry tracing and correlation ID propagation.
- Real Prometheus application metrics scraping (/metrics).
- Decoupled health checks (/health/live, /health/ready).
- Route-level rate limiting against API abuse.
- Fail-fast production configuration validation.
- Graceful shutdown with resource cleanup.
"""

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from mcp_sentinel.api.routers import (
    agent,
    approvals,
    audit,
    auth,
    dashboard,
    health,
    policies,
    security,
    security_eval,
)
from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.database.connection import check_db_health, close_db_pool, get_pool_status
from mcp_sentinel.observability.metrics import get_metrics
from mcp_sentinel.security.auth.context import clear_current_user_context
from mcp_sentinel.security.correlation import (
    clear_all_correlation,
    get_request_id,
    get_trace_id,
    set_request_id,
    set_trace_id,
)
from mcp_sentinel.security.exceptions import (
    ApprovalRequiredError,
    AuthorizationDeniedError,
    PolicyViolationError,
    SecurityValidationError,
    SecurityViolationError,
    SentinelError,
)
from mcp_sentinel.security.headers import SecurityHeadersMiddleware
from mcp_sentinel.security.rate_limiter import RateLimitMiddleware

logger = logging.getLogger("mcp_sentinel.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Validates production configuration and database connectivity on startup.
    Ensures clean termination of connection pools on shutdown.
    """
    settings = get_settings()
    logger.info("Initializing MCP-Sentinel API in %s environment...", settings.APP_ENV)

    # 1. Fail-fast validation if running in production
    if settings.APP_ENV == "production":
        settings.validate_production_startup()
        logger.info("Production configuration validation passed successfully.")

    # 2. Validate database connection at startup
    is_healthy = await check_db_health()
    if not is_healthy:
        logger.warning(
            "Database connectivity check failed at startup. Operating in degraded state until DB is reachable."
        )
    else:
        logger.info("Database connection validated successfully.")

    yield

    # 3. Graceful shutdown: close database pool
    logger.info("Shutting down MCP-Sentinel API and closing database pool.")
    try:
        await close_db_pool()
        logger.info("Database connection pool closed successfully.")
    except Exception as exc:
        logger.error("Error closing database connection pool: %s", exc)


def create_app() -> FastAPI:
    """
    Factory creating configured FastAPI application.
    """
    settings = get_settings()

    app = FastAPI(
        title="MCP-Sentinel Security Platform",
        description="Production MCP Security, Policy Governance, and Human Approval Platform",
        version="1.0.0",
        docs_url="/docs" if settings.APP_ENV != "production" else None,
        redoc_url="/redoc" if settings.APP_ENV != "production" else None,
        lifespan=lifespan,
    )

    # 1. Request correlation & HTTP metrics middleware
    @app.middleware("http")
    async def correlation_and_metrics_middleware(request: Request, call_next):
        t0 = time.perf_counter()
        req_id = request.headers.get("X-Request-ID") or f"req-{uuid.uuid4().hex[:12]}"
        trace_id = request.headers.get("X-Trace-ID") or f"tr-{uuid.uuid4().hex}"
        set_request_id(req_id)
        set_trace_id(trace_id)

        try:
            response = await call_next(request)
            duration = time.perf_counter() - t0
            route_path = request.url.path
            get_metrics().record_http_request(
                request.method, route_path, response.status_code, duration
            )
            response.headers["X-Request-ID"] = req_id
            response.headers["X-Trace-ID"] = trace_id
            return response
        except Exception:
            duration = time.perf_counter() - t0
            get_metrics().record_http_request(request.method, request.url.path, 500, duration)
            raise
        finally:
            clear_all_correlation()
            clear_current_user_context()

    # 2. Bounded rate limiting middleware
    app.add_middleware(RateLimitMiddleware)

    # 3. Enterprise security headers & CSRF protection
    app.add_middleware(SecurityHeadersMiddleware)

    # 4. Configure CORS for Next.js frontend console using explicit configured origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 5. Prometheus metrics exposition endpoint
    @app.get(
        "/metrics",
        include_in_schema=False,
        summary="Prometheus Application Metrics Scrape Endpoint",
    )
    async def metrics_endpoint():
        pool_stats = get_pool_status()
        get_metrics().set_db_pool_status(
            total=pool_stats.get("total", 0),
            used=pool_stats.get("used", 0),
            free=pool_stats.get("free", 0),
        )
        return Response(
            content=get_metrics().to_prometheus_text(),
            media_type="text/plain; version=0.0.4; charset=utf-8",
        )

    # 6. Public configuration endpoint (safe for frontend)
    @app.get("/api/config/public", tags=["Configuration"], summary="Safe public configuration")
    async def public_config():
        return {
            "status": "success",
            "config": settings.get_public_config(),
        }

    # Exception Handlers adhering to Security Rule #9 (No stack traces or secrets)
    @app.exception_handler(SentinelError)
    async def sentinel_error_handler(request: Request, exc: SentinelError):
        logger.warning(
            "SentinelError encountered: %s | Internal details: %s",
            exc.safe_message,
            exc.internal_details,
        )
        status_code = status.HTTP_400_BAD_REQUEST
        if isinstance(exc, (AuthorizationDeniedError, PolicyViolationError, ApprovalRequiredError)):
            status_code = status.HTTP_403_FORBIDDEN
        elif isinstance(exc, SecurityViolationError):
            status_code = status.HTTP_403_FORBIDDEN
        elif isinstance(exc, SecurityValidationError):
            status_code = status.HTTP_422_UNPROCESSABLE_ENTITY

        return JSONResponse(
            status_code=status_code,
            content={
                "status": "error",
                "error_type": exc.__class__.__name__,
                "message": exc.safe_message,
                "request_id": get_request_id(),
            },
            headers={"X-Request-ID": get_request_id(), "X-Trace-ID": get_trace_id()},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        logger.warning("Request validation error: %s", exc.errors())
        # Strip any internal input values that might contain sensitive data
        sanitized_errors = [
            {"loc": err["loc"], "msg": err["msg"], "type": err["type"]} for err in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "status": "error",
                "error_type": "ValidationError",
                "message": "Invalid request payload format.",
                "details": sanitized_errors,
                "request_id": get_request_id(),
            },
            headers={"X-Request-ID": get_request_id(), "X-Trace-ID": get_trace_id()},
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "status": "error",
                "error_type": "HTTPException",
                "message": exc.detail,
                "request_id": get_request_id(),
            },
            headers={"X-Request-ID": get_request_id(), "X-Trace-ID": get_trace_id()},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled server exception: %s", str(exc), exc_info=True)
        # Safe message: NEVER expose Python stack traces or internal paths to client
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "error_type": "InternalServerError",
                "message": "An unexpected internal server error occurred. Please contact the security team.",
                "request_id": get_request_id(),
            },
            headers={"X-Request-ID": get_request_id(), "X-Trace-ID": get_trace_id()},
        )

    # Attach routers
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(agent.router)
    app.include_router(approvals.router)
    app.include_router(audit.router)
    app.include_router(dashboard.router)
    app.include_router(policies.router)
    app.include_router(security.router)
    app.include_router(security_eval.router)

    return app


app = create_app()
