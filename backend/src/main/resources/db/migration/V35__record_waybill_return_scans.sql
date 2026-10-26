CREATE TABLE waybill_return_scan (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    waybill_id VARCHAR(20) NOT NULL,
    tracking_id VARCHAR(30) NOT NULL,
    scanned_by VARCHAR(20) NOT NULL,
    scanned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_waybill_return_unit UNIQUE (waybill_id, tracking_id),
    CONSTRAINT fk_waybill_return_waybill FOREIGN KEY (waybill_id) REFERENCES waybill(waybill_id),
    CONSTRAINT fk_waybill_return_parcel FOREIGN KEY (tracking_id) REFERENCES parcel_unit(tracking_id),
    CONSTRAINT fk_waybill_return_actor FOREIGN KEY (scanned_by) REFERENCES app_user(user_id)
);
