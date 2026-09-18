"""
MCP-Sentinel Server Application.
Production-grade FastMCP server with Human-in-the-Loop approval gating.
Complies with:
- Security Rule #1: Never trust the AI agent.
- Security Rule #2: Never trust tool annotations as the sole security boundary.
- Security Rule #4: Never execute arbitrary SQL supplied by an LLM (no execute_sql / raw_sql).
- Security Rule #7: The MCP server itself must enforce security.
- Security Rule #9: Do not expose stack traces or secrets to users.
- Security Rule #10: Fail closed for security-sensitive failures.
"""

from typing import Any, Optional, Union

from fastmcp import FastMCP
from mcp.types import ToolAnnotations

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.schemas.common import (
    CustomerStatusEnum,
    SortOrderEnum,
)
from mcp_sentinel.schemas.customer import CustomerFilter
from mcp_sentinel.security.correlation import clear_request_id, set_request_id
from mcp_sentinel.security.middleware import SecurityGate
from mcp_sentinel.services.audit_service import AuditService
from mcp_sentinel.services.customer_service import CustomerService
from mcp_sentinel.services.order_service import OrderService
from mcp_sentinel.tools.audit_tools import handle_append_customer_audit_note
from mcp_sentinel.tools.customer_tools import (
    handle_delete_customer,
    handle_get_customer,
    handle_purge_inactive_customer_data,
    handle_query_customer_records,
    handle_update_customer,
)
from mcp_sentinel.tools.order_tools import (
    handle_get_customer_orders,
    handle_get_order,
)


