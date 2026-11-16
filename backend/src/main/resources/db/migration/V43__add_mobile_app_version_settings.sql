-- V43: Add mobile application version gate settings to system_setting table
ALTER TABLE system_setting
    ADD COLUMN min_mobile_version_code INT NOT NULL DEFAULT 1 AFTER shipment_prefix,
    ADD COLUMN latest_mobile_version_code INT NOT NULL DEFAULT 1 AFTER min_mobile_version_code,
    ADD COLUMN latest_mobile_version_name VARCHAR(50) NOT NULL DEFAULT '1.0.0' AFTER latest_mobile_version_code,
    ADD COLUMN mobile_apk_download_url VARCHAR(500) NULL AFTER latest_mobile_version_name,
    ADD COLUMN mobile_force_update BOOLEAN NOT NULL DEFAULT TRUE AFTER mobile_apk_download_url,
    ADD COLUMN mobile_update_release_notes TEXT NULL AFTER mobile_force_update;
