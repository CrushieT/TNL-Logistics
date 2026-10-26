CREATE INDEX idx_tracking_event_staff_timestamp_status
    ON tracking_event (staff_id, event_timestamp, status);

CREATE INDEX idx_tracking_event_staff_status_timestamp_event
    ON tracking_event (staff_id, status, event_timestamp, event_id);
