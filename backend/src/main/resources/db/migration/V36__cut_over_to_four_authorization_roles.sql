-- Validate all persisted identities before changing any durable role data.
CREATE TEMPORARY TABLE four_role_migration_guard (
    valid_marker TINYINT NOT NULL PRIMARY KEY
);

INSERT INTO four_role_migration_guard (valid_marker) VALUES (1);

INSERT INTO four_role_migration_guard (valid_marker)
SELECT 1
FROM app_user
WHERE role IS NULL
   OR role NOT IN (
        'ADMIN',
        'OFFICE_STAFF',
        'FIELD_STAFF',
        'RECEIVING_STAFF',
        'COURIER_STAFF',
        'DISPATCH_STAFF'
   )
   OR (role = 'ADMIN' AND staff_type IS NOT NULL)
   OR (role = 'OFFICE_STAFF' AND staff_type IS NOT NULL)
   OR (role = 'FIELD_STAFF' AND staff_type IS NULL)
   OR (role = 'FIELD_STAFF' AND staff_type NOT IN ('INTERNAL_TRUCK', 'HAULER_STAFF'))
   OR (role = 'RECEIVING_STAFF' AND staff_type IS NOT NULL)
   OR (role = 'COURIER_STAFF' AND (staff_type IS NULL OR staff_type <> 'INTERNAL_TRUCK'))
   OR (role = 'DISPATCH_STAFF' AND (staff_type IS NULL OR staff_type <> 'HAULER_STAFF'))
LIMIT 1;

DROP TEMPORARY TABLE four_role_migration_guard;

ALTER TABLE app_user
    MODIFY COLUMN role ENUM(
        'ADMIN',
        'OFFICE_STAFF',
        'FIELD_STAFF',
        'RECEIVING_STAFF',
        'COURIER_STAFF',
        'DISPATCH_STAFF'
    ) NOT NULL;

UPDATE app_user
SET role = CASE
        WHEN role = 'OFFICE_STAFF' THEN 'RECEIVING_STAFF'
        WHEN role = 'FIELD_STAFF' AND staff_type = 'INTERNAL_TRUCK' THEN 'COURIER_STAFF'
        WHEN role = 'FIELD_STAFF' AND staff_type = 'HAULER_STAFF' THEN 'DISPATCH_STAFF'
        ELSE role
    END,
    token_version = token_version + 1
WHERE role IN ('OFFICE_STAFF', 'FIELD_STAFF');

CREATE TEMPORARY TABLE four_role_post_migration_guard (
    valid_marker TINYINT NOT NULL PRIMARY KEY
);

INSERT INTO four_role_post_migration_guard (valid_marker) VALUES (1);

INSERT INTO four_role_post_migration_guard (valid_marker)
SELECT 1
FROM app_user
WHERE role IN ('OFFICE_STAFF', 'FIELD_STAFF')
   OR role IS NULL
   OR role NOT IN ('ADMIN', 'RECEIVING_STAFF', 'COURIER_STAFF', 'DISPATCH_STAFF')
LIMIT 1;

DROP TEMPORARY TABLE four_role_post_migration_guard;
