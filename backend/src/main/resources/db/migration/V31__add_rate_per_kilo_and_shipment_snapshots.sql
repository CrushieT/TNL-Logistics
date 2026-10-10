-- V31: Add rate_per_kilo to system_setting and calculation snapshots to shipment (Phase 1)
ALTER TABLE system_setting
    ADD COLUMN rate_per_kilo DECIMAL(12,2) NULL AFTER volumetric_divisor;

ALTER TABLE shipment
    MODIFY COLUMN charge_model ENUM('FLAT','PER_PARCEL','PER_KILO') NOT NULL,
    ADD COLUMN applied_rate_per_kilo DECIMAL(12,2) NULL AFTER charge_model,
    ADD COLUMN applied_volumetric_divisor INT NULL AFTER applied_rate_per_kilo,
    ADD COLUMN total_actual_weight DECIMAL(12,2) NULL AFTER applied_volumetric_divisor,
    ADD COLUMN total_volumetric_weight DECIMAL(12,2) NULL AFTER total_actual_weight,
    ADD COLUMN billable_weight DECIMAL(12,2) NULL AFTER total_volumetric_weight;
