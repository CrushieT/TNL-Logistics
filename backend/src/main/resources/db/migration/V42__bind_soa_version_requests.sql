CREATE TABLE soa_version_request (
    request_id VARCHAR(64) NOT NULL PRIMARY KEY,
    request_fingerprint VARCHAR(128) NOT NULL,
    soa_no VARCHAR(30) NOT NULL,
    version_number INT NOT NULL,
    CONSTRAINT fk_soa_version_request_version FOREIGN KEY (soa_no, version_number)
        REFERENCES soa_version (soa_no, version_number) ON DELETE CASCADE
);