def create_app(
    customer_service: Optional[CustomerService] = None,
    order_service: Optional[OrderService] = None,
    audit_service: Optional[AuditService] = None,
) -> FastMCP:
    """
    Factory creating and configuring the FastMCP server with security-hardened enterprise tools.
    """
    settings = get_settings()
    server = FastMCP(
        name=settings.MCP_SERVER_NAME,
        instructions=(
            "MCP-Sentinel Secure Enterprise Gateway. Provides controlled, minimized access "
            "to enterprise customers, orders, and audit notes. Destructive operations strictly "
            "require verified server-side Human-in-the-Loop authorization tickets."
        ),
    )

    cust_svc = customer_service or CustomerService()
    ord_svc = order_service or OrderService()
    aud_svc = audit_service or AuditService()

    # =========================================================================
    # 1. READ TOOL: query_customer_records
    # =========================================================================
    @server.tool(
        name="query_customer_records",
        description=(
            "Executes parameterized read-only queries against synthetic customer records using structured filters. "
            "Accepts allow-listed criteria: status, country, customer_id, tier. "
            "Raw SQL interpolation or arbitrary column names are strictly forbidden."
        ),
        annotations=ToolAnnotations(
            title="Query Customer Records",
            read_only_hint=True,
            destructive_hint=False,
            idempotent_hint=True,
            open_world_hint=False,
        ),
    )
    async def query_customer_records(
        filters: Optional[CustomerFilter] = None,
        limit: int = 50,
        offset: int = 0,
        sort_by: Optional[str] = "created_at",
        sort_order: Optional[SortOrderEnum] = SortOrderEnum.DESC,
    ) -> dict[str, Any]:
        set_request_id()
        try:
            raw_args: dict[str, Any] = {
                "limit": limit,
                "offset": offset,
                "sort_by": sort_by,
                "sort_order": sort_order.value if sort_order else None,
            }
            if filters is not None:
                raw_args["filters"] = filters.model_dump(exclude_none=True)

            allowed, decision, block_res = await SecurityGate.evaluate_and_gate(
                tool_name="query_customer_records",
                raw_args=raw_args,
                record_count=limit,
            )
            if not allowed:
                return block_res

            return await handle_query_customer_records(
                raw_args=raw_args,
                service=cust_svc,
            )
        finally:
            clear_request_id()

    # =========================================================================
    # 2. READ TOOL: get_customer
    # =========================================================================
    @server.tool(
        name="get_customer",
        description=(
            "Retrieves a single synthetic customer profile by internal ID or enterprise code (e.g. 'CUST-000001'). "
            "Returns only approved customer fields: id, customer_code, name, email, country, status, created_at. "
            "Returns a safe not-found response if the customer does not exist."
        ),
        annotations=ToolAnnotations(
            title="Get Customer Profile",
            read_only_hint=True,
            destructive_hint=False,
            idempotent_hint=True,
            open_world_hint=False,
        ),
    )
    async def get_customer(
        customer_id: Union[int, str],
    ) -> dict[str, Any]:
        set_request_id()
        try:
            raw_args = {"customer_id": customer_id}
            allowed, decision, block_res = await SecurityGate.evaluate_and_gate(
                tool_name="get_customer",
                raw_args=raw_args,
                record_count=1,
            )
            if not allowed:
                return block_res

            return await handle_get_customer(
                raw_args=raw_args,
                service=cust_svc,
            )
        finally:
            clear_request_id()

    # =========================================================================
    # 3. READ TOOL: get_customer_orders
    # =========================================================================
    @server.tool(
        name="get_customer_orders",
        description=(
            "Retrieves purchase order history for a specific customer with bounded pagination. "
            "Guarantees parameterized SQL and data minimization."
        ),
        annotations=ToolAnnotations(
            title="Get Customer Orders",
            read_only_hint=True,
            destructive_hint=False,
            idempotent_hint=True,
            open_world_hint=False,
        ),
    )
    async def get_customer_orders(
        customer_id: Union[int, str],
        limit: int = 50,
        offset: int = 0,
    ) -> dict[str, Any]:
        set_request_id()
        try:
            raw_args = {
                "customer_id": customer_id,
                "limit": limit,
                "offset": offset,
            }
            allowed, decision, block_res = await SecurityGate.evaluate_and_gate(
                tool_name="get_customer_orders",
                raw_args=raw_args,
                record_count=limit,
            )
            if not allowed:
                return block_res

            return await handle_get_customer_orders(
                raw_args=raw_args,
                service=ord_svc,
            )
        finally:
            clear_request_id()

    # =========================================================================
    # 4. READ TOOL: get_order
    # =========================================================================
    @server.tool(
        name="get_order",
        description=(
            "Retrieves a single order by internal ID or enterprise order_number ('ORD-XXXXXX'). "
            "Returns controlled fields: id, order_number, customer_id, status, total_amount, currency, created_at."
        ),
        annotations=ToolAnnotations(
            title="Get Order Details",
            read_only_hint=True,
            destructive_hint=False,
            idempotent_hint=True,
            open_world_hint=False,
        ),
    )
    async def get_order(
        order_id: Union[int, str],
    ) -> dict[str, Any]:
        set_request_id()
        try:
            raw_args = {"order_id": order_id}
            allowed, decision, block_res = await SecurityGate.evaluate_and_gate(
                tool_name="get_order",
                raw_args=raw_args,
                record_count=1,
            )
            if not allowed:
                return block_res

            return await handle_get_order(
                raw_args=raw_args,
                service=ord_svc,
            )
        finally:
            clear_request_id()

    # =========================================================================
    # 5. WRITE TOOL: append_customer_audit_note
    # =========================================================================
    @server.tool(
        name="append_customer_audit_note",
        description=(
            "Appends an administrative audit note to an existing customer record. "
            "Additive operation only. Note contents are treated strictly as untrusted data. "
            "Validates customer existence and strictly parameterizes all fields."
        ),
        annotations=ToolAnnotations(
            title="Append Customer Audit Note",
            read_only_hint=False,
            destructive_hint=False,
            idempotent_hint=False,
            open_world_hint=False,
        ),
    )
    async def append_customer_audit_note(
        customer_id: Union[int, str],
        note: Optional[str] = None,
        note_text: Optional[str] = None,
        author_id: str = "agent",
    ) -> dict[str, Any]:
        set_request_id()
        try:
            raw_args = {
                "customer_id": customer_id,
                "note": note or note_text,
                "note_text": note_text or note,
                "author_id": author_id,
            }
            allowed, decision, block_res = await SecurityGate.evaluate_and_gate(
                tool_name="append_customer_audit_note",
                raw_args=raw_args,
                record_count=1,
            )
            if not allowed:
                return block_res

            return await handle_append_customer_audit_note(
                raw_args=raw_args,
                service=aud_svc,
            )
        finally:
            clear_request_id()

    # =========================================================================
    # 6. WRITE TOOL: update_customer
    # =========================================================================
    @server.tool(
        name="update_customer",
        description=(
            "Updates specific lifecycle attributes of a customer profile. "
            "Strictly restricted to allow-listed fields: status and country. "
            "Arbitrary column updates or raw SQL are prohibited."
        ),
        annotations=ToolAnnotations(
            title="Update Customer Profile",
            read_only_hint=False,
            destructive_hint=False,
            idempotent_hint=False,
            open_world_hint=False,
        ),
    )
    async def update_customer(
        customer_id: Union[int, str],
        status: Optional[CustomerStatusEnum] = None,
        country: Optional[str] = None,
    ) -> dict[str, Any]:
        set_request_id()
        try:
            raw_args: dict[str, Any] = {"customer_id": customer_id}
            if status is not None:
                raw_args["status"] = status.value
            if country is not None:
                raw_args["country"] = country

            allowed, decision, block_res = await SecurityGate.evaluate_and_gate(
                tool_name="update_customer",
                raw_args=raw_args,
                record_count=1,
            )
            if not allowed:
                return block_res

            return await handle_update_customer(
                raw_args=raw_args,
                service=cust_svc,
            )
        finally:
            clear_request_id()

    # =========================================================================
    # 7. DESTRUCTIVE TOOL: delete_customer
    # =========================================================================
    @server.tool(
        name="delete_customer",
        description=(
            "Permanently deletes a customer record and associated data from the database. "
            "HIGH-RISK DESTRUCTIVE OPERATION. Requires a valid, unconsumed server-validated approval ticket. "
            "The operation fails closed if approval is missing, expired, or invalid."
        ),
        annotations=ToolAnnotations(
            title="Delete Customer Record",
            read_only_hint=False,
            destructive_hint=True,
            idempotent_hint=True,
            open_world_hint=False,
        ),
    )
    async def delete_customer(
        customer_id: Union[int, str],
        approval_ticket: Optional[str] = None,
        reason: str = "Customer deletion request",
    ) -> dict[str, Any]:
        set_request_id()
        try:
            raw_args = {
                "customer_id": customer_id,
                "approval_ticket": approval_ticket,
                "reason": reason,
            }
            approval_repo = cust_svc.approval_repo if hasattr(cust_svc, "approval_repo") else None
            allowed, decision, block_res = await SecurityGate.evaluate_and_gate(
                tool_name="delete_customer",
                raw_args=raw_args,
                approval_repo=approval_repo,
                record_count=1,
            )
            if not allowed:
                return block_res

            return await handle_delete_customer(
                raw_args=raw_args,
                service=cust_svc,
            )
        finally:
            clear_request_id()

    # =========================================================================
    # 8. DESTRUCTIVE TOOL: purge_inactive_customer_data
    # =========================================================================
    @server.tool(
        name="purge_inactive_customer_data",
        description=(
            "Permanently purges inactive customer data (by specific customer_id or bulk inactivity_days). "
            "HIGH-RISK DESTRUCTIVE OPERATION. Requires verified approval_ticket issued by authorized personnel. "
            "Fails closed without valid human-in-the-loop sign-off."
        ),
        annotations=ToolAnnotations(
            title="Purge Inactive Customer Data",
            read_only_hint=False,
            destructive_hint=True,
            idempotent_hint=True,
            open_world_hint=False,
        ),
    )
    async def purge_inactive_customer_data(
        approval_ticket: Optional[str] = None,
        customer_id: Optional[Union[int, str]] = None,
        inactivity_days: Optional[int] = None,
        reason: str = "Dormant account compliance purge",
        dry_run: bool = False,
    ) -> dict[str, Any]:
        set_request_id()
        try:
            raw_args: dict[str, Any] = {
                "approval_ticket": approval_ticket,
                "reason": reason,
                "dry_run": dry_run,
            }
            if customer_id is not None:
                raw_args["customer_id"] = customer_id
            if inactivity_days is not None:
                raw_args["inactivity_days"] = inactivity_days

            approval_repo = cust_svc.approval_repo if hasattr(cust_svc, "approval_repo") else None
            allowed, decision, block_res = await SecurityGate.evaluate_and_gate(
                tool_name="purge_inactive_customer_data",
                raw_args=raw_args,
                approval_repo=approval_repo,
                record_count=inactivity_days or 1,
            )
            if not allowed:
                return block_res

            return await handle_purge_inactive_customer_data(
                raw_args=raw_args,
                service=cust_svc,
            )
        finally:
            clear_request_id()

    return server


# Module-level server instance
app = create_app()


def run() -> None:
    """
    Standard entrypoint for MCP-Sentinel server (defaulting to stdio transport).
    """
    app.run(transport="stdio")


if __name__ == "__main__":
    run()
