-- =====================================================================
-- Migration 008: Multi-Software MCP Security Gateway Architecture
-- Tables: integrations, integration_credentials, mcp_servers,
--         tools, tool_permissions, policies, risk_decisions,
--         agent_runs, tool_executions
-- Zero table drops — 100% backward compatible.
-- =====================================================================

-- 1. INTEGRATIONS TABLE
CREATE TABLE IF NOT EXISTS integrations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    logo VARCHAR(50) NOT NULL DEFAULT '⚡',
    status VARCHAR(30) NOT NULL DEFAULT 'DISCONNECTED' CHECK (
        status IN ('CONNECTED', 'DISCONNECTED', 'DEGRADED', 'ERROR')
    ),
    auth_type VARCHAR(50) NOT NULL,
    connection_endpoint TEXT NOT NULL,
    protocol_type VARCHAR(30) NOT NULL DEFAULT 'remote_mcp' CHECK (
        protocol_type IN ('remote_mcp', 'rest_api', 'local_mcp')
    ),
    description TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);
CREATE INDEX IF NOT EXISTS idx_integrations_protocol ON integrations(protocol_type);

-- 2. INTEGRATION CREDENTIALS TABLE (Encrypted at rest)
CREATE TABLE IF NOT EXISTS integration_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id VARCHAR(64) NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    encrypted_access_token TEXT NULL,
    encrypted_refresh_token TEXT NULL,
    encrypted_api_key TEXT NULL,
    token_type VARCHAR(50) NOT NULL DEFAULT 'Bearer',
    scopes TEXT[] NOT NULL DEFAULT '{}',
    expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_integration_credentials_id UNIQUE (integration_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_credentials_integration ON integration_credentials(integration_id);

-- 3. MCP SERVERS TABLE
CREATE TABLE IF NOT EXISTS mcp_servers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    transport VARCHAR(30) NOT NULL CHECK (transport IN ('stdio', 'sse', 'stream-http')),
    endpoint TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ONLINE' CHECK (
        status IN ('ONLINE', 'CONNECTING', 'DEGRADED', 'OFFLINE')
    ),
    auth_method VARCHAR(50) NOT NULL DEFAULT 'Bearer Token',
    environment VARCHAR(32) NOT NULL DEFAULT 'production',
    latency_ms INT NOT NULL DEFAULT 0,
    server_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    protocol_version VARCHAR(32) NOT NULL DEFAULT '2024-11-05',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_servers_status ON mcp_servers(status);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_transport ON mcp_servers(transport);

