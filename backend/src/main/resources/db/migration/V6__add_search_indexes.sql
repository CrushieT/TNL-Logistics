-- ============================================================
-- V6: Performance Indexes for Search & Filter Queries
-- ============================================================

CREATE INDEX idx_shipment_recipient ON shipment (recipient_name);
CREATE INDEX idx_client_name ON client (name);
CREATE INDEX idx_payment_date ON payment (payment_date);
