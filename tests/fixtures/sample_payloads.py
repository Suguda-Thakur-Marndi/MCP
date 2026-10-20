"""
Shared sample payloads and mock entities for testing across unit, integration, and security test suites.
"""

from typing import Any

MOCK_ADMIN_USER: dict[str, Any] = {
    "id": "usr-admin-test-fixture",
    "email": "security-admin@sentinel.test",
    "name": "Security Administrator",
    "role": "admin",
    "status": "active",
    "is_active": True,
}

MOCK_CUSTOMER_PAYLOAD: dict[str, Any] = {
    "id": 101,
    "customer_code": "CUST-000101",
    "name": "Acme Global Dynamics",
    "email": "procurement@acme.example.com",
    "country": "US",
    "status": "active",
    "tier": "enterprise",
}

MOCK_ORDER_PAYLOAD: dict[str, Any] = {
    "id": 501,
    "order_number": "ORD-000501",
    "customer_id": 101,
    "status": "completed",
    "total_amount": 14999.50,
    "currency": "USD",
}

MOCK_CUSTOMER_FILTER: dict[str, Any] = {
    "status": "active",
    "country": "US",
    "tier": "enterprise",
}

MOCK_POLICY_RULE: dict[str, Any] = {
    "rule_id": "rule-block-unauthorized-destructive",
    "name": "Block Destructive Operations Without Approval",
    "tool_pattern": "*(delete|purge|archive)*",
    "action": "REQUIRE_APPROVAL",
    "enabled": True,
}
