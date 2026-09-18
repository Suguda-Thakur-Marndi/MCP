"""
Phase 6 Tests: Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC).
Tests:
- Granular role permission mappings and least-privilege defaults
- Account status enforcement (ACTIVE vs DISABLED)
- Resource-level authorization & IDOR prevention (allowed_customer_ids)
- Tenant/Organization boundary isolation
- CustomerService and OrderService ABAC integration
"""

import pytest

from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.audit_repository import AuditRepository
from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.repositories.order_repository import OrderRepository
from mcp_sentinel.security.auth.abac import ABACEvaluator
from mcp_sentinel.security.auth.context import (
    clear_current_user_context,
    set_current_user_context,
)
from mcp_sentinel.security.auth.models import AuthUser, UserRoleEnum, UserStatusEnum
from mcp_sentinel.security.auth.rbac import (
    PERM_ADMIN_MANAGE_USERS,
    PERM_APPROVE_DESTRUCTIVE,
    PERM_CHAT_AGENT,
    PERM_CUSTOMER_DELETE,
    PERM_CUSTOMER_PURGE,
    PERM_CUSTOMER_READ,
    PERM_CUSTOMER_WRITE,
    PERM_ORDER_READ,
    PERM_RUN_SECURITY_EVAL,
    PERM_VIEW_AUDIT,
    has_permission,
)
from mcp_sentinel.security.exceptions import AuthorizationDeniedError
from mcp_sentinel.services.customer_service import CustomerService
from mcp_sentinel.services.order_service import OrderService


def test_rbac_least_privilege_permissions():
    """Verify explicit permissions per role adhere strictly to least privilege."""
    viewer = AuthUser(id="u-view", email="v@sentinel.test", role=UserRoleEnum.VIEWER)
    operator = AuthUser(id="u-op", email="o@sentinel.test", role=UserRoleEnum.OPERATOR)
    sec_analyst = AuthUser(id="u-sec", email="s@sentinel.test", role=UserRoleEnum.SECURITY_ANALYST)
    approver = AuthUser(id="u-app", email="a@sentinel.test", role=UserRoleEnum.APPROVER)
    admin = AuthUser(id="u-adm", email="admin@sentinel.test", role=UserRoleEnum.ADMIN)

    # VIEWER: Can read, cannot mutate or approve
    assert has_permission(viewer, PERM_CUSTOMER_READ) is True
    assert has_permission(viewer, PERM_ORDER_READ) is True
    assert has_permission(viewer, PERM_CUSTOMER_WRITE) is False
    assert has_permission(viewer, PERM_CUSTOMER_DELETE) is False
    assert has_permission(viewer, PERM_APPROVE_DESTRUCTIVE) is False
    assert has_permission(viewer, PERM_ADMIN_MANAGE_USERS) is False

    # OPERATOR: Can read, write, and run agent, cannot approve or delete
    assert has_permission(operator, PERM_CUSTOMER_READ) is True
    assert has_permission(operator, PERM_CUSTOMER_WRITE) is True
    assert has_permission(operator, PERM_CHAT_AGENT) is True
    assert has_permission(operator, PERM_CUSTOMER_DELETE) is False
    assert has_permission(operator, PERM_APPROVE_DESTRUCTIVE) is False

    # SECURITY ANALYST: Security and audit visibility, cannot approve or mutate customers
    assert has_permission(sec_analyst, PERM_VIEW_AUDIT) is True
    assert has_permission(sec_analyst, PERM_RUN_SECURITY_EVAL) is True
    assert has_permission(sec_analyst, PERM_CUSTOMER_WRITE) is False
    assert has_permission(sec_analyst, PERM_APPROVE_DESTRUCTIVE) is False

    # APPROVER: Can view and decide approvals, cannot manage administrative users
    assert has_permission(approver, PERM_APPROVE_DESTRUCTIVE) is True
    assert has_permission(approver, PERM_ADMIN_MANAGE_USERS) is False

    # ADMIN: Full operational and governance permissions
    assert has_permission(admin, PERM_ADMIN_MANAGE_USERS) is True
    assert has_permission(admin, PERM_APPROVE_DESTRUCTIVE) is True
    assert has_permission(admin, PERM_CUSTOMER_PURGE) is True


def test_abac_account_status_blocking():
    """Disabled accounts must be rejected by the ABAC evaluator fail-closed."""
    active_user = AuthUser(
        id="u-active",
        email="active@sentinel.test",
        role=UserRoleEnum.OPERATOR,
        status=UserStatusEnum.ACTIVE,
        is_active=True,
    )
    disabled_status_user = AuthUser(
        id="u-disabled-1",
        email="disabled1@sentinel.test",
        role=UserRoleEnum.ADMIN,
        status=UserStatusEnum.DISABLED,
        is_active=True,
    )
    inactive_flag_user = AuthUser(
        id="u-disabled-2",
        email="disabled2@sentinel.test",
        role=UserRoleEnum.APPROVER,
        status=UserStatusEnum.ACTIVE,
        is_active=False,
    )

    # Active user passes
    ABACEvaluator.check_account_status(active_user)

    # Disabled account status raises AuthorizationDeniedError
    with pytest.raises(AuthorizationDeniedError) as exc_info:
        ABACEvaluator.check_account_status(disabled_status_user)
    assert "disabled" in str(exc_info.value).lower()

    # Inactive flag raises AuthorizationDeniedError
    with pytest.raises(AuthorizationDeniedError) as exc_info:
        ABACEvaluator.check_account_status(inactive_flag_user)
    assert "disabled" in str(exc_info.value).lower() or "inactive" in str(exc_info.value).lower()


