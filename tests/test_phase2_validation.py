"""
Phase 2 Input Validation Tests:
Verifies strict schema boundaries across all Phase 2 tools:
- Extra fields forbidden (no arbitrary keys)
- Type coercion & bounds checking
- Format and length limits
"""

import pytest
from pydantic import ValidationError

from mcp_sentinel.schemas.audit import AppendCustomerAuditNoteInput
from mcp_sentinel.schemas.common import parse_customer_id
from mcp_sentinel.schemas.customer import (
    DeleteCustomerInput,
    GetCustomerInput,
    PurgeInactiveCustomerDataInput,
    UpdateCustomerInput,
)
from mcp_sentinel.schemas.order import (
    GetCustomerOrdersInput,
    GetOrderInput,
)


def test_parse_customer_id_valid():
    assert parse_customer_id(1) == 1
    assert parse_customer_id("1") == 1
    assert parse_customer_id("CUST-000042") == 42
    assert parse_customer_id("cust-000007") == 7


def test_parse_customer_id_invalid():
    with pytest.raises(ValueError):
        parse_customer_id(-5)
    with pytest.raises(ValueError):
        parse_customer_id("0")
    with pytest.raises(ValueError):
        parse_customer_id("CUST-INVALID")
    with pytest.raises(ValueError):
        parse_customer_id("CUST-000001' OR '1'='1")


def test_get_customer_input_validation():
    valid = GetCustomerInput(customer_id="CUST-000010")
    assert valid.customer_id == 10

    with pytest.raises(ValidationError):
        GetCustomerInput(customer_id="MALICIOUS_INPUT")

    with pytest.raises(ValidationError):
        GetCustomerInput.model_validate({"customer_id": 1, "extra_field": "forbidden"})


def test_get_order_input_validation():
    valid = GetOrderInput(order_id="ORD-000001")
    assert valid.order_id == "ORD-000001"

    with pytest.raises(ValidationError):
        GetOrderInput(order_id="")

    with pytest.raises(ValidationError):
        GetOrderInput.model_validate({"order_id": "ORD-1", "unexpected": "field"})


def test_get_customer_orders_bounds():
    # Valid
    valid = GetCustomerOrdersInput(customer_id="CUST-000001", limit=50, offset=0)
    assert valid.limit == 50

    # Negative limit
    with pytest.raises(ValidationError):
        GetCustomerOrdersInput(customer_id=1, limit=-1)

    # Exceeding max limit (100)
    with pytest.raises(ValidationError):
        GetCustomerOrdersInput(customer_id=1, limit=101)

    # Negative offset
    with pytest.raises(ValidationError):
        GetCustomerOrdersInput(customer_id=1, offset=-5)


def test_update_customer_schema_restrictions():
    # Valid
    valid = UpdateCustomerInput(customer_id=1, status="suspended", country="US")
    assert valid.status.value == "suspended"
    assert valid.country == "US"

    # Invalid status
    with pytest.raises(ValidationError):
        UpdateCustomerInput(customer_id=1, status="invalid_status")

    # Invalid country length
    with pytest.raises(ValidationError):
        UpdateCustomerInput(customer_id=1, country="USA")

    # Attempting to update arbitrary columns like name or email or sql
    with pytest.raises(ValidationError):
        UpdateCustomerInput.model_validate({"customer_id": 1, "name": "Hacked Name"})

    with pytest.raises(ValidationError):
        UpdateCustomerInput.model_validate({"customer_id": 1, "sql": "UPDATE customers SET ..."})


def test_delete_customer_input_validation():
    # Valid
    valid = DeleteCustomerInput(
        customer_id=1,
        approval_ticket="TICKET-VALID-1234",
        reason="Customer requested account closure",
    )
    assert valid.customer_id == 1

    # Short reason
    with pytest.raises(ValidationError):
        DeleteCustomerInput(
            customer_id=1,
            approval_ticket="TICKET-VALID-1234",
            reason="abc",
        )

    # Invalid ticket characters
    with pytest.raises(ValidationError):
        DeleteCustomerInput(
            customer_id=1,
            approval_ticket="TICKET; DROP TABLE",
            reason="Valid reason text",
        )


def test_purge_inactive_customer_data_bounds():
    # Valid bulk
    valid = PurgeInactiveCustomerDataInput(
        inactivity_days=180,
        approval_ticket="TICKET-PURGE-180",
    )
    assert valid.inactivity_days == 180

    # Inactivity days < 1
    with pytest.raises(ValidationError):
        PurgeInactiveCustomerDataInput(
            inactivity_days=0,
            approval_ticket="TICKET-PURGE-180",
        )

    # Inactivity days > 3650 (10 years)
    with pytest.raises(ValidationError):
        PurgeInactiveCustomerDataInput(
            inactivity_days=5000,
            approval_ticket="TICKET-PURGE-180",
        )


def test_append_customer_audit_note_validation():
    # Valid
    valid = AppendCustomerAuditNoteInput(
        customer_id="CUST-000001",
        note="Normal administrative note.",
    )
    assert valid.customer_id == 1
    assert valid.note == "Normal administrative note."

    # Empty note
    with pytest.raises(ValidationError):
        AppendCustomerAuditNoteInput(
            customer_id=1,
            note="   ",
        )

    # Oversized note (> 2000 chars)
    with pytest.raises(ValidationError):
        AppendCustomerAuditNoteInput(
            customer_id=1,
            note="A" * 2005,
        )
