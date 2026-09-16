-- ============================================================
-- V9: Add default rate type, active status, date_registered, and performance indexes
-- ============================================================

ALTER TABLE client
    ADD COLUMN default_rate_type ENUM('FLAT', 'PER_PARCEL') NOT NULL DEFAULT 'FLAT',
    ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN date_registered TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Composite performance indexes for high-frequency client queries
CREATE INDEX idx_shipment_client_paid ON shipment (client_id, paid_at_registration);
CREATE INDEX idx_shipment_client_date ON shipment (client_id, date_registered);
CREATE INDEX idx_client_active ON client (active);
