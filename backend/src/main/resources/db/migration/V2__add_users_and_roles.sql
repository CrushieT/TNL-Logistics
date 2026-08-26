-- ============================================================
-- APP USER — system users with access roles
-- ============================================================
CREATE TABLE app_user (
    user_id                VARCHAR(20)     PRIMARY KEY,
    username                 VARCHAR(50)     NOT NULL UNIQUE,
    password_hash              VARCHAR(255)    NOT NULL,
    full_name                    VARCHAR(150)    NOT NULL,
    role                          ENUM('ADMIN','OFFICE_STAFF','FIELD_STAFF') NOT NULL,
    active                         BOOLEAN         NOT NULL DEFAULT TRUE,
    must_change_password             BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at                        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Backfill the FK constraints deferred from V1
-- ============================================================
ALTER TABLE tracking_event
    ADD CONSTRAINT fk_event_staff FOREIGN KEY (staff_id) REFERENCES app_user(user_id);

ALTER TABLE print_event
    ADD CONSTRAINT fk_print_staff FOREIGN KEY (staff_id) REFERENCES app_user(user_id);
