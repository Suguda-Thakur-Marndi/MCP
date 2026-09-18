"""
Category B: Tool Input Validation Tests.
Verifies strict schema boundaries, forbidden unexpected fields, and numeric/string constraints.
"""

import pytest
from pydantic import ValidationError

from mcp_sentinel.tools.schemas import (
    AppendCustomerAuditNoteInput,
    CustomerFilter,
    CustomerStatusEnum,
    PurgeInactiveCustomerDataInput,
    QueryCustomerRecordsInput,
)


def test_customer_filter_extra_fields_forbidden():
    """Verifies that arbitrary unexpected keys are rejected."""
    with pytest.raises(ValidationError) as exc:
        CustomerFilter.model_validate({"status": CustomerStatusEnum.ACTIVE, "query_filter": "1=1"})
    assert "extra_forbidden" in str(exc.value)


def test_customer_filter_invalid_country_code():
    """Verifies country code must be 2 letters."""
    with pytest.raises(ValidationError):
        CustomerFilter(country="USA")

    with pytest.raises(ValidationError):
        CustomerFilter(country="12")

    # Valid 2 letters automatically uppercased
    f = CustomerFilter(country="in")
    assert f.country == "IN"


def test_customer_filter_invalid_customer_id():
    """Verifies customer_id must be positive integer."""
    with pytest.raises(ValidationError):
        CustomerFilter(customer_id=-5)

    with pytest.raises(ValidationError):
        CustomerFilter(customer_id=0)


def test_query_input_limit_bounds():
    """Verifies limit bounds (1 <= limit <= 100)."""
    with pytest.raises(ValidationError):
        QueryCustomerRecordsInput(limit=0)

    with pytest.raises(ValidationError):
        QueryCustomerRecordsInput(limit=-1)

    with pytest.raises(ValidationError):
        QueryCustomerRecordsInput(limit=101)

    valid = QueryCustomerRecordsInput(limit=100)
    assert valid.limit == 100


def test_query_input_offset_bounds():
    """Verifies offset must be non-negative."""
    with pytest.raises(ValidationError):
        QueryCustomerRecordsInput(offset=-1)

    valid = QueryCustomerRecordsInput(offset=0)
    assert valid.offset == 0


def test_query_input_sort_by_allowlist():
    """Verifies sort_by accepts only allowed column names."""
    with pytest.raises(ValidationError):
        QueryCustomerRecordsInput(sort_by="password")

    with pytest.raises(ValidationError):
        QueryCustomerRecordsInput(sort_by="created_at; DROP TABLE customers;")

    valid = QueryCustomerRecordsInput(sort_by="created_at")
    assert valid.sort_by == "created_at"


def test_audit_note_input_validation():
    """Verifies customer_id, author_id, and note_text constraints."""
    # Invalid customer_id
    with pytest.raises(ValidationError):
        AppendCustomerAuditNoteInput(customer_id=0, author_id="admin", note_text="Valid note")

    # Empty note text
    with pytest.raises(ValidationError):
        AppendCustomerAuditNoteInput(customer_id=1, author_id="admin", note_text="   ")

    # Oversized note text (> 2000 chars)
    oversized = "A" * 2001
    with pytest.raises(ValidationError):
        AppendCustomerAuditNoteInput(customer_id=1, author_id="admin", note_text=oversized)

    # Invalid author format
    with pytest.raises(ValidationError):
        AppendCustomerAuditNoteInput(
            customer_id=1, author_id="admin; DROP TABLE", note_text="Valid"
        )

    # Valid note stripped
    valid = AppendCustomerAuditNoteInput(
        customer_id=1, author_id="sec_ops_01", note_text="  Valid audit note.  "
    )
    assert valid.note_text == "Valid audit note."


def test_purge_input_validation():
    """Verifies purge tool input schema constraints."""
    # Invalid ticket format
    with pytest.raises(ValidationError):
        PurgeInactiveCustomerDataInput(
            customer_id=1,
            approval_ticket="INVALID TICKET WITH SPACES",
            reason="Valid reason here",
        )

    # Short reason
    with pytest.raises(ValidationError):
        PurgeInactiveCustomerDataInput(
            customer_id=1,
            approval_ticket="TICKET-VALID-12345",
            reason="No",
        )

    # Whitespace only reason
    with pytest.raises(ValidationError):
        PurgeInactiveCustomerDataInput(
            customer_id=1,
            approval_ticket="TICKET-VALID-12345",
            reason="      ",
        )

    valid = PurgeInactiveCustomerDataInput(
        customer_id=1,
        approval_ticket="TICKET-VALID-12345",
        reason="Dormant account deletion authorized",
    )
    assert valid.customer_id == 1
