-- ============================================================
-- V10__update_waybill_and_field_staff_types.sql
-- Phase 3: Waybill Management & Field Staff Role Differentiation
-- ============================================================

-- 1. Add discriminator fields to app_user to distinguish internal truck drivers vs 3rd-party hauler staff
ALTER TABLE app_user
    ADD COLUMN staff_type       ENUM('INTERNAL_TRUCK', 'HAULER_STAFF') NULL,
    ADD COLUMN hauler_company   VARCHAR(100) NULL;

CREATE INDEX idx_user_staff_type ON app_user(staff_type);

-- 2. Add waybill workflow fields and performance indexes
ALTER TABLE waybill
    ADD COLUMN hauler_name     VARCHAR(100) NOT NULL DEFAULT 'Cordillera Freight',
    ADD COLUMN driver_name     VARCHAR(100) NULL,
    ADD COLUMN driver_contact  VARCHAR(50)  NULL,
    ADD COLUMN vehicle_plate   VARCHAR(50)  NULL,
    ADD COLUMN status          ENUM('GENERATED', 'SENT_TO_HAULER', 'SIGNED_COMPLETED') NOT NULL DEFAULT 'GENERATED',
    ADD COLUMN dispatched_at   TIMESTAMP    NULL,
    ADD COLUMN signed_by       VARCHAR(150) NULL,
    ADD COLUMN signed_at       TIMESTAMP    NULL,
    ADD COLUMN remarks         VARCHAR(255) NULL,
    ADD COLUMN updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

CREATE INDEX idx_waybill_status ON waybill(status);
CREATE INDEX idx_waybill_hauler ON waybill(hauler_name);
CREATE INDEX idx_waybill_generated_at ON waybill(generated_at);
