-- V32: Populate default rate_per_kilo for existing system_setting singleton row
UPDATE system_setting
SET rate_per_kilo = 100.00
WHERE setting_id = 1 AND rate_per_kilo IS NULL;
