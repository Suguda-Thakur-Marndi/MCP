-- =====================================================================
-- Migration 004: Production Security Approvals & User Identity Schema
-- Tables: approval_requests, users
-- Adds cryptographically bound approval lifecycle and RBAC identity
-- =====================================================================

-- 1. Create approval_requests table
CREATE TABLE IF NOT EXISTS approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id VARCHAR(64) UNIQUE NOT NULL,
    request_id VARCHAR(64) NOT NULL,
    agent_id VARCHAR(64) NOT NULL DEFAULT 'gemini-agent-v1',
    requester_id VARCHAR(64) NOT NULL,
    approver_id VARCHAR(64) NULL,
    tool_name VARCHAR(100) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    action VARCHAR(50) NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    parameter_hash VARCHAR(64) NOT NULL,
    environment VARCHAR(32) NOT NULL DEFAULT 'development',
    policy_id VARCHAR(64) NOT NULL DEFAULT 'sentinel-core-policy',
    policy_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    risk_level VARCHAR(20) NOT NULL DEFAULT 'HIGH',
    risk_score INT NOT NULL DEFAULT 75,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'CANCELLED', 'EXECUTING', 'COMPLETED', 'FAILED')
    ),
    reason TEXT NOT NULL,
    decision_notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    decided_at TIMESTAMPTZ NULL,
    executed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_ticket_id ON approval_requests(ticket_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_target_id ON approval_requests(target_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_request_id ON approval_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_created_at ON approval_requests(created_at);

-- 2. Create users table for RBAC/ABAC authorization
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'OPERATOR' CHECK (
        role IN ('ADMIN', 'SECURITY_ANALYST', 'APPROVER', 'OPERATOR', 'VIEWER')
    ),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 3. Seed default system users for role validation and testing
INSERT INTO users (id, email, name, role, is_active, created_at)
VALUES 
    ('user-admin-001', 'admin@sentinel.test', 'Security Administrator', 'ADMIN', TRUE, NOW()),
    ('user-approver-001', 'approver@sentinel.test', 'Designated Approver', 'APPROVER', TRUE, NOW()),
    ('user-analyst-001', 'analyst@sentinel.test', 'Security Analyst', 'SECURITY_ANALYST', TRUE, NOW()),
    ('user-operator-001', 'operator@sentinel.test', 'Agent Operator', 'OPERATOR', TRUE, NOW()),
    ('user-viewer-001', 'viewer@sentinel.test', 'Auditor Viewer', 'VIEWER', TRUE, NOW())
ON CONFLICT (id) DO UPDATE 
SET 
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- 4. Role grants if roles exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_readonly') THEN
        GRANT SELECT ON approval_requests, users TO mcp_readonly;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_writer') THEN
        GRANT SELECT, INSERT, UPDATE ON approval_requests TO mcp_writer;
        GRANT SELECT ON users TO mcp_writer;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_destructive') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON approval_requests TO mcp_destructive;
        GRANT SELECT ON users TO mcp_destructive;
    END IF;
END $$;