def test_abac_resource_idor_scoped_customers():
    """ABAC evaluates allowed_customer_ids and blocks IDOR resource access."""
    scoped_user = AuthUser(
        id="u-scoped",
        email="scoped@sentinel.test",
        role=UserRoleEnum.OPERATOR,
        status=UserStatusEnum.ACTIVE,
        allowed_customer_ids=["CUST-000001", "CUST-000002"],
    )

    # Authorized customer access passes
    ABACEvaluator.authorize_resource_access(
        scoped_user, resource_type="customer", resource_id="CUST-000001"
    )
    ABACEvaluator.authorize_resource_access(
        scoped_user, resource_type="customer", resource_id="CUST-000002"
    )

    # Unauthorized customer access is blocked (IDOR prevention)
    with pytest.raises(AuthorizationDeniedError) as exc_info:
        ABACEvaluator.authorize_resource_access(
            scoped_user, resource_type="customer", resource_id="CUST-000003"
        )
    assert "outside your authorized scope" in str(exc_info.value)
    assert "CUST-000003" in str(exc_info.value)

    # Unscoped user (allowed_customer_ids is None) can access any customer
    unscoped_user = AuthUser(
        id="u-unscoped",
        email="unscoped@sentinel.test",
        role=UserRoleEnum.OPERATOR,
        allowed_customer_ids=None,
    )
    ABACEvaluator.authorize_resource_access(
        unscoped_user, resource_type="customer", resource_id="CUST-000999"
    )


def test_abac_organization_tenant_isolation():
    """ABAC enforces organization boundaries to prevent cross-tenant data leakage."""
    user_alpha = AuthUser(
        id="u-alpha",
        email="alpha@sentinel.test",
        role=UserRoleEnum.OPERATOR,
        organization="Corp-Alpha",
    )

    # Same organization passes
    ABACEvaluator.authorize_resource_access(
        user_alpha,
        resource_type="customer",
        resource_id="CUST-000001",
        resource_tenant="Corp-Alpha",
    )

    # Cross organization access is blocked
    with pytest.raises(AuthorizationDeniedError) as exc_info:
        ABACEvaluator.authorize_resource_access(
            user_alpha,
            resource_type="customer",
            resource_id="CUST-000001",
            resource_tenant="Corp-Beta",
        )
    assert "Cross-organization" in str(exc_info.value)


@pytest.mark.asyncio
async def test_service_layer_abac_enforcement(db_pool):
    """CustomerService and OrderService block unauthorized customer ID access via context."""
    cust_repo = CustomerRepository(pool=db_pool)
    appr_repo = ApprovalRepository(pool=db_pool)
    aud_repo = AuditRepository(pool=db_pool)
    ord_repo = OrderRepository(pool=db_pool)

    cust_svc = CustomerService(
        customer_repo=cust_repo, approval_repo=appr_repo, audit_repo=aud_repo
    )
    ord_svc = OrderService(order_repo=ord_repo, audit_repo=aud_repo)

    # User restricted strictly to CUST-000001
    restricted_user = AuthUser(
        id="u-restricted-01",
        email="restricted@sentinel.test",
        role=UserRoleEnum.OPERATOR,
        status=UserStatusEnum.ACTIVE,
        allowed_customer_ids=["CUST-000001"],
    )

    try:
        set_current_user_context(restricted_user)

        # 1. Allowed customer read succeeds
        res = await cust_svc.get_customer("CUST-000001")
        assert res["status"] == "success"
        assert res["customer"]["customer_code"] == "CUST-000001"

        # 2. Unauthorized customer read raises AuthorizationDeniedError (IDOR blocked)
        with pytest.raises(AuthorizationDeniedError) as exc_info:
            await cust_svc.get_customer("CUST-000002")
        assert "outside your authorized scope" in str(exc_info.value)

        # 3. Unauthorized customer order lookup is blocked
        with pytest.raises(AuthorizationDeniedError) as exc_info:
            await ord_svc.get_customer_orders("CUST-000002")
        assert "outside your authorized scope" in str(exc_info.value)

        # 4. Unauthorized customer update is blocked before DB mutation
        with pytest.raises(AuthorizationDeniedError) as exc_info:
            await cust_svc.update_customer("CUST-000002", {"contact_name": "Attacker"})
        assert "outside your authorized scope" in str(exc_info.value)

    finally:
        clear_current_user_context()
