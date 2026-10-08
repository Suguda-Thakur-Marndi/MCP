"""
Customer MCP Tool Handlers for MCP-Sentinel Phase 2.
Coordinates customer queries, single customer lookups, controlled updates, and destructive deletions.
Complies with:
- Layered separation: Tool -> Service -> Repository -> PostgreSQL.
- Server-side authorization gating for destructive actions.
- Fail-closed error handling and data minimization.
"""

from typing import Any, Optional

from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.schemas.customer import (
    DeleteCustomerInput,
    GetCustomerInput,
    PurgeInactiveCustomerDataInput,
    QueryCustomerRecordsInput,
    UpdateCustomerInput,
)
from mcp_sentinel.security.audit_logger import (
    INPUT_VALIDATION_FAILED,
    log_security_event,
)
from mcp_sentinel.security.exceptions import (
    AuthorizationDeniedError,
    SentinelError,
)
from mcp_sentinel.security.middleware import SecurityGate
from mcp_sentinel.services.customer_service import CustomerService


def _get_service(
    service: Optional[CustomerService] = None,
    customer_repo: Optional[CustomerRepository] = None,
    approval_repo: Optional[ApprovalRepository] = None,
) -> CustomerService:
    if service is not None:
        return service
    return CustomerService(customer_repo=customer_repo, approval_repo=approval_repo)


async def handle_query_customer_records(
    raw_args: dict[str, Any],
    service: Optional[CustomerService] = None,
    repo: Optional[CustomerRepository] = None,
) -> dict[str, Any]:
    """
    Handles structured customer queries with strict input schema validation.
    """
    svc = _get_service(service=service, customer_repo=repo)
    try:
        validated = QueryCustomerRecordsInput(**raw_args)
    except Exception as exc:
        log_security_event(
            event_type=INPUT_VALIDATION_FAILED,
            tool_name="query_customer_records",
            action="validate_input",
            decision="REJECT",
            success=False,
            error_code="VALIDATION_ERROR",
            details={"error": str(exc)},
        )
        return {
            "status": "error",
            "error_type": "ValidationError",
            "message": f"Input validation failed: {exc!s}",
        }

    try:
        filter_dict = validated.filters.model_dump(exclude_none=True) if validated.filters else None
        res = await svc.search_customers(
            filters=filter_dict,
            limit=validated.limit,
            offset=validated.offset,
            sort_by=validated.sort_by,
            sort_order=validated.sort_order.value if validated.sort_order else None,
        )
        # Re-key 'customers' as 'records' if needed for Phase 1 backward compatibility
        return {
            "status": "success",
            "count": res["count"],
            "limit": res["limit"],
            "offset": res["offset"],
            "records": res["customers"],
            "customers": res["customers"],
        }
    except SentinelError as se:
        return se.to_dict()
    except Exception:
        return {
            "status": "error",
            "error_type": "DatabaseError",
            "message": "Unable to complete the requested database operation.",
        }


async def handle_get_customer(
    raw_args: dict[str, Any],
    service: Optional[CustomerService] = None,
) -> dict[str, Any]:
    """
    Handles single customer record lookup with data minimization.
    """
    svc = _get_service(service=service)
    try:
        validated = GetCustomerInput(**raw_args)
    except Exception as exc:
        return {
            "status": "error",
            "error_type": "ValidationError",
            "message": f"Input validation failed: {exc!s}",
        }

    try:
        return await svc.get_customer(validated.customer_id)
    except SentinelError as se:
        return se.to_dict()
    except Exception:
        return {
            "status": "error",
            "error_type": "DatabaseError",
            "message": "Unable to complete the requested database operation.",
        }


