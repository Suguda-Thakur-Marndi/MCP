-- Migration 010: Approval HMAC Signatures
-- Adds cryptographic HMAC signature column to approval_requests and gating_approval_tickets
-- to protect tickets and decisions against unauthorized tampering.

ALTER TABLE approval_requests
    ADD COLUMN IF NOT EXISTS signature VARCHAR(64) NULL;

ALTER TABLE gating_approval_tickets
    ADD COLUMN IF NOT EXISTS signature VARCHAR(64) NULL;

CREATE INDEX IF NOT EXISTS idx_approval_requests_signature ON approval_requests(signature);
