CREATE INDEX idx_tracking_event_staff_timestamp_event
    ON tracking_event (staff_id, event_timestamp, event_id);

CREATE INDEX idx_tracking_event_staff_tracking_timestamp
    ON tracking_event (staff_id, tracking_id, event_timestamp, event_id);
