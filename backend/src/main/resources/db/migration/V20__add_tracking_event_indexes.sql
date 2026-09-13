-- ============================================================
-- V20: Performance Indexes for Tracking Event Queries
-- ============================================================

CREATE INDEX idx_tracking_event_tracking_timestamp ON tracking_event (tracking_id, event_timestamp);
CREATE INDEX idx_tracking_event_status_timestamp ON tracking_event (status, event_timestamp);
CREATE INDEX idx_tracking_event_staff ON tracking_event (staff_id);
