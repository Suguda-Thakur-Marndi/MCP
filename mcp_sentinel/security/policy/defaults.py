"""
Default Policy Definition for MCP-Sentinel Phase 4.
Provides versioned, centralized default rules.
"""

from mcp_sentinel.security.policy.models import PolicyDefinition
from mcp_sentinel.security.policy.rules import (
    RULE_001,
    RULE_002,
    RULE_003,
    RULE_004,
    RULE_005,
    RULE_006,
    RULE_007,
    RULE_008,
    RULE_009,
    RULE_010,
)

DEFAULT_POLICY_ID = "sentinel-core-policy"
DEFAULT_POLICY_VERSION = "1.0.0"

DEFAULT_POLICY = PolicyDefinition(
    policy_id=DEFAULT_POLICY_ID,
    policy_version=DEFAULT_POLICY_VERSION,
    description=(
        "Core MCP-Sentinel security policy. Enforces strict fail-closed gating, "
        "destructive action approval, production protection, and deterministic precedence."
    ),
    rules=[
        RULE_006,  # Missing context -> DENY (1100)
        RULE_003,  # Unauthorized -> DENY (1000)
        RULE_004,  # Restricted data unauthorized -> DENY (950)
        RULE_007,  # Unknown high-risk tool -> DENY (900)
        RULE_005,  # Bulk critical scope -> REQUIRE_APPROVAL (850)
        RULE_001,  # Destructive -> REQUIRE_APPROVAL (800)
        RULE_002,  # Prod critical -> REQUIRE_APPROVAL (750)
        RULE_010,  # Verified server approval -> ALLOW (300)
        RULE_008,  # Safe read -> ALLOW (200)
        RULE_009,  # Controlled write dev -> ALLOW (100)
    ],
)


def get_default_policy() -> PolicyDefinition:
    """Returns the immutable active default policy."""
    return DEFAULT_POLICY
