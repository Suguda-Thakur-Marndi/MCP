"""
Role-Based and Attribute-Based Access Control (RBAC/ABAC) for MCP-Sentinel.
Adheres to:
- Explicit permission mapping per role.
- Separation of operational, auditing, and approval privileges.
- Least-privilege default (Fail Closed).
- Disallows user-level self-escalation or magic bypasses.
"""

from mcp_sentinel.security.auth.models import AuthUser, UserRoleEnum, UserStatusEnum
from mcp_sentinel.security.exceptions import AuthorizationDeniedError

# Explicit Permission Definitions
PERM_CHAT_AGENT = "chat:agent"
PERM_APPROVE_DESTRUCTIVE = "approvals:approve_destructive"
PERM_CANCEL_APPROVAL = "approvals:cancel"
PERM_VIEW_APPROVALS = "approvals:view"
PERM_VIEW_AUDIT = "audit:view"
PERM_RUN_SECURITY_EVAL = "security:run_eval"
PERM_VIEW_POLICIES = "policies:view"
PERM_MANAGE_POLICIES = "policies:manage"
PERM_VIEW_DASHBOARD = "dashboard:view"

# Granular Resource Permissions
PERM_CUSTOMER_READ = "customer:read"
PERM_CUSTOMER_WRITE = "customer:write"
PERM_CUSTOMER_DELETE = "customer:delete"
PERM_CUSTOMER_PURGE = "customer:purge"
PERM_ORDER_READ = "order:read"
PERM_ADMIN_MANAGE_USERS = "admin:manage_users"

ROLE_PERMISSIONS: dict[UserRoleEnum, set[str]] = {
    UserRoleEnum.ADMIN: {
        PERM_CHAT_AGENT,
        PERM_APPROVE_DESTRUCTIVE,
        PERM_CANCEL_APPROVAL,
        PERM_VIEW_APPROVALS,
        PERM_VIEW_AUDIT,
        PERM_RUN_SECURITY_EVAL,
        PERM_VIEW_POLICIES,
        PERM_MANAGE_POLICIES,
        PERM_VIEW_DASHBOARD,
        PERM_CUSTOMER_READ,
        PERM_CUSTOMER_WRITE,
        PERM_CUSTOMER_DELETE,
        PERM_CUSTOMER_PURGE,
        PERM_ORDER_READ,
        PERM_ADMIN_MANAGE_USERS,
    },
    UserRoleEnum.APPROVER: {
        PERM_CHAT_AGENT,
        PERM_APPROVE_DESTRUCTIVE,
        PERM_CANCEL_APPROVAL,
        PERM_VIEW_APPROVALS,
        PERM_VIEW_AUDIT,
        PERM_VIEW_POLICIES,
        PERM_VIEW_DASHBOARD,
        PERM_CUSTOMER_READ,
        PERM_ORDER_READ,
    },
    UserRoleEnum.SECURITY_ANALYST: {
        PERM_CHAT_AGENT,
        PERM_VIEW_APPROVALS,
        PERM_VIEW_AUDIT,
        PERM_RUN_SECURITY_EVAL,
        PERM_VIEW_POLICIES,
        PERM_MANAGE_POLICIES,
        PERM_VIEW_DASHBOARD,
        PERM_CUSTOMER_READ,
        PERM_ORDER_READ,
    },
    UserRoleEnum.OPERATOR: {
        PERM_CHAT_AGENT,
        PERM_VIEW_APPROVALS,
        PERM_VIEW_POLICIES,
        PERM_VIEW_DASHBOARD,
        PERM_CUSTOMER_READ,
        PERM_CUSTOMER_WRITE,
        PERM_ORDER_READ,
    },
    UserRoleEnum.VIEWER: {
        PERM_VIEW_AUDIT,
        PERM_VIEW_APPROVALS,
        PERM_VIEW_POLICIES,
        PERM_VIEW_DASHBOARD,
        PERM_CUSTOMER_READ,
        PERM_ORDER_READ,
    },
}


def get_user_permissions(user: AuthUser) -> list[str]:
    """Returns sorted list of granted permissions for an authenticated active user."""
    if not user or not user.is_active or user.status == UserStatusEnum.DISABLED:
        return []
    return sorted(list(ROLE_PERMISSIONS.get(user.role, set())))


def has_permission(user: AuthUser, permission: str) -> bool:
    """Checks whether the user role possesses the requested permission."""
    if not user or not user.is_active or user.status == UserStatusEnum.DISABLED:
        return False
    perms = ROLE_PERMISSIONS.get(user.role, set())
    return permission in perms


def check_permission(user: AuthUser, permission: str) -> None:
    """Raises AuthorizationDeniedError if user does not have permission."""
    if not has_permission(user, permission):
        role_desc = user.role.value if (user and hasattr(user, "role")) else "ANONYMOUS"
        raise AuthorizationDeniedError(
            f"Access Denied: User role '{role_desc}' lacks permission '{permission}'."
        )


def can_approve_destructive(user: AuthUser) -> bool:
    """Only active ADMIN and APPROVER may authorize destructive operations."""
    return has_permission(user, PERM_APPROVE_DESTRUCTIVE)


def can_run_agent(user: AuthUser) -> bool:
    return has_permission(user, PERM_CHAT_AGENT)


def can_view_audit_logs(user: AuthUser) -> bool:
    return has_permission(user, PERM_VIEW_AUDIT)


def can_run_security_eval(user: AuthUser) -> bool:
    return has_permission(user, PERM_RUN_SECURITY_EVAL)
