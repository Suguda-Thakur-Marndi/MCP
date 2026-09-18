"""
Customer Service for MCP-Sentinel Phase 2.
Business logic layer coordinating customer queries, lifecycle updates, destructive actions,
and Human-in-the-Loop authorization gating.
Complies with:
- Security Rule #1: Never trust the AI agent.
- Security Rule #3: Never trust client-provided approval assertions.
- Security Rule #7: Server itself enforces authorization and security boundaries.
- Security Rule #10: Fail closed for security-sensitive operations.
"""

from typing import Any, Optional, Union

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.audit_repository import AuditRepository
from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.schemas.common import CustomerStatusEnum, parse_customer_id
from mcp_sentinel.security.audit_logger import (
    APPROVAL_REQUIRED,
    DESTRUCTIVE_ACTION_BLOCKED,
    DESTRUCTIVE_ACTION_EXECUTED,
    TOOL_EXECUTED,
    TOOL_REQUESTED,
    log_security_event,
)
from mcp_sentinel.security.auth.abac import check_resource_access
from mcp_sentinel.security.auth.context import get_current_user_context
from mcp_sentinel.security.correlation import get_request_id
from mcp_sentinel.security.exceptions import (
    AuthorizationDeniedError,
    SecurityValidationError,
)


class CustomerService:
    """
    Coordinates customer data access, authorization checks, and audit logging.
    """

    def __init__(
        self,
        customer_repo: Optional[CustomerRepository] = None,
        approval_repo: Optional[ApprovalRepository] = None,
        audit_repo: Optional[AuditRepository] = None,
        pool: Optional[Any] = None,
    ):
        target_pool = (
            pool or getattr(customer_repo, "_pool", None) or getattr(approval_repo, "_pool", None)
        )
        self.customer_repo = customer_repo or CustomerRepository(pool=target_pool)
        self.approval_repo = approval_repo or ApprovalRepository(pool=target_pool)
        self.audit_repo = audit_repo or AuditRepository(pool=target_pool)

    async def search_customers(
        self,
        filters: Optional[dict[str, Any]] = None,
        limit: int = 50,
        offset: int = 0,
        sort_by: Optional[str] = "created_at",
        sort_order: Optional[str] = "DESC",
        max_limit: int = 100,
    ) -> dict[str, Any]:
        """
        Executes bounded, parameterized customer search.
        """
        req_id = get_request_id() or "unknown_req"
        log_security_event(
            event_type=TOOL_REQUESTED,
            action="search_customers",
            decision="PROCESS",
            tool_name="query_customer_records",
            request_id=req_id,
        )

        results = await self.customer_repo.query_customers(
            filters=filters,
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
            max_limit=max_limit,
        )

        log_security_event(
            event_type=TOOL_EXECUTED,
            action="search_customers",
            decision="COMPLETE",
            tool_name="query_customer_records",
            request_id=req_id,
            details={"record_count": len(results)},
        )
        await self.audit_repo.record_audit_event(
            event_type="TOOL_EXECUTED",
            tool_name="query_customer_records",
            decision="ALLOWED",
            request_id=req_id,
            details={"record_count": len(results)},
        )

        return {
            "status": "success",
            "count": len(results),
            "limit": limit,
            "offset": offset,
            "customers": results,
        }

    async def get_customer(self, customer_id: Union[int, str]) -> dict[str, Any]:
        """
        Retrieves a single customer by ID or enterprise code (e.g. 'CUST-000001').
        Returns a safe not-found dictionary without exposing database internals.
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

        customer = await self.customer_repo.get_customer_by_id(num_id)
        if not customer:
            await self.audit_repo.record_audit_event(
                event_type="CUSTOMER_LOOKUP",
                tool_name="get_customer",
                decision="NOT_FOUND",
                request_id=req_id,
                details={"target_id": str(customer_id)},
            )
            return {
                "status": "not_found",
                "customer": None,
                "message": f"Customer with identifier '{customer_id}' was not found.",
            }

        await self.audit_repo.record_audit_event(
            event_type="TOOL_EXECUTED",
            tool_name="get_customer",
            decision="ALLOWED",
            request_id=req_id,
            details={"customer_id": num_id},
        )
        return {
            "status": "success",
            "customer": customer,
        }

    async def update_customer(
        self,
        customer_id: Union[int, str],
        status: Optional[str] = None,
        country: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Updates allow-listed customer fields with strict parameterization.
        """
        req_id = get_request_id() or "unknown_req"
        try:
            num_id = parse_customer_id(customer_id)
        except ValueError as exc:
            raise SecurityValidationError(str(exc))

        # ABAC Resource-Level Authorization (IDOR Protection)
        current_user = get_current_user_context()
        if current_user:
            check_resource_access(current_user, "customer", str(num_id), "write")

        if status is not None:
            if isinstance(status, str):
                try:
                    CustomerStatusEnum(status.lower())
                except ValueError:
                    raise SecurityValidationError(
                        f"Invalid customer status: '{status}'. Must be one of active, inactive, suspended."
                    )
            elif isinstance(status, CustomerStatusEnum):
                pass
            else:
                raise SecurityValidationError(
                    f"Invalid customer status type: {type(status).__name__}"
                )

        exists = await self.customer_repo.customer_exists(num_id)
        if not exists:
            return {
                "status": "not_found",
                "customer": None,
                "message": f"Customer with identifier '{customer_id}' was not found.",
            }

        updated = await self.customer_repo.update_customer(
            customer_id=num_id,
            status=status,
            country=country,
        )

        await self.audit_repo.record_audit_event(
            event_type="CUSTOMER_UPDATED",
            tool_name="update_customer",
            decision="EXECUTED",
            request_id=req_id,
            details={
                "customer_id": num_id,
                "updated_fields": {"status": status, "country": country},
            },
        )

        return {
            "status": "success",
            "customer": updated,
        }

    async def delete_customer(
        self,
        customer_id: Union[int, str],
        approval_ticket: str,
        reason: str,
        raw_parameters: Optional[dict[str, Any]] = None,
        environment: Optional[str] = None,
        agent_id: Optional[str] = None,
        requester_id: Optional[str] = None,
        approval_token: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        DESTRUCTIVE ACTION: Permanently deletes customer and cascading data.
        Requires valid server-validated approval ticket bound to exact parameters and target.
        """
        req_id = get_request_id() or "unknown_req"
        try:
            num_id = parse_customer_id(customer_id)
        except ValueError as exc:
            raise SecurityValidationError(str(exc))

        # ABAC Resource-Level Authorization (IDOR Protection)
        current_user = get_current_user_context()
        if current_user:
            check_resource_access(current_user, "customer", str(num_id), "delete")

        if not approval_ticket or not approval_ticket.strip():
            log_security_event(
                event_type=APPROVAL_REQUIRED,
                action="delete_customer",
                decision="BLOCK",
                tool_name="delete_customer",
                risk_classification="CRITICAL",
                success=False,
                error_code="MISSING_APPROVAL_TICKET",
            )
            await self.audit_repo.record_audit_event(
                event_type="DESTRUCTIVE_ACTION_BLOCKED",
                tool_name="delete_customer",
                decision="BLOCKED",
                request_id=req_id,
                details={"reason": "Missing approval ticket", "target_id": num_id},
            )
            raise AuthorizationDeniedError(
                message="Access Denied: Missing, expired, or invalid approval ticket. Administrative sign-off required."
            )

        settings = get_settings()
        env = environment or settings.APP_ENV
        clean_params = (
            {k: v for k, v in (raw_parameters or {}).items() if k != "approval_ticket"}
            if raw_parameters is not None
            else {"customer_id": num_id}
        )

        # 1. First attempt: Modern Phase 5 bound verification with exact parameters
        verified = await self.approval_repo.verify_and_consume_bound(
            ticket_id=approval_ticket,
            target_id=str(num_id),
            action="delete_customer",
            tool_name="delete_customer",
            environment=env,
            parameters=clean_params,
            agent_id=agent_id,
            requester_id=requester_id,
            approval_token=approval_token,
        )

        # 2. Fallback strictly for legacy Phase 2/3 tickets (not in approval_requests)
        if not verified:
            is_modern = await self.approval_repo.is_modern_approval_request(approval_ticket)
            if not is_modern:
                verified = await self.approval_repo.verify_and_consume(
                    ticket_id=approval_ticket,
                    target_id=str(num_id),
                    action="DELETE_CUSTOMER",
                )
                if not verified:
                    verified = await self.approval_repo.verify_and_consume(
                        ticket_id=approval_ticket,
                        target_id=str(num_id),
                        action="DELETE",
                    )

        if not verified:
            log_security_event(
                event_type=DESTRUCTIVE_ACTION_BLOCKED,
                action="delete_customer",
                decision="BLOCK",
                tool_name="delete_customer",
                risk_classification="CRITICAL",
                success=False,
                error_code="INVALID_APPROVAL_TICKET",
                details={"target_id": num_id},
            )
            await self.audit_repo.record_audit_event(
                event_type="DESTRUCTIVE_ACTION_BLOCKED",
                tool_name="delete_customer",
                decision="BLOCKED",
                request_id=req_id,
                details={"reason": "Invalid or expired ticket", "target_id": num_id},
            )
            raise AuthorizationDeniedError(
                message="Access Denied: Missing, expired, or invalid approval ticket. Administrative sign-off required."
            )

        # Execute authorized deletion
        deleted_count = await self.customer_repo.delete_customer(num_id)
        log_security_event(
            event_type=DESTRUCTIVE_ACTION_EXECUTED,
            action="delete_customer",
            decision="ALLOW",
            tool_name="delete_customer",
            risk_classification="CRITICAL",
            success=True,
            details={"deleted_records": deleted_count, "target_id": num_id},
        )
        await self.audit_repo.record_audit_event(
            event_type="DESTRUCTIVE_ACTION_EXECUTED",
            tool_name="delete_customer",
            decision="EXECUTED",
            request_id=req_id,
            details={
                "deleted_records": deleted_count,
                "target_id": num_id,
                "justification": reason,
            },
        )

        return {
            "status": "success",
            "customer_id": num_id,
            "rows_affected": deleted_count,
            "deleted_records": deleted_count,
            "message": f"Customer {num_id} and associated records successfully purged.",
        }

    async def purge_inactive_data(
        self,
        approval_ticket: str,
        customer_id: Optional[Union[int, str]] = None,
        inactivity_days: Optional[int] = None,
        reason: str = "Dormant customer compliance purge",
        dry_run: bool = False,
        raw_parameters: Optional[dict[str, Any]] = None,
        environment: Optional[str] = None,
        agent_id: Optional[str] = None,
        requester_id: Optional[str] = None,
        approval_token: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        HIGH-RISK DESTRUCTIVE ACTION: Purges inactive customer data.
        Supports single inactive customer purge or bulk retention purge by inactivity_days.
        Requires valid server-validated approval ticket bound to exact parameters and scope.
        """
        req_id = get_request_id() or "unknown_req"

        if not approval_ticket or not approval_ticket.strip():
            log_security_event(
                event_type=APPROVAL_REQUIRED,
                action="purge_inactive_customer_data",
                decision="BLOCK",
                tool_name="purge_inactive_customer_data",
                risk_classification="CRITICAL",
                success=False,
                error_code="MISSING_APPROVAL_TICKET",
            )
            await self.audit_repo.record_audit_event(
                event_type="DESTRUCTIVE_ACTION_BLOCKED",
                tool_name="purge_inactive_customer_data",
                decision="BLOCKED",
                request_id=req_id,
                details={"reason": "Missing approval ticket"},
            )
            raise AuthorizationDeniedError(
                message="Access Denied: Missing, expired, or invalid approval ticket. Administrative sign-off required."
            )

        # Determine target and verify ticket
        if customer_id is not None:
            num_id = parse_customer_id(customer_id)
            target = str(num_id)
        elif inactivity_days is not None:
            target = str(inactivity_days)
        else:
            raise SecurityValidationError(
                "Either customer_id or inactivity_days must be specified."
            )

        settings = get_settings()
        env = environment or settings.APP_ENV
        clean_params = (
            {k: v for k, v in (raw_parameters or {}).items() if k != "approval_ticket"}
            if raw_parameters is not None
            else (
                {"customer_id": num_id}
                if customer_id is not None
                else {"inactivity_days": inactivity_days}
            )
        )

        # 1. Attempt bound verification with exact parameters
        verified = await self.approval_repo.verify_and_consume_bound(
            ticket_id=approval_ticket,
            target_id=target,
            action="purge_inactive_customer_data",
            tool_name="purge_inactive_customer_data",
            environment=env,
            parameters=clean_params,
            agent_id=agent_id,
            requester_id=requester_id,
            approval_token=approval_token,
        )

        # 2. Fallback strictly for legacy Phase 2/3 tickets (not in approval_requests)
        if not verified:
            is_modern = await self.approval_repo.is_modern_approval_request(approval_ticket)
            if not is_modern:
                verified = await self.approval_repo.verify_and_consume(
                    ticket_id=approval_ticket,
                    target_id=target,
                    action="PURGE",
                )
                if not verified and inactivity_days is not None:
                    verified = await self.approval_repo.verify_and_consume(
                        ticket_id=approval_ticket,
                        target_id="ALL_INACTIVE",
                        action="PURGE",
                    )

        if not verified:
            log_security_event(
                event_type=DESTRUCTIVE_ACTION_BLOCKED,
                action="purge_inactive_customer_data",
                decision="BLOCK",
                tool_name="purge_inactive_customer_data",
                risk_classification="CRITICAL",
                success=False,
                error_code="UNAUTHORIZED_DESTRUCTIVE_ACTION",
                details={"target_id": target},
            )
            await self.audit_repo.record_audit_event(
                event_type="DESTRUCTIVE_ACTION_BLOCKED",
                tool_name="purge_inactive_customer_data",
                decision="BLOCKED",
                request_id=req_id,
                details={"reason": "Invalid or expired ticket", "target_id": target},
            )
            raise AuthorizationDeniedError(
                message="Access Denied: Missing, expired, or invalid approval ticket. Administrative sign-off required."
            )

        # Execute authorized purge
        if customer_id is not None:
            deleted_count = await self.customer_repo.purge_inactive_customer(num_id)
            result = {
                "status": "success",
                "customer_id": num_id,
                "rows_affected": deleted_count,
                "deleted_records": deleted_count,
                "ticket_consumed": approval_ticket,
                "reason": reason,
            }
        else:
            purge_result = await self.customer_repo.purge_inactive_by_days(
                inactivity_days=inactivity_days,  # type: ignore
                dry_run=dry_run,
            )
            deleted_count = purge_result["deleted_records"]
            result = {
                "status": "success" if not dry_run else "preview",
                "inactivity_days": inactivity_days,
                "rows_affected": deleted_count,
                "deleted_records": deleted_count,
                "matched_records": purge_result["matched_records"],
                "ticket_consumed": approval_ticket,
                "reason": reason,
                "dry_run": dry_run,
            }

        log_security_event(
            event_type=DESTRUCTIVE_ACTION_EXECUTED,
            action="purge_inactive_customer_data",
            decision="ALLOW",
            tool_name="purge_inactive_customer_data",
            risk_classification="CRITICAL",
            success=True,
            details={"result": result, "target_id": target},
        )
        await self.audit_repo.record_audit_event(
            event_type="DESTRUCTIVE_ACTION_EXECUTED",
            tool_name="purge_inactive_customer_data",
            decision="EXECUTED",
            request_id=req_id,
            details={"result": result, "target_id": target, "justification": reason},
        )

        return result
