-- Validate before MySQL's implicitly committed schema change, including permissive SQL modes.
CREATE TEMPORARY TABLE final_role_migration_guard (
    valid_marker TINYINT NOT NULL PRIMARY KEY
);

INSERT INTO final_role_migration_guard (valid_marker) VALUES (1);

INSERT INTO final_role_migration_guard (valid_marker)
SELECT 1
FROM app_user
WHERE role IS NULL
   OR BINARY role NOT IN ('ADMIN', 'RECEIVING_STAFF', 'COURIER_STAFF', 'DISPATCH_STAFF')
LIMIT 1;

DROP TEMPORARY TABLE final_role_migration_guard;

ALTER TABLE app_user
    MODIFY COLUMN role ENUM('ADMIN', 'RECEIVING_STAFF', 'COURIER_STAFF', 'DISPATCH_STAFF') NOT NULL,
    DROP COLUMN staff_type,
    DROP COLUMN hauler_company;
