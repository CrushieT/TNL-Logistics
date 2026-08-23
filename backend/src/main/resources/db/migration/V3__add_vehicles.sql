-- ============================================================
-- VEHICLE — vehicle fleet details
-- ============================================================
CREATE TABLE vehicle (
    vehicle_id              VARCHAR(20)     PRIMARY KEY,
    plate_number               VARCHAR(20)     NOT NULL UNIQUE,
    description                  VARCHAR(100)    NOT NULL,
    active                        BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at                     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Backfill the FK constraints deferred from V1
-- ============================================================
ALTER TABLE parcel_unit
    ADD CONSTRAINT fk_parcel_vehicle FOREIGN KEY (current_vehicle_id) REFERENCES vehicle(vehicle_id);

ALTER TABLE tracking_event
    ADD CONSTRAINT fk_event_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicle(vehicle_id);
