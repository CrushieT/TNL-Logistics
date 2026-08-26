-- ============================================================
-- V7: Add vehicle type, status, and remarks to vehicle table
-- ============================================================
ALTER TABLE vehicle
    ADD COLUMN vehicle_type VARCHAR(50) NOT NULL DEFAULT '6-Wheeler Forward',
    ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'Active',
    ADD COLUMN remarks VARCHAR(255) NULL;
