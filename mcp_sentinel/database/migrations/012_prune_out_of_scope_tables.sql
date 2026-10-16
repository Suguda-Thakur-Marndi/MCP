-- =====================================================================
-- Migration 012: Prune Out-of-Scope Tables and Demo Entries
-- Drops out-of-scope tables (agent_runs, tool_executions,
-- security_eval_runs, security_eval_results) and purges demo Canva
-- records while ensuring Notion and PostgreSQL integrations are active.
-- =====================================================================

-- 1. Drop out-of-scope agent and evaluation tables
DROP TABLE IF EXISTS tool_executions CASCADE;
DROP TABLE IF EXISTS agent_runs CASCADE;
DROP TABLE IF EXISTS security_eval_results CASCADE;
DROP TABLE IF EXISTS security_eval_runs CASCADE;

-- 2. Remove demo Canva connector records
DELETE FROM tool_permissions WHERE tool_id LIKE 'canva.%';
DELETE FROM tools WHERE integration_id = 'canva';
DELETE FROM mcp_servers WHERE id = 'srv_canva_remote';
DELETE FROM integrations WHERE id = 'canva';

-- 3. Ensure Notion real data integration is seeded in integrations table
INSERT INTO integrations (
    id, name, category, logo, status, auth_type, connection_endpoint, protocol_type, description
) VALUES (
    'notion', 'Notion', 'Knowledgebase', '📑', 'DISCONNECTED', 'API Key / Token',
    'https://api.notion.com/v1', 'rest_api',
    'Official Notion REST API for workspace page search, database querying, and page archiving.'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    connection_endpoint = EXCLUDED.connection_endpoint,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type;
