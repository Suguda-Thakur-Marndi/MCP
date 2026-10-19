-- =====================================================================
-- Migration 005: Approval Lifecycle State Machine & Execution Tracking
-- Extends approval_requests with detailed audit timestamps, token hashes,
-- correlation tracking, and execution failure diagnostics.
-- =====================================================================

ALTER TABLE approval_requests
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS denied_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS execution_started_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS failure_reason TEXT NULL,
    ADD COLUMN IF NOT EXISTS approval_token_hash VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS execution_id VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64) NULL;

-- Create indexes for correlation, token lookups, and expiration queries
CREATE INDEX IF NOT EXISTS idx_approval_requests_correlation_id ON approval_requests(correlation_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_execution_id ON approval_requests(execution_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_token_hash ON approval_requests(approval_token_hash);
CREATE INDEX IF NOT EXISTS idx_approval_requests_expires_at ON approval_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status_expires ON approval_requests(status, expires_at);
