-- System Settings (Phase 5.6)
CREATE TABLE system_setting (
    setting_id INT PRIMARY KEY,
    company_name VARCHAR(150) NOT NULL,
    company_address VARCHAR(255) NOT NULL,
    company_contact VARCHAR(50) NOT NULL,
    billing_email VARCHAR(100) NOT NULL,
    collection_day VARCHAR(20) NOT NULL DEFAULT 'THURSDAY',
    volumetric_divisor INT NOT NULL DEFAULT 5000,
    tracking_prefix VARCHAR(20) NOT NULL DEFAULT 'TRK',
    shipment_prefix VARCHAR(20) NOT NULL DEFAULT 'SHP',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50) NULL
);

INSERT INTO system_setting (
    setting_id,
    company_name,
    company_address,
    company_contact,
    billing_email,
    collection_day,
    volumetric_divisor,
    tracking_prefix,
    shipment_prefix
) VALUES (
    1,
    'TNL Logistics',
    'Manila Central Hub',
    '0917-555-0000',
    'billing@tnllogistics.ph',
    'THURSDAY',
    5000,
    'TRK',
    'SHP'
);
