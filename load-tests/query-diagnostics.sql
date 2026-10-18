-- Run twice in an idle simulation; retain the second result for warm comparisons.
SELECT COUNT(*) AS shipment_count FROM shipment;
SELECT COUNT(*) AS event_count FROM tracking_event;
EXPLAIN ANALYZE SELECT COUNT(*) FROM tracking_event e
JOIN parcel_unit pu ON pu.tracking_id = e.tracking_id
JOIN shipment s ON s.shipment_id = pu.shipment_id WHERE e.staff_id = 'LT-FIELD';
EXPLAIN ANALYZE SELECT COUNT(*) FROM tracking_event e WHERE e.staff_id = 'LT-FIELD';
EXPLAIN ANALYZE SELECT event_id FROM tracking_event WHERE staff_id = 'LT-FIELD'
ORDER BY event_timestamp DESC, event_id DESC LIMIT 20;
EXPLAIN ANALYZE SELECT event_id FROM tracking_event WHERE staff_id = 'LT-FIELD' AND status = 'REGISTERED'
ORDER BY event_timestamp DESC, event_id DESC LIMIT 20;
EXPLAIN ANALYZE SELECT COUNT(*) FROM tracking_event WHERE staff_id = 'LT-FIELD' AND status = 'REGISTERED';
EXPLAIN ANALYZE SELECT status, COUNT(*) FROM tracking_event
WHERE staff_id = 'LT-FIELD' AND event_timestamp BETWEEN CURRENT_DATE AND TIMESTAMP(CURRENT_DATE, '23:59:59.999999')
GROUP BY status;
SELECT index_name, stat_value * @@innodb_page_size AS index_bytes
FROM mysql.innodb_index_stats WHERE database_name = DATABASE() AND table_name = 'tracking_event' AND stat_name = 'size';
EXPLAIN ANALYZE SELECT status, COUNT(*) FROM tracking_event
WHERE staff_id = 'LT-FIELD' AND event_timestamp BETWEEN CURRENT_DATE + INTERVAL 1 DAY AND CURRENT_DATE + INTERVAL 2 DAY
GROUP BY status;
SET @search = (SELECT tracking_id FROM tracking_event WHERE staff_id = 'LT-FIELD' ORDER BY event_id DESC LIMIT 1);
EXPLAIN ANALYZE SELECT e.event_id
FROM (SELECT DISTINCT tracking_id FROM parcel_unit
      WHERE LOWER(tracking_id) LIKE LOWER(CONCAT('%', @search, '%'))
         OR LOWER(shipment_id) LIKE LOWER(CONCAT('%', @search, '%'))) matched
JOIN tracking_event e ON e.tracking_id = matched.tracking_id
WHERE e.staff_id = 'LT-FIELD'
ORDER BY e.event_timestamp DESC, e.event_id DESC LIMIT 20;
