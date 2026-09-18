"""
Attribute-Based Access Control (ABAC) & Resource Authorization for MCP-Sentinel.
Adheres to:
- Deterministic, testable evaluation of subject and object attributes.
- Resource-level authorization preventing Insecure Direct Object References (IDOR).
- Department, organization, and scoped data tenancy checks.
- Fail closed on unauthorized cross-user or cross-tenant resource access.
"""

from typing import Optional

from mcp_sentinel.schemas.common import parse_customer_id
from mcp_sentinel.security.audit_logger import (
    AUTHORIZATION_DENIED,
    IDOR_ATTEMPT_BLOCKED,
    log_security_event,
)
from mcp_sentinel.security.auth.models import AuthUser, UserRoleEnum, UserStatusEnum
from mcp_sentinel.security.correlation import get_request_id
from mcp_sentinel.security.exceptions import AuthorizationDeniedError


class ABACEvaluator:
    """
    Evaluates fine-grained attribute-based access controls against user attributes
    and target resource attributes.
    """

    @staticmethod
    def check_account_status(user: AuthUser) -> None:
        """Fails closed if the user account is disabled or inactive."""
        if not user or not user.is_active or user.status == UserStatusEnum.DISABLED:
            raise AuthorizationDeniedError("User account is disabled. Access denied.")

    @staticmethod
    def authorize_resource_access(
        user: AuthUser,
        resource_type: str,
        resource_id: Optional[str],
        operation: str = "read",
        resource_tenant: Optional[str] = None,
    ) -> None:
        """
        Enforces resource-level authorization boundaries.
        Prevents IDOR attacks where a user accesses unauthorized customer/order records.
        """
        ABACEvaluator.check_account_status(user)

        if not resource_id:
            return  # Bulk or unscoped operation evaluated by policy rules

        # 1. Organization / Tenant Isolation check
        if user.organization and resource_tenant and user.role != UserRoleEnum.ADMIN:
            if user.organization.lower() != resource_tenant.lower():
                rid = get_request_id()
                log_security_event(
                    event_type=AUTHORIZATION_DENIED,
                    action=f"{resource_type}:{operation}",
                    decision="DENY",
                    risk_classification="HIGH",
                    user_id=user.id,
                    success=False,
                    error_code="CROSS_TENANT_ACCESS_DENIED",
                    details={
                        "resource_id": str(resource_id),
                        "user_org": user.organization,
                        "resource_tenant": resource_tenant,
                    },
                    request_id=rid,
                )
                raise AuthorizationDeniedError(
                    "Access Denied: Cross-organization resource access is forbidden."
                )

        # 2. Explicit Scoped Resource Ownership (IDOR Prevention)
        if user.allowed_customer_ids is not None and resource_type in ("customer", "order"):
            # ADMIN role can access across tenants unless specifically restricted
            if user.role == UserRoleEnum.ADMIN and not user.allowed_customer_ids:
                return

            normalized_allowed = set()
            for item in user.allowed_customer_ids:
                clean_item = str(item).strip()
                normalized_allowed.add(clean_item)
                try:
                    num = parse_customer_id(clean_item)
                    normalized_allowed.add(str(num))
                    normalized_allowed.add(f"CUST-{num:06d}")
                except Exception:
                    pass

            target_str = str(resource_id).strip()
            target_matches = target_str in normalized_allowed
            if not target_matches:
                try:
                    num_target = parse_customer_id(target_str)
                    target_matches = (
                        str(num_target) in normalized_allowed
                        or f"CUST-{num_target:06d}" in normalized_allowed
                    )
                except Exception:
                    target_matches = False

            if not target_matches:
                rid = get_request_id()
                log_security_event(
                    event_type=IDOR_ATTEMPT_BLOCKED,
                    action=f"{resource_type}:{operation}",
                    decision="BLOCK",
                    risk_classification="CRITICAL",
                    user_id=user.id,
                    success=False,
                    error_code="IDOR_RESOURCE_ACCESS_DENIED",
                    details={
                        "attempted_resource_id": target_str,
                        "allowed_scope": list(user.allowed_customer_ids),
                    },
                    request_id=rid,
                )
                raise AuthorizationDeniedError(
                    f"Access Denied: Resource '{resource_id}' is outside your authorized scope (IDOR Defense)."
                )


def check_resource_access(
    user: AuthUser,
    resource_type: str,
    resource_id: Optional[str],
    operation: str = "read",
    resource_tenant: Optional[str] = None,
) -> None:
    """Convenience functional wrapper for ABAC resource authorization."""
    ABACEvaluator.authorize_resource_access(
        user=user,
        resource_type=resource_type,
        resource_id=resource_id,
        operation=operation,
        resource_tenant=resource_tenant,
    )
