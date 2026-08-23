-- ============================================================
-- WAYBILL — printable document metadata
-- ============================================================
CREATE TABLE waybill (
    waybill_id               VARCHAR(20)     PRIMARY KEY,
    shipment_id                 VARCHAR(20)     NOT NULL UNIQUE,
    generated_by                   VARCHAR(20)     NOT NULL,
    generated_at                     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pdf_path                          VARCHAR(255)    NULL,

    CONSTRAINT fk_waybill_shipment
        FOREIGN KEY (shipment_id) REFERENCES shipment(shipment_id),
    CONSTRAINT fk_waybill_staff
        FOREIGN KEY (generated_by) REFERENCES app_user(user_id)
);
