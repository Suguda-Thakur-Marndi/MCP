-- =====================================================================
-- Migration 006: Production Authentication, Users & Session Management
-- Tables: users (extended), sessions (new)
-- Adds Google Subject ID, Account Status, ABAC Attributes, and Server-Side Sessions
-- =====================================================================

-- 1. Extend users table with enterprise identity and ABAC attributes
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS google_subject_id VARCHAR(64) UNIQUE,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS department VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS organization VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS allowed_customer_ids JSONB NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add check constraint for status if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_users_status'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT check_users_status CHECK (status IN ('ACTIVE', 'DISABLED'));
    END IF;
END $$;

-- Align status with existing is_active column
UPDATE users SET status = CASE WHEN is_active = FALSE THEN 'DISABLED' ELSE 'ACTIVE' END WHERE status IS NULL OR status = 'ACTIVE';

-- Set default role for new insertions to VIEWER (Least Privilege)
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'VIEWER';

-- Create indexes for user lookups
CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_subject_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 2. Create sessions table for stateful token revocation and session tracking
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMPTZ NULL,
    user_agent TEXT NULL,
    ip_address VARCHAR(45) NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(session_id, is_revoked, expires_at);

-- 3. Update existing seed users with organization and google_subject_id mappings
UPDATE users SET google_subject_id = 'goog-admin-001', organization = 'SentinelCorp', department = 'Security Operations' WHERE id = 'user-admin-001';
UPDATE users SET google_subject_id = 'goog-approver-001', organization = 'SentinelCorp', department = 'Compliance' WHERE id = 'user-approver-001';
UPDATE users SET google_subject_id = 'goog-analyst-001', organization = 'SentinelCorp', department = 'Security Operations' WHERE id = 'user-analyst-001';
UPDATE users SET google_subject_id = 'goog-operator-001', organization = 'SentinelCorp', department = 'Operations' WHERE id = 'user-operator-001';
UPDATE users SET google_subject_id = 'goog-viewer-001', organization = 'SentinelCorp', department = 'Auditing' WHERE id = 'user-viewer-001';

-- 4. Role grants if roles exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_readonly') THEN
        GRANT SELECT ON users, sessions TO mcp_readonly;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_writer') THEN
        GRANT SELECT, INSERT, UPDATE ON users, sessions TO mcp_writer;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_destructive') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON users, sessions TO mcp_destructive;
    END IF;
END $$;
