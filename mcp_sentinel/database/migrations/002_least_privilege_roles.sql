-- =====================================================================
-- Migration 002: Least Privilege Roles for MCP-Sentinel
-- Roles:
--   mcp_readonly: SELECT on customers, customer_audit_notes
--   mcp_writer: INSERT on customer_audit_notes, SELECT on customers
--   mcp_destructive: SELECT, UPDATE on gating_approval_tickets; DELETE on customers
-- =====================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_readonly') THEN
        CREATE ROLE mcp_readonly WITH LOGIN PASSWORD 'change_readonly_pass';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_writer') THEN
        CREATE ROLE mcp_writer WITH LOGIN PASSWORD 'change_writer_pass';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_destructive') THEN
        CREATE ROLE mcp_destructive WITH LOGIN PASSWORD 'change_destructive_pass';
    END IF;
END $$;

-- Grant Read-Only Privileges
GRANT USAGE ON SCHEMA public TO mcp_readonly;
GRANT SELECT ON customers, customer_audit_notes TO mcp_readonly;

-- Grant Writer Privileges
GRANT USAGE ON SCHEMA public TO mcp_writer;
GRANT SELECT ON customers TO mcp_writer;
GRANT INSERT, SELECT ON customer_audit_notes TO mcp_writer;
GRANT USAGE, SELECT ON SEQUENCE customer_audit_notes_note_id_seq TO mcp_writer;

-- Grant Destructive / Gate Privileges
GRANT USAGE ON SCHEMA public TO mcp_destructive;
GRANT SELECT, DELETE ON customers TO mcp_destructive;
GRANT SELECT, UPDATE ON gating_approval_tickets TO mcp_destructive;
