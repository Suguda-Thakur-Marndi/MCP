"""
Order Service for MCP-Sentinel Phase 2.
Business logic layer coordinating order lookups and customer order history.
Complies with:
- Strict parameterization and bounded pagination.
- Explicit data projection (data minimization).
- Safe error handling without revealing internal database details.
"""

from typing import Any, Optional, Union

from mcp_sentinel.repositories.audit_repository import AuditRepository
from mcp_sentinel.repositories.order_repository import OrderRepository
from mcp_sentinel.schemas.common import parse_customer_id
from mcp_sentinel.security.audit_logger import (
    TOOL_EXECUTED,
    TOOL_REQUESTED,
    log_security_event,
)
from mcp_sentinel.security.auth.abac import check_resource_access
from mcp_sentinel.security.auth.context import get_current_user_context
from mcp_sentinel.security.correlation import get_request_id
from mcp_sentinel.security.exceptions import SecurityValidationError


class OrderService:
    """
    Coordinates order queries, bounds enforcement, and audit event recording.
    """

    def __init__(
        self,
        order_repo: Optional[OrderRepository] = None,
        audit_repo: Optional[AuditRepository] = None,
        pool: Optional[Any] = None,
    ):
        target_pool = pool or getattr(order_repo, "_pool", None)
        self.order_repo = order_repo or OrderRepository(pool=target_pool)
        self.audit_repo = audit_repo or AuditRepository(pool=target_pool)

    async def get_order(self, order_id: Union[int, str]) -> dict[str, Any]:
        """
        Retrieves a single order by ID or order_number ('ORD-XXXXXX').
        Returns controlled fields only.
        """
        req_id = get_request_id() or "unknown_req"
        log_security_event(
            event_type=TOOL_REQUESTED,
            action="get_order",
            decision="PROCESS",
            tool_name="get_order",
            request_id=req_id,
            details={"order_id": str(order_id)},
        )

        order = await self.order_repo.get_order_by_id_or_number(order_id)
        if not order:
            await self.audit_repo.record_audit_event(
                event_type="ORDER_LOOKUP",
                tool_name="get_order",
                decision="NOT_FOUND",
                request_id=req_id,
                details={"order_id": str(order_id)},
            )
            return {
                "status": "not_found",
                "order": None,
                "message": f"Order with identifier '{order_id}' was not found.",
            }

        # ABAC Resource-Level Authorization (IDOR Protection)
        current_user = get_current_user_context()
        if current_user:
            check_resource_access(
                current_user, "order", str(order.get("customer_id") or order_id), "read"
            )

        await self.audit_repo.record_audit_event(
            event_type="TOOL_EXECUTED",
            tool_name="get_order",
            decision="ALLOWED",
            request_id=req_id,
            details={"order_id": order["order_number"]},
        )
        return {
            "status": "success",
            "order": order,
        }

    async def get_customer_orders(
        self,
        customer_id: Union[int, str],
        limit: int = 50,
        offset: int = 0,
        max_limit: int = 100,
    ) -> dict[str, Any]:
        """
        Retrieves order history for a customer with bounded pagination.
        """
        req_id = get_request_id() or "unknown_req"
        try:
            num_id = parse_customer_id(customer_id)
        except ValueError as exc:
            raise SecurityValidationError(str(exc))

        # ABAC Resource-Level Authorization (IDOR Protection)
        current_user = get_current_user_context()
        if current_user:
            check_resource_access(current_user, "customer", str(num_id), "read")

        log_security_event(
            event_type=TOOL_REQUESTED,
            action="get_customer_orders",
            decision="PROCESS",
            tool_name="get_customer_orders",
            request_id=req_id,
            details={"customer_id": num_id, "limit": limit, "offset": offset},
        )

        orders = await self.order_repo.get_orders_by_customer_id(
            customer_id=num_id,
            limit=limit,
            offset=offset,
            max_limit=max_limit,
        )

        log_security_event(
            event_type=TOOL_EXECUTED,
            action="get_customer_orders",
            decision="COMPLETE",
            tool_name="get_customer_orders",
            request_id=req_id,
            details={"record_count": len(orders)},
        )
        await self.audit_repo.record_audit_event(
            event_type="TOOL_EXECUTED",
            tool_name="get_customer_orders",
            decision="ALLOWED",
            request_id=req_id,
            details={"customer_id": num_id, "count": len(orders)},
        )

        return {
            "status": "success",
            "customer_id": num_id,
            "count": len(orders),
            "limit": limit,
            "offset": offset,
            "orders": orders,
        }
