"""
Authentication and Authorization Models for MCP-Sentinel.
Adheres to:
- Real authenticated user identity.
- Explicit role-based permissions (ADMIN, APPROVER, SECURITY_ANALYST, OPERATOR, VIEWER).
- Attribute-based access control metadata (status, department, organization, allowed_customer_ids).
- Stateful session tracking and OAuth state protection.
"""

from datetime import datetime
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class UserRoleEnum(str, Enum):
    """Authoritative enterprise security roles."""

    ADMIN = "ADMIN"
    SECURITY_ANALYST = "SECURITY_ANALYST"
    APPROVER = "APPROVER"
    OPERATOR = "OPERATOR"
    VIEWER = "VIEWER"


class UserStatusEnum(str, Enum):
    """Authoritative user account status."""

    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"


class AuthUser(BaseModel):
    """
    Authenticated user profile and security principal.
    Represents the authoritative human identity across all system layers.
    """

    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., description="Unique internal user identifier.")
    google_subject_id: Optional[str] = Field(
        default=None, description="Permanent Google provider subject identifier."
    )
    email: str = Field(..., description="User enterprise email address.")
    name: str = Field(default="Sentinel User", description="Full display name.")
    role: UserRoleEnum = Field(
        default=UserRoleEnum.VIEWER,
        description="Assigned RBAC role. Defaults to least privilege VIEWER.",
    )
    status: UserStatusEnum = Field(
        default=UserStatusEnum.ACTIVE, description="Account status: ACTIVE or DISABLED."
    )
    is_active: bool = Field(default=True, description="Account active status boolean flag.")
    department: Optional[str] = Field(default=None, description="Enterprise department.")
    organization: Optional[str] = Field(
        default=None, description="Enterprise organization or tenant."
    )
    allowed_customer_ids: Optional[list[str]] = Field(
        default=None, description="Allowlist of accessible customer IDs for ABAC scoping."
    )

    @property
    def is_active_account(self) -> bool:
        """Returns True only if both is_active is True and status is ACTIVE."""
        return self.is_active and self.status == UserStatusEnum.ACTIVE


class TokenPayload(BaseModel):
    """Payload stored in signed Sentinel JWT session tokens."""

    sub: str
    email: str
    name: str
    role: UserRoleEnum
    session_id: Optional[str] = None
    exp: int
    iat: int
    iss: str = "mcp-sentinel-auth"


class SessionRecord(BaseModel):
    """Database-backed session record for revocation tracking."""

    session_id: str
    user_id: str
    created_at: datetime
    expires_at: datetime
    is_revoked: bool = False
    revoked_at: Optional[datetime] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None


class OAuthStatePayload(BaseModel):
    """Cryptographically signed payload embedded in OAuth state parameter."""

    nonce: str
    redirect_uri: str
    timestamp: int
    next_path: Optional[str] = None


class LoginRequest(BaseModel):
    """Google OAuth / OIDC exchange request."""

    id_token: str = Field(..., description="Google ID Token obtained from Google Sign-In.")
    provider: Literal["google", "mock"] = Field(
        default="google",
        description="OAuth identity provider. 'mock' permitted in test/development only.",
    )


class LoginResponse(BaseModel):
    """Authentication response returning signed JWT access token and user profile."""

    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: AuthUser
    session_id: Optional[str] = None


class CurrentUserResponse(BaseModel):
    """Safe identity profile returned by GET /api/auth/me. Never exposes internal secrets."""

    id: str
    email: str
    name: str
    role: UserRoleEnum
    status: UserStatusEnum
    is_active: bool
    department: Optional[str] = None
    organization: Optional[str] = None
    permissions: list[str] = Field(default_factory=list)
