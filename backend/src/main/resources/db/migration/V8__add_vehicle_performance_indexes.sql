-- ============================================================
-- V8: Add composite performance indexes for vehicle queries
-- ============================================================
CREATE INDEX idx_parcel_vehicle_status ON parcel_unit (current_vehicle_id, current_status);
CREATE INDEX idx_tracking_event_vehicle ON tracking_event (vehicle_id);