async def handle_update_customer(
    raw_args: dict[str, Any],
    service: Optional[CustomerService] = None,
) -> dict[str, Any]:
    """
    Handles customer profile updates restricted to allow-listed fields (status, country).
    """
    svc = _get_service(service=service)
    try:
        validated = UpdateCustomerInput(**raw_args)
    except Exception as exc:
        return {
            "status": "error",
            "error_type": "ValidationError",
            "message": f"Input validation failed: {exc!s}",
        }

    try:
        return await svc.update_customer(
            customer_id=validated.customer_id,
            status=validated.status.value if validated.status else None,
            country=validated.country,
            approval_ticket=validated.approval_ticket,
        )
    except AuthorizationDeniedError as ae:
        return {
            "status": "rejected",
            "error_type": "AuthorizationDeniedError",
            "message": ae.safe_message,
        }
    except SentinelError as se:
        return se.to_dict()
    except Exception:
        return {
            "status": "error",
            "error_type": "DatabaseError",
            "message": "Unable to complete the requested database operation.",
        }


async def handle_delete_customer(
    raw_args: dict[str, Any],
    service: Optional[CustomerService] = None,
) -> dict[str, Any]:
    """
    Handles permanent deletion of a customer record.
    DESTRUCTIVE ACTION: Strictly gated by server-side approval ticket.
    """
    svc = _get_service(service=service)

    # Phase 4 Server-Side Policy Gating evaluated if no ticket is provided
    approval_repo = getattr(svc, "approval_repo", None)
    if not raw_args.get("approval_ticket"):
        allowed, decision, block_res = await SecurityGate.evaluate_and_gate(
            tool_name="delete_customer",
            raw_args=raw_args,
            approval_repo=approval_repo,
            record_count=1,
        )
        if not allowed:
            return block_res

    try:
        validated = DeleteCustomerInput(**raw_args)
    except Exception as exc:
        return {
            "status": "error",
            "error_type": "ValidationError",
            "message": f"Input validation failed: {exc!s}",
        }

    try:
        return await svc.delete_customer(
            customer_id=validated.customer_id,
            approval_ticket=validated.approval_ticket,
            reason=validated.reason,
            raw_parameters=raw_args,
        )
    except AuthorizationDeniedError as ae:
        return {
            "status": "rejected",
            "error_type": "AuthorizationDeniedError",
            "message": ae.safe_message,
        }
    except SentinelError as se:
        return se.to_dict()
    except Exception:
        return {
            "status": "error",
            "error_type": "DatabaseError",
            "message": "Unable to complete the requested database operation.",
        }


async def handle_purge_inactive_customer_data(
    raw_args: dict[str, Any],
    service: Optional[CustomerService] = None,
    customer_repo: Optional[CustomerRepository] = None,
    approval_repo: Optional[ApprovalRepository] = None,
) -> dict[str, Any]:
    """
    Handles high-risk destructive purge of inactive customer data.
    Supports single inactive customer purge or bulk retention purge.
    Fails closed if approval ticket is invalid or unapproved.
    """
    svc = _get_service(
        service=service,
        customer_repo=customer_repo,
        approval_repo=approval_repo,
    )

    # Phase 4 Server-Side Policy Gating evaluated if no ticket is provided
    if not raw_args.get("approval_ticket"):
        allowed, decision, block_res = await SecurityGate.evaluate_and_gate(
            tool_name="purge_inactive_customer_data",
            raw_args=raw_args,
            approval_repo=getattr(svc, "approval_repo", None),
            record_count=raw_args.get("inactivity_days") or 1,
        )
        if not allowed:
            return block_res

    try:
        validated = PurgeInactiveCustomerDataInput(**raw_args)
    except Exception as exc:
        return {
            "status": "error",
            "error_type": "ValidationError",
            "message": f"Input validation failed: {exc!s}",
        }

    try:
        return await svc.purge_inactive_data(
            approval_ticket=validated.approval_ticket,
            customer_id=validated.customer_id,
            inactivity_days=validated.inactivity_days,
            reason=validated.reason or "Dormant account compliance purge",
            dry_run=validated.dry_run,
            raw_parameters=raw_args,
        )
    except AuthorizationDeniedError as ae:
        return {
            "status": "rejected",
            "error_type": "AuthorizationDeniedError",
            "message": ae.safe_message,
        }
    except SentinelError as se:
        return se.to_dict()
    except Exception:
        return {
            "status": "error",
            "error_type": "DatabaseError",
            "message": "Unable to complete the requested database operation.",
        }
