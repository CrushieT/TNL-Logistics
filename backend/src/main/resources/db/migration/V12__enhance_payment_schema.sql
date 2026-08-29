-- ============================================================
-- Migration V12: Enhance payment schema with staff audit and remarks
-- ============================================================

ALTER TABLE payment
    ADD COLUMN staff_id VARCHAR(20) NULL,
    ADD COLUMN remarks VARCHAR(255) NULL,
    ADD CONSTRAINT fk_payment_staff FOREIGN KEY (staff_id) REFERENCES app_user(user_id);

CREATE INDEX idx_payment_date_method ON payment (payment_date, method);
