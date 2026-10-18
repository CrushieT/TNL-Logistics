-- Synthetic insert timing only: all inserted rows roll back. Auto-increment gaps remain.
-- Run only on the dedicated simulation, separately from endpoint measurements.
SELECT COUNT(*) AS events_before FROM tracking_event;
START TRANSACTION;
SET @scan_write_start = NOW(6);
INSERT INTO tracking_event (tracking_id, status, staff_id, event_timestamp, remarks)
SELECT tracking_id, status, staff_id, event_timestamp, 'Rolled-back performance measurement'
FROM tracking_event WHERE staff_id = 'LT-FIELD' ORDER BY event_id LIMIT 100;
SELECT TIMESTAMPDIFF(MICROSECOND, @scan_write_start, NOW(6)) / 1000 AS insert_100_ms;
ROLLBACK;
SELECT COUNT(*) AS events_after FROM tracking_event;
