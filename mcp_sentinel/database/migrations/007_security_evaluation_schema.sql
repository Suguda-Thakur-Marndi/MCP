-- =====================================================================
-- Migration 007: Automated Security Evaluation Schema
-- Tables: security_eval_runs, security_eval_results
-- Provides immutable, reproducible persistence for adversarial and benchmark runs
-- =====================================================================

-- 1. Create security_eval_runs table
CREATE TABLE IF NOT EXISTS security_eval_runs (
    run_id VARCHAR(64) PRIMARY KEY,
    dataset_version VARCHAR(32) NOT NULL DEFAULT 'security-eval-v1',
    agent_mode VARCHAR(32) NOT NULL DEFAULT 'secured' CHECK (
        agent_mode IN ('secured', 'baseline', 'benchmark')
    ),
    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING' CHECK (
        status IN ('RUNNING', 'COMPLETED', 'FAILED', 'ABORTED')
    ),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL,
    duration_seconds FLOAT NOT NULL DEFAULT 0.0,
    total_tests INT NOT NULL DEFAULT 0,
    passed INT NOT NULL DEFAULT 0,
    failed INT NOT NULL DEFAULT 0,
    errors INT NOT NULL DEFAULT 0,
    blocked INT NOT NULL DEFAULT 0,
    skipped INT NOT NULL DEFAULT 0,
    attack_attempts INT NOT NULL DEFAULT 0,
    attack_successes INT NOT NULL DEFAULT 0,
    gating_recall FLOAT NOT NULL DEFAULT 0.0,
    attack_success_rate FLOAT NOT NULL DEFAULT 0.0,
    pass_rate FLOAT NOT NULL DEFAULT 0.0,
    environment VARCHAR(32) NOT NULL DEFAULT 'development',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    report_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eval_runs_agent_mode ON security_eval_runs(agent_mode);
CREATE INDEX IF NOT EXISTS idx_eval_runs_dataset_version ON security_eval_runs(dataset_version);
CREATE INDEX IF NOT EXISTS idx_eval_runs_created_at ON security_eval_runs(created_at DESC);

-- 2. Create security_eval_results table
CREATE TABLE IF NOT EXISTS security_eval_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(64) NOT NULL REFERENCES security_eval_runs(run_id) ON DELETE CASCADE,
    test_id VARCHAR(64) NOT NULL,
    category VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    severity VARCHAR(32) NOT NULL DEFAULT 'MEDIUM' CHECK (
        severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFRASTRUCTURE')
    ),
    status VARCHAR(20) NOT NULL DEFAULT 'PASS' CHECK (
        status IN ('PASS', 'FAIL', 'ERROR', 'BLOCKED', 'SKIPPED')
    ),
    attack_success BOOLEAN NOT NULL DEFAULT FALSE,
    side_effect_detected BOOLEAN NOT NULL DEFAULT FALSE,
    expected_decision VARCHAR(64) NOT NULL,
    actual_decision VARCHAR(64) NOT NULL,
    approval_required BOOLEAN NOT NULL DEFAULT FALSE,
    approval_used BOOLEAN NOT NULL DEFAULT FALSE,
    policy_decision VARCHAR(64) NULL,
    risk_score INT NULL,
    duration_ms FLOAT NOT NULL DEFAULT 0.0,
    error_type VARCHAR(128) NULL,
    safe_message TEXT NULL,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eval_results_run_id ON security_eval_results(run_id);
CREATE INDEX IF NOT EXISTS idx_eval_results_test_id ON security_eval_results(test_id);
CREATE INDEX IF NOT EXISTS idx_eval_results_category ON security_eval_results(category);
CREATE INDEX IF NOT EXISTS idx_eval_results_status ON security_eval_results(status);

-- 3. Role grants if roles exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_readonly') THEN
        GRANT SELECT ON security_eval_runs, security_eval_results TO mcp_readonly;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_writer') THEN
        GRANT SELECT, INSERT, UPDATE ON security_eval_runs, security_eval_results TO mcp_writer;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_destructive') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON security_eval_runs, security_eval_results TO mcp_destructive;
    END IF;
END $$;
