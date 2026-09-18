"""
Trusted Tool Risk Registry and Scoring Factors for MCP-Sentinel Phase 4.
The server is authoritative: tool profiles and factor weights are strictly controlled server-side.
"""

from typing import Optional

from mcp_sentinel.security.risk.models import DataSensitivityEnum, ToolRiskProfile

# Scoring weights
DESTRUCTIVE_FACTOR_WEIGHT: int = 25
EXTERNAL_SIDE_EFFECT_WEIGHT: int = 10

DATA_SENSITIVITY_WEIGHTS: dict[DataSensitivityEnum, int] = {
    DataSensitivityEnum.PUBLIC: 0,
    DataSensitivityEnum.INTERNAL: 5,
    DataSensitivityEnum.CONFIDENTIAL: 5,
    DataSensitivityEnum.SENSITIVE: 10,
    DataSensitivityEnum.RESTRICTED: 25,
}

ENVIRONMENT_WEIGHTS: dict[str, int] = {
    "development": 0,
    "test": 0,
    "staging": 10,
    "production": 20,
}

# Trusted server-side Tool Risk Registry
TRUSTED_TOOL_REGISTRY: dict[str, ToolRiskProfile] = {
    "query_customer_records": ToolRiskProfile(
        tool_name="query_customer_records",
        base_risk=10,
        read_only=True,
        destructive=False,
        external_side_effect=False,
        data_sensitivity=DataSensitivityEnum.CONFIDENTIAL,
        operation_type="read",
        resource_type="customer",
        max_allowed_scope=100,
    ),
    "get_customer": ToolRiskProfile(
        tool_name="get_customer",
        base_risk=10,
        read_only=True,
        destructive=False,
        external_side_effect=False,
        data_sensitivity=DataSensitivityEnum.CONFIDENTIAL,
        operation_type="read",
        resource_type="customer",
        max_allowed_scope=1,
    ),
    "get_customer_orders": ToolRiskProfile(
        tool_name="get_customer_orders",
        base_risk=15,
        read_only=True,
        destructive=False,
        external_side_effect=False,
        data_sensitivity=DataSensitivityEnum.SENSITIVE,
        operation_type="read",
        resource_type="order",
        max_allowed_scope=100,
    ),
    "get_order": ToolRiskProfile(
        tool_name="get_order",
        base_risk=15,
        read_only=True,
        destructive=False,
        external_side_effect=False,
        data_sensitivity=DataSensitivityEnum.SENSITIVE,
        operation_type="read",
        resource_type="order",
        max_allowed_scope=1,
    ),
    "append_customer_audit_note": ToolRiskProfile(
        tool_name="append_customer_audit_note",
        base_risk=20,
        read_only=False,
        destructive=False,
        external_side_effect=True,
        data_sensitivity=DataSensitivityEnum.CONFIDENTIAL,
        operation_type="create",
        resource_type="audit_note",
        max_allowed_scope=1,
    ),
    "update_customer": ToolRiskProfile(
        tool_name="update_customer",
        base_risk=25,
        read_only=False,
        destructive=False,
        external_side_effect=True,
        data_sensitivity=DataSensitivityEnum.CONFIDENTIAL,
        operation_type="update",
        resource_type="customer",
        max_allowed_scope=1,
    ),
    "delete_customer": ToolRiskProfile(
        tool_name="delete_customer",
        base_risk=30,
        read_only=False,
        destructive=True,
        external_side_effect=True,
        data_sensitivity=DataSensitivityEnum.CONFIDENTIAL,
        operation_type="delete",
        resource_type="customer",
        max_allowed_scope=1,
    ),
    "purge_inactive_customer_data": ToolRiskProfile(
        tool_name="purge_inactive_customer_data",
        base_risk=45,
        read_only=False,
        destructive=True,
        external_side_effect=True,
        data_sensitivity=DataSensitivityEnum.CONFIDENTIAL,
        operation_type="purge",
        resource_type="customer",
        max_allowed_scope=10000,
    ),
}


def get_tool_profile(tool_name: str) -> Optional[ToolRiskProfile]:
    """
    Retrieves the server-authoritative tool profile from the trusted registry.
    Returns None for unknown tools.
    """
    return TRUSTED_TOOL_REGISTRY.get(tool_name)


def calculate_scale_factor(
    record_count: int,
    bulk_threshold: int = 100,
    critical_threshold: int = 1000,
) -> int:
    """
    Determines scale factor based on the number of records affected.
    Scope escalation is deterministic:
    - 0 or 1 record: 0
    - 2 to bulk_threshold - 1: +5
    - bulk_threshold to critical_threshold - 1: +15
    - >= critical_threshold: +30
    """
    if record_count <= 1:
        return 0
    if record_count < bulk_threshold:
        return 5
    if record_count < critical_threshold:
        return 15
    return 30
