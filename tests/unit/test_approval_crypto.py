"""
Unit tests for SentinelCore Cryptographic Parameter Hashing and HMAC Signatures.
Verifies:
- Deterministic canonical parameter hashing (key-order invariance)
- Parameter tampering detection (altered arguments produce mismatching hash)
- HMAC signature generation and tamper verification
- Approval status enum coverage
"""

from mcp_sentinel.schemas.approval import (
    ApprovalStatusEnum,
    compute_approval_hmac,
    compute_parameter_hash,
)


def test_parameter_hash_is_deterministic_and_key_order_invariant():
    """Verifies that dictionaries with different key orders produce identical hashes."""
    params_a = {"customer_id": "CUST-100", "reason": "Audit request", "limit": 10}
    params_b = {"limit": 10, "customer_id": "CUST-100", "reason": "Audit request"}

    hash_a = compute_parameter_hash(params_a)
    hash_b = compute_parameter_hash(params_b)

    assert len(hash_a) == 64
    assert hash_a == hash_b


def test_parameter_hash_detects_tampering():
    """Verifies that any parameter modification changes the parameter hash."""
    original = {"customer_id": "CUST-100", "reason": "Legitimate request"}
    tampered = {"customer_id": "CUST-100", "reason": "Tampered request"}

    assert compute_parameter_hash(original) != compute_parameter_hash(tampered)


def test_approval_hmac_signature_verification():
    """Verifies HMAC signature generation and tamper detection."""
    ticket_id = "TICKET-DEL-001"
    action = "delete_customer"
    target_id = "CUST-100"
    p_hash = compute_parameter_hash({"customer_id": target_id})
    approver_id = "user-approver-001"
    secret = "test-secret-at-least-32-chars-long"

    sig = compute_approval_hmac(
        ticket_id=ticket_id,
        action=action,
        target_id=target_id,
        parameter_hash=p_hash,
        approver_id=approver_id,
        secret=secret,
    )
    assert len(sig) == 64

    # Identical inputs produce identical signature
    sig_duplicate = compute_approval_hmac(
        ticket_id=ticket_id,
        action=action,
        target_id=target_id,
        parameter_hash=p_hash,
        approver_id=approver_id,
        secret=secret,
    )
    assert sig == sig_duplicate

    # Tampered target produces different signature
    sig_tampered_target = compute_approval_hmac(
        ticket_id=ticket_id,
        action=action,
        target_id="CUST-999",
        parameter_hash=p_hash,
        approver_id=approver_id,
        secret=secret,
    )
    assert sig != sig_tampered_target


def test_approval_status_lifecycle_states():
    """Verifies that all required approval lifecycle states exist."""
    expected_states = {
        "PENDING",
        "APPROVED",
        "DENIED",
        "EXPIRED",
        "CANCELLED",
        "EXECUTING",
        "COMPLETED",
        "FAILED",
    }
    actual_states = {s.value for s in ApprovalStatusEnum}
    assert expected_states.issubset(actual_states)
