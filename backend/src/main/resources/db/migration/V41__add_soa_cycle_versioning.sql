-- V41: Add SOA cycle versioning, business registration date, and immutable snapshot storage

-- Add nullable indexed business_registration_date to shipment
ALTER TABLE shipment
    ADD COLUMN business_registration_date DATE NULL;

CREATE INDEX idx_shipment_business_reg_date
    ON shipment(business_registration_date);

-- Add financial_revision to soa table for optimistic locking and change detection
ALTER TABLE soa
    ADD COLUMN financial_revision INT NOT NULL DEFAULT 1;

-- Trusted SOA logo assets stored by SHA-256 content hash
CREATE TABLE soa_logo_asset (
    asset_hash CHAR(64) NOT NULL PRIMARY KEY,
    content_type VARCHAR(100) NOT NULL,
    content LONGBLOB NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
);

-- Immutable numbered SOA versions
CREATE TABLE soa_version (
    soa_no VARCHAR(30) NOT NULL,
    version_number INT NOT NULL,
    request_id VARCHAR(64) NOT NULL,
    request_fingerprint VARCHAR(128) NOT NULL,
    capture_time TIMESTAMP(6) NOT NULL,
    captured_by_user_id VARCHAR(20) NOT NULL,
    captured_by_name VARCHAR(150) NOT NULL,
    financial_revision INT NOT NULL,
    logo_hash CHAR(64) NOT NULL,
    printable_data JSON NOT NULL,
    PRIMARY KEY (soa_no, version_number),
    CONSTRAINT uq_soa_version_request UNIQUE (request_id),
    CONSTRAINT chk_soa_version_number CHECK (version_number > 0),
    CONSTRAINT fk_soa_version_soa FOREIGN KEY (soa_no) REFERENCES soa(soa_no) ON DELETE CASCADE,
    CONSTRAINT fk_soa_version_actor FOREIGN KEY (captured_by_user_id) REFERENCES app_user(user_id),
    CONSTRAINT fk_soa_version_logo FOREIGN KEY (logo_hash) REFERENCES soa_logo_asset(asset_hash)
);

CREATE INDEX idx_soa_version_captured_by ON soa_version(captured_by_user_id);
