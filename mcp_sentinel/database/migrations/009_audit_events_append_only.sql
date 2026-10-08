-- Migration 009: Make audit_events table strictly append-only
-- Enforces that no UPDATE, DELETE, or TRUNCATE operations can be executed on audit_events.

-- 1. Trigger function that raises an exception on any UPDATE or DELETE attempt
CREATE OR REPLACE FUNCTION enforce_audit_events_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_events is append-only: % operations are strictly prohibited', TG_OP
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger attached to audit_events
DROP TRIGGER IF EXISTS trg_audit_events_append_only ON audit_events;
CREATE TRIGGER trg_audit_events_append_only
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW
EXECUTE FUNCTION enforce_audit_events_append_only();

-- 3. Revoke modification privileges from PUBLIC and least-privilege roles
DO $$
BEGIN
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM PUBLIC;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_readonly') THEN
        REVOKE UPDATE, DELETE, TRUNCATE, INSERT ON audit_events FROM mcp_readonly;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_writer') THEN
        REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM mcp_writer;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_destructive') THEN
        REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM mcp_destructive;
    END IF;
END $$;
