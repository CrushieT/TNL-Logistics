-- V33: Add configurable SOA bank-payment details without seeding account data.
ALTER TABLE system_setting
    ADD COLUMN soa_bank_name VARCHAR(100) NULL AFTER rate_per_kilo,
    ADD COLUMN soa_account_name VARCHAR(150) NULL AFTER soa_bank_name,
    ADD COLUMN soa_account_number VARCHAR(20) NULL AFTER soa_account_name;
