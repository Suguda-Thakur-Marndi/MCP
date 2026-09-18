-- =====================================================================
-- Migration 003: Enterprise Orders and Audit Events Schema Expansion
-- Adds customer_code to customers, creates orders and audit_events tables
-- =====================================================================

-- 1. Add customer_code column to customers table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'customer_code'
    ) THEN
        ALTER TABLE customers ADD COLUMN customer_code VARCHAR(32) UNIQUE;
    END IF;
END $$;

-- Populate customer_code for any customer rows missing it
UPDATE customers
SET customer_code = 'CUST-' || LPAD(id::text, 6, '0')
WHERE customer_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_customer_code ON customers(customer_code);

-- 2. Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(32) UNIQUE NOT NULL,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'cancelled', 'refunded')),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- 3. Create audit_events table
CREATE TABLE IF NOT EXISTS audit_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    actor_type VARCHAR(50) NOT NULL DEFAULT 'agent',
    actor_id VARCHAR(50),
    tool_name VARCHAR(100) NOT NULL,
    decision VARCHAR(50) NOT NULL,
    request_id VARCHAR(64) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_request_id ON audit_events(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_tool_name ON audit_events(tool_name);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);

-- 4. Grants for least-privilege roles if roles exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_readonly') THEN
        GRANT SELECT ON orders, audit_events TO mcp_readonly;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_writer') THEN
        GRANT SELECT ON orders TO mcp_writer;
        GRANT INSERT, SELECT ON audit_events TO mcp_writer;
        GRANT USAGE, SELECT ON SEQUENCE audit_events_id_seq TO mcp_writer;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_destructive') THEN
        GRANT SELECT, DELETE ON orders TO mcp_destructive;
        GRANT INSERT, SELECT ON audit_events TO mcp_destructive;
        GRANT USAGE, SELECT ON SEQUENCE audit_events_id_seq TO mcp_destructive;
    END IF;
END $$;