-- 4. CENTRAL TOOL REGISTRY TABLE
CREATE TABLE IF NOT EXISTS tools (
    tool_id VARCHAR(128) PRIMARY KEY,
    integration_id VARCHAR(64) NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    risk_level VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (
        risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    ),
    required_permissions TEXT[] NOT NULL DEFAULT '{}',
    approval_required BOOLEAN NOT NULL DEFAULT FALSE,
    policy_id VARCHAR(64) NOT NULL DEFAULT 'sentinel-core-policy',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    state VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (
        state IN ('DISCOVERED', 'AVAILABLE', 'AUTHORIZED', 'APPROVED', 'EXECUTED')
    ),
    last_used TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tools_integration ON tools(integration_id);
CREATE INDEX IF NOT EXISTS idx_tools_risk_level ON tools(risk_level);
CREATE INDEX IF NOT EXISTS idx_tools_enabled ON tools(enabled);
CREATE INDEX IF NOT EXISTS idx_tools_state ON tools(state);

-- 5. TOOL PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS tool_permissions (
    id SERIAL PRIMARY KEY,
    tool_id VARCHAR(128) NOT NULL REFERENCES tools(tool_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (
        role IN ('ADMIN', 'SECURITY_ANALYST', 'APPROVER', 'OPERATOR', 'VIEWER')
    ),
    allowed_resource_patterns TEXT[] NOT NULL DEFAULT '{"*"}',
    is_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_tool_permissions_role UNIQUE (tool_id, role)
);

CREATE INDEX IF NOT EXISTS idx_tool_permissions_tool_role ON tool_permissions(tool_id, role);

-- 6. POLICIES TABLE (Persistent & dynamic policy rules)
CREATE TABLE IF NOT EXISTS policies (
    policy_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    status VARCHAR(20) NOT NULL DEFAULT 'ENFORCING' CHECK (
        status IN ('ENFORCING', 'ACTIVE', 'DRAFT', 'DISABLED')
    ),
    scope VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    risk_threshold INT NOT NULL DEFAULT 75,
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_yaml TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);

-- 7. RISK DECISIONS TABLE
CREATE TABLE IF NOT EXISTS risk_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(64) NOT NULL,
    tool_id VARCHAR(128) NULL REFERENCES tools(tool_id) ON DELETE SET NULL,
    risk_level VARCHAR(20) NOT NULL CHECK (
        risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    ),
    risk_score INT NOT NULL,
    factors JSONB NOT NULL DEFAULT '{}'::jsonb,
    policy_id VARCHAR(64) NULL,
    decision VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_decisions_request ON risk_decisions(request_id);
CREATE INDEX IF NOT EXISTS idx_risk_decisions_tool ON risk_decisions(tool_id);

-- 8. AGENT RUNS TABLE
CREATE TABLE IF NOT EXISTS agent_runs (
    run_id VARCHAR(64) PRIMARY KEY,
    agent_id VARCHAR(64) NOT NULL,
    agent_name VARCHAR(100) NOT NULL,
    model VARCHAR(64) NOT NULL,
    environment VARCHAR(32) NOT NULL DEFAULT 'production',
    application VARCHAR(64) NOT NULL,
    tool_id VARCHAR(128) NULL,
    execution_state VARCHAR(30) NOT NULL DEFAULT 'RUNNING' CHECK (
        execution_state IN ('RUNNING', 'COMPLETED', 'BLOCKED', 'PENDING_APPROVAL', 'FAILED')
    ),
    risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW',
    risk_score INT NOT NULL DEFAULT 0,
    approval_state VARCHAR(30) NOT NULL DEFAULT 'NOT_REQUIRED' CHECK (
        approval_state IN ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED')
    ),
    user_prompt TEXT NULL,
    reasoning TEXT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    duration_ms INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_state ON agent_runs(execution_state);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON agent_runs(created_at);

-- 9. TOOL EXECUTIONS TABLE
CREATE TABLE IF NOT EXISTS tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(64) NOT NULL REFERENCES agent_runs(run_id) ON DELETE CASCADE,
    tool_id VARCHAR(128) NOT NULL REFERENCES tools(tool_id) ON DELETE CASCADE,
    ticket_id VARCHAR(64) NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    parameters_hash VARCHAR(64) NOT NULL,
    result JSONB NULL,
    error_message TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'INITIATED' CHECK (
        status IN ('INITIATED', 'AUTHORIZED', 'APPROVED', 'EXECUTED', 'FAILED', 'BLOCKED')
    ),
    latency_ms INT NOT NULL DEFAULT 0,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_executions_run ON tool_executions(run_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool ON tool_executions(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_status ON tool_executions(status);

-- 10. SEED DEFAULT INTEGRATIONS
INSERT INTO integrations (id, name, category, logo, status, auth_type, connection_endpoint, protocol_type, description)
VALUES
    ('canva', 'Canva', 'Design', '🎨', 'DISCONNECTED', 'OAuth 2.0', 'https://mcp.canva.com/mcp', 'remote_mcp', 'Visual communication platform with official remote MCP integration at mcp.canva.com.'),
    ('github', 'GitHub', 'Source Control', '🐙', 'DISCONNECTED', 'OAuth App / PAT', 'https://api.github.com', 'rest_api', 'Enterprise source code management, pull request gating, and CI/CD control.'),
    ('slack', 'Slack', 'Communication', '💬', 'DISCONNECTED', 'Bot Token OAuth', 'https://slack.com/api', 'rest_api', 'Enterprise messaging and incident war-room orchestration across authorized channels.'),
    ('google_drive', 'Google Drive', 'Cloud Storage', '📁', 'DISCONNECTED', 'OAuth 2.0', 'https://www.googleapis.com/drive/v3', 'rest_api', 'Enterprise file store and collaborative document repository for corporate records.'),
    ('notion', 'Notion', 'Knowledgebase', '📑', 'DISCONNECTED', 'Internal Token', 'https://api.notion.com/v1', 'rest_api', 'Collaborative wiki, product specifications, and documentation databases.'),
    ('jira', 'Jira', 'Project Management', '📐', 'DISCONNECTED', 'OAuth 2.0', 'https://api.atlassian.com/ex/jira', 'rest_api', 'Issue tracking, agile sprints, and deployment verification tickets.'),
    ('custom_mcp', 'Custom MCP PostgreSQL', 'Custom Protocol', '⚡', 'CONNECTED', 'None (Local stdio)', 'subprocess: python -m mcp_sentinel.server.app', 'local_mcp', 'Internal FastMCP PostgreSQL gateway for customer, order, and audit records.')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    connection_endpoint = EXCLUDED.connection_endpoint,
    description = EXCLUDED.description;

-- 11. SEED DEFAULT MCP SERVERS
INSERT INTO mcp_servers (id, name, transport, endpoint, status, auth_method, environment, latency_ms)
VALUES
    ('srv_canva_remote', 'canva-remote-mcp', 'stream-http', 'https://mcp.canva.com/mcp', 'ONLINE', 'OAuth 2.0', 'production', 35),
    ('srv_local_fastmcp', 'fastmcp-postgresql-core', 'stdio', 'subprocess: python -m mcp_sentinel.server.app', 'ONLINE', 'None (Local stdio)', 'production', 1)
ON CONFLICT (id) DO UPDATE SET
    endpoint = EXCLUDED.endpoint,
    transport = EXCLUDED.transport;

-- 12. SEED DEFAULT CORE POLICIES
INSERT INTO policies (policy_id, name, version, status, scope, description, risk_threshold, raw_yaml)
VALUES
    ('pol_prod_data', 'Production Data Protection', '2.4.0', 'ENFORCING', 'Global Database & Cloud Files', 'Blocks irreversible data destruction or sensitive record deletion without two-person cryptographic sign-off.', 80, 'policy_id: pol_prod_data\nprecedence: [DENY, DUAL_APPROVAL, ALLOW]'),
    ('pol_repo_guard', 'Repository Protection Policy', '1.9.2', 'ENFORCING', 'GitHub Enterprise', 'Forbids autonomous repository deletion and branch protection overrides.', 85, 'policy_id: pol_repo_guard\nrules:\n  - match: {tool: github.delete_repository}\n    decision: DENY'),
    ('pol_ext_comm', 'External Communication Policy', '1.3.1', 'ACTIVE', 'Slack & Messaging Gateways', 'Governs public broadcast limits and prevents unauthorized mentions or data leaks.', 60, 'policy_id: pol_ext_comm\nrules:\n  - match: {tool: slack.send_message}\n    decision: EVALUATE_CONTENT'),
    ('pol_financial', 'Financial Action Policy', '3.0.0', 'ENFORCING', 'Billing & Finance Systems', 'Requires explicit finance lead authorization for financial mutations > $500.', 75, 'policy_id: pol_financial\nrules:\n  - match: {action: refund_or_transfer}\n    decision: DUAL_APPROVAL_REQUIRED'),
    ('pol_pii', 'Personal Data Policy', '2.1.0', 'ENFORCING', 'Google Drive & Customer Database', 'Prevents external exfiltration of customer personal data and payment credentials.', 70, 'policy_id: pol_pii\nrules:\n  - match: {contains_pii: true}\n    decision: DENY')
ON CONFLICT (policy_id) DO UPDATE SET
    name = EXCLUDED.name,
    version = EXCLUDED.version,
    description = EXCLUDED.description;
