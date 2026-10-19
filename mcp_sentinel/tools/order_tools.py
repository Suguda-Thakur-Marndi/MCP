"""
Order MCP Tool Handlers for MCP-Sentinel Phase 2.
Coordinates order lookup and customer order history.
Complies with:
- Layered separation: Tool -> Service -> Repository -> PostgreSQL.
- Controlled outputs and bounded pagination limits.
- Safe error handling without revealing internal database details.
"""

from typing import Any, Optional

from mcp_sentinel.repositories.order_repository import OrderRepository
from mcp_sentinel.schemas.order import (
    GetCustomerOrdersInput,
    GetOrderInput,
)
from mcp_sentinel.security.exceptions import SentinelError
from mcp_sentinel.services.order_service import OrderService


def _get_service(
    service: Optional[OrderService] = None,
    order_repo: Optional[OrderRepository] = None,
) -> OrderService:
    if service is not None:
        return service
    return OrderService(order_repo=order_repo)


async def handle_get_order(
    raw_args: dict[str, Any],
    service: Optional[OrderService] = None,
    repo: Optional[OrderRepository] = None,
) -> dict[str, Any]:
    """
    Handles single order lookup by order_id or order_number.
    """
    svc = _get_service(service=service, order_repo=repo)
    try:
        validated = GetOrderInput(**raw_args)
    except Exception as exc:
        return {
            "status": "error",
            "error_type": "ValidationError",
            "message": f"Input validation failed: {exc!s}",
        }

    try:
        return await svc.get_order(validated.order_id)
    except SentinelError as se:
        return se.to_dict()
    except Exception:
        return {
            "status": "error",
            "error_type": "DatabaseError",
            "message": "Unable to complete the requested database operation.",
        }


async def handle_get_customer_orders(
    raw_args: dict[str, Any],
    service: Optional[OrderService] = None,
    repo: Optional[OrderRepository] = None,
) -> dict[str, Any]:
    """
    Handles retrieval of customer order history with bounded pagination.
    """
    svc = _get_service(service=service, order_repo=repo)
    try:
        validated = GetCustomerOrdersInput(**raw_args)
    except Exception as exc:
        return {
            "status": "error",
            "error_type": "ValidationError",
            "message": f"Input validation failed: {exc!s}",
        }

    try:
        return await svc.get_customer_orders(
            customer_id=validated.customer_id,
            limit=validated.limit,
            offset=validated.offset,
        )
    except SentinelError as se:
        return se.to_dict()
    except Exception:
        return {
            "status": "error",
            "error_type": "DatabaseError",
            "message": "Unable to complete the requested database operation.",
        }
