CREATE TABLE print_audit_job (
    print_job_id         CHAR(36)     PRIMARY KEY,
    shipment_id          VARCHAR(20)  NOT NULL,
    staff_id             VARCHAR(20)  NOT NULL,
    printer_id           VARCHAR(20)  NULL,
    request_fingerprint  CHAR(64)     NOT NULL,
    created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_print_audit_job_shipment
        FOREIGN KEY (shipment_id) REFERENCES shipment(shipment_id),
    CONSTRAINT fk_print_audit_job_staff
        FOREIGN KEY (staff_id) REFERENCES app_user(user_id),
    INDEX idx_print_audit_job_shipment (shipment_id),
    INDEX idx_print_audit_job_staff (staff_id)
);

ALTER TABLE print_event
    ADD COLUMN print_job_id CHAR(36) NULL AFTER print_id,
    ADD CONSTRAINT fk_print_event_job
        FOREIGN KEY (print_job_id) REFERENCES print_audit_job(print_job_id),
    ADD CONSTRAINT uq_print_event_job_tracking UNIQUE (print_job_id, tracking_id);
