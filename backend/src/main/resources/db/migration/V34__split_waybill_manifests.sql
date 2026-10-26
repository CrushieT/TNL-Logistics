-- Existing waybills represented every unit of their shipment. Refuse an incomplete backfill.
CREATE TABLE waybill_backfill_guard (valid TINYINT NOT NULL PRIMARY KEY, CONSTRAINT chk_waybill_backfill CHECK (valid = 1));
INSERT INTO waybill_backfill_guard (valid)
SELECT 0 FROM waybill w
JOIN shipment s ON s.shipment_id = w.shipment_id
LEFT JOIN parcel_unit p ON p.shipment_id = w.shipment_id
GROUP BY w.waybill_id, s.quantity
HAVING COUNT(p.tracking_id) = 0 OR COUNT(p.tracking_id) <> s.quantity;
DROP TABLE waybill_backfill_guard;

CREATE INDEX idx_waybill_shipment ON waybill(shipment_id);
ALTER TABLE waybill DROP INDEX shipment_id;
ALTER TABLE waybill
    ADD COLUMN generation_key VARCHAR(100) NULL,
    ADD COLUMN sent_by VARCHAR(20) NULL,
    ADD COLUMN completed_by VARCHAR(20) NULL,
    ADD CONSTRAINT uq_waybill_generation_key UNIQUE (generation_key),
    ADD CONSTRAINT fk_waybill_sent_by FOREIGN KEY (sent_by) REFERENCES app_user(user_id),
    ADD CONSTRAINT fk_waybill_completed_by FOREIGN KEY (completed_by) REFERENCES app_user(user_id);

ALTER TABLE parcel_unit
    ADD COLUMN waybill_id VARCHAR(20) NULL,
    ADD CONSTRAINT fk_parcel_waybill FOREIGN KEY (waybill_id) REFERENCES waybill(waybill_id);
CREATE INDEX idx_parcel_waybill ON parcel_unit(waybill_id);
UPDATE parcel_unit p JOIN waybill w ON w.shipment_id = p.shipment_id
SET p.waybill_id = w.waybill_id;
