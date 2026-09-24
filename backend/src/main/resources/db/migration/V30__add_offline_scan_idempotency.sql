ALTER TABLE tracking_event
    ADD COLUMN client_event_id CHAR(36) NULL,
    ADD COLUMN client_captured_at DATETIME(6) NULL,
    ADD COLUMN client_request_fingerprint CHAR(64) NULL,
    ADD COLUMN scan_source VARCHAR(16) NOT NULL DEFAULT 'ONLINE',
    ADD UNIQUE INDEX uq_tracking_event_client_event_id (client_event_id);

CREATE TABLE offline_scan_receipt (
    client_event_id CHAR(36) PRIMARY KEY,
    owner_user_id VARCHAR(20) NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    requested_tracking_id VARCHAR(30) NOT NULL,
    target_status VARCHAR(32) NOT NULL,
    vehicle_id VARCHAR(20) NULL,
    client_captured_at DATETIME(6) NOT NULL,
    client_sequence BIGINT NOT NULL,
    outcome VARCHAR(32) NOT NULL,
    outcome_code VARCHAR(64) NOT NULL,
    tracking_event_id BIGINT NULL,
    server_status VARCHAR(32) NULL,
    server_vehicle_id VARCHAR(20) NULL,
    processed_at DATETIME(6) NOT NULL,
    INDEX idx_offline_scan_receipt_owner_processed (owner_user_id, processed_at),
    INDEX idx_offline_scan_receipt_tracking_processed (requested_tracking_id, processed_at),
    INDEX idx_offline_scan_receipt_expiry (processed_at)
);
