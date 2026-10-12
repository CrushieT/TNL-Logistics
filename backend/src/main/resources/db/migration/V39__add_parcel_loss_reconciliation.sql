ALTER TABLE parcel_unit ADD COLUMN is_lost BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE waybill ADD COLUMN manifest_revision BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN reconciliation_outcome VARCHAR(20) NULL;

CREATE TABLE parcel_exception_command (
    request_id VARCHAR(64) PRIMARY KEY,
    action VARCHAR(20) NOT NULL,
    target_id VARCHAR(30) NOT NULL,
    actor_id VARCHAR(20) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    expected_revision BIGINT NOT NULL,
    CONSTRAINT fk_exception_actor FOREIGN KEY (actor_id) REFERENCES app_user(user_id)
);

CREATE TABLE parcel_loss_event (
    event_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tracking_id VARCHAR(30) NOT NULL,
    action VARCHAR(10) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    actor_id VARCHAR(20) NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    previous_status VARCHAR(30) NOT NULL,
    previous_vehicle_id VARCHAR(20) NULL,
    request_id VARCHAR(64) NOT NULL UNIQUE,
    expected_revision BIGINT NOT NULL,
    CONSTRAINT fk_loss_parcel FOREIGN KEY (tracking_id) REFERENCES parcel_unit(tracking_id),
    CONSTRAINT fk_loss_actor FOREIGN KEY (actor_id) REFERENCES app_user(user_id),
    INDEX idx_loss_parcel (tracking_id, event_id)
);
CREATE TABLE waybill_reconciliation_event (
    event_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    waybill_id VARCHAR(20) NOT NULL,
    action VARCHAR(20) NOT NULL,
    outcome VARCHAR(20) NULL,
    custody_state VARCHAR(20) NOT NULL,
    reason VARCHAR(255) NULL,
    actor_id VARCHAR(20) NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    signed_by VARCHAR(150) NULL,
    signed_at DATETIME(6) NULL,
    request_id VARCHAR(64) NULL UNIQUE,
    expected_revision BIGINT NULL,
    CONSTRAINT fk_reconciliation_waybill FOREIGN KEY (waybill_id) REFERENCES waybill(waybill_id),
    CONSTRAINT fk_reconciliation_actor FOREIGN KEY (actor_id) REFERENCES app_user(user_id),
    INDEX idx_reconciliation_waybill (waybill_id, event_id)
);
