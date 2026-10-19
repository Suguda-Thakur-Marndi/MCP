-- =====================================================================
-- Seed: Synthetic Enterprise Test Data
-- Contains ZERO real PII. Fully synthetic entities.
-- =====================================================================

-- Clean existing data for deterministic test baseline
TRUNCATE customer_audit_notes, gating_approval_tickets, customers RESTART IDENTITY CASCADE;

-- Insert Synthetic Customers
INSERT INTO customers (id, name, email, tier, status, country, created_at) VALUES
(1, 'Acme Corp Alpha', 'alpha@acme-synthetic.test', 'enterprise', 'active', 'US', NOW() - INTERVAL '60 days'),
(2, 'Beta Logistics Inc', 'support@beta-logistics.test', 'standard', 'active', 'IN', NOW() - INTERVAL '45 days'),
(3, 'Gamma Dynamics GmbH', 'contact@gamma-dynamics.test', 'premium', 'inactive', 'DE', NOW() - INTERVAL '120 days'),
(4, 'Delta Services Ltd', 'info@delta-services.test', 'standard', 'inactive', 'UK', NOW() - INTERVAL '180 days'),
(5, 'Epsilon Cloud Tech', 'admin@epsilon-cloud.test', 'enterprise', 'suspended', 'US', NOW() - INTERVAL '90 days'),
(6, 'Zeta Financial SpA', 'security@zeta-financial.test', 'premium', 'active', 'IT', NOW() - INTERVAL '30 days'),
(7, 'Eta Retail Group', 'ops@eta-retail.test', 'standard', 'inactive', 'IN', NOW() - INTERVAL '210 days'),
(8, 'Theta Manufacturing', 'contact@theta-mfg.test', 'enterprise', 'active', 'JP', NOW() - INTERVAL '15 days');

-- Reset sequence to accommodate manually specified IDs
SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));

-- Insert Sample Audit Notes
INSERT INTO customer_audit_notes (customer_id, author_id, note_text, created_at) VALUES
(1, 'sec_auditor_01', 'Initial enterprise security onboarding complete.', NOW() - INTERVAL '50 days'),
(3, 'compliance_bot', 'Account flagged inactive following 90-day dormancy period.', NOW() - INTERVAL '100 days'),
(4, 'compliance_bot', 'Account flagged inactive following 180-day dormancy period.', NOW() - INTERVAL '150 days');

-- Pre-stage Gating Approval Tickets for Security & Integration Tests
-- 1. Valid, approved, active ticket for inactive customer ID 3
INSERT INTO gating_approval_tickets (ticket_id, target_id, action, approved, consumed, created_at, expires_at) VALUES
('TICKET-VALID-PURGE-003', '3', 'PURGE', TRUE, FALSE, NOW(), NOW() + INTERVAL '2 hours');

-- 2. Valid, approved, active ticket for inactive customer ID 4
INSERT INTO gating_approval_tickets (ticket_id, target_id, action, approved, consumed, created_at, expires_at) VALUES
('TICKET-VALID-PURGE-004', '4', 'PURGE', TRUE, FALSE, NOW(), NOW() + INTERVAL '2 hours');

-- 3. Unapproved ticket (approved = FALSE)
INSERT INTO gating_approval_tickets (ticket_id, target_id, action, approved, consumed, created_at, expires_at) VALUES
('TICKET-UNAPPROVED-005', '5', 'PURGE', FALSE, FALSE, NOW(), NOW() + INTERVAL '2 hours');

-- 4. Already consumed ticket (consumed = TRUE)
INSERT INTO gating_approval_tickets (ticket_id, target_id, action, approved, consumed, created_at, expires_at, consumed_at) VALUES
('TICKET-CONSUMED-001', '1', 'PURGE', TRUE, TRUE, NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 hour', NOW() - INTERVAL '1 hour');

-- 5. Expired ticket (expires_at in past)
INSERT INTO gating_approval_tickets (ticket_id, target_id, action, approved, consumed, created_at, expires_at) VALUES
('TICKET-EXPIRED-007', '7', 'PURGE', TRUE, FALSE, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour');

-- 6. Ticket for different action
INSERT INTO gating_approval_tickets (ticket_id, target_id, action, approved, consumed, created_at, expires_at) VALUES
('TICKET-WRONG-ACTION-003', '3', 'EXPORT', TRUE, FALSE, NOW(), NOW() + INTERVAL '2 hours');

-- Populate customer_code
UPDATE customers
SET customer_code = 'CUST-' || LPAD(id::text, 6, '0')
WHERE customer_code IS NULL;

-- Insert Sample Orders
INSERT INTO orders (id, order_number, customer_id, status, total_amount, currency, created_at) VALUES
(1, 'ORD-000001', 1, 'completed', 4999.00, 'USD', NOW() - INTERVAL '30 days'),
(2, 'ORD-000002', 1, 'processing', 1250.50, 'USD', NOW() - INTERVAL '5 days'),
(3, 'ORD-000003', 2, 'completed', 850.00, 'USD', NOW() - INTERVAL '10 days'),
(4, 'ORD-000004', 3, 'completed', 15000.00, 'EUR', NOW() - INTERVAL '90 days')
ON CONFLICT (id) DO NOTHING;

SELECT setval('orders_id_seq', (SELECT COALESCE(MAX(id), 1) FROM orders));
