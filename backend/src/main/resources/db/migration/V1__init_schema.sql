-- ============================================================
-- CLIENT — billing party, owns many shipments
-- ============================================================
CREATE TABLE client (
    client_id           VARCHAR(20)     PRIMARY KEY,
    name                 VARCHAR(150)    NOT NULL,
    address              VARCHAR(255)    NOT NULL,
    contact_number       VARCHAR(30)     NOT NULL,
    email                VARCHAR(150)    NULL,
    created_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- SHIPMENT / TRANSACTION — groups parcel units under one client
-- ============================================================
CREATE TABLE shipment (
    shipment_id          VARCHAR(20)     PRIMARY KEY,
    client_id            VARCHAR(20)     NOT NULL,
    recipient_name        VARCHAR(150)    NOT NULL,
    recipient_address     VARCHAR(255)    NOT NULL,
    recipient_contact     VARCHAR(30)     NOT NULL,
    description           VARCHAR(255)    NULL,
    quantity              INT             NOT NULL,
    charge_model          ENUM('FLAT','PER_PARCEL') NOT NULL,
    shipping_fee          DECIMAL(12,2)   NOT NULL,
    other_charges         DECIMAL(12,2)   NOT NULL DEFAULT 0,
    total_amount          DECIMAL(12,2)   NOT NULL,
    paid_at_registration  BOOLEAN         NOT NULL DEFAULT FALSE,
    route                 VARCHAR(150)    NULL,
    registered_via        ENUM('DESKTOP_OFFICE','MOBILE_FIELD') NOT NULL,
    date_registered       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_shipment_client
        FOREIGN KEY (client_id) REFERENCES client(client_id),
    INDEX idx_shipment_client (client_id),
    INDEX idx_shipment_date (date_registered)
);

-- ============================================================
-- PARCEL UNIT — one physical package, unique Tracking ID + QR
-- ============================================================
CREATE TABLE parcel_unit (
    tracking_id           VARCHAR(30)     PRIMARY KEY,
    shipment_id            VARCHAR(20)     NOT NULL,
    seq                    INT             NOT NULL,
    weight_kg               DECIMAL(8,2)    NULL,
    length_cm                DECIMAL(8,2)    NULL,
    height_cm                DECIMAL(8,2)    NULL,
    width_cm                 DECIMAL(8,2)    NULL,
    volume_cbm                DECIMAL(10,4)   NULL,
    current_status          ENUM(
                                'REGISTERED',
                                'QR_GENERATED',
                                'LOADED_ON_TRUCK',
                                'ARRIVED_AT_TNL',
                                'LOADED_TO_HAULER'
                             ) NOT NULL DEFAULT 'REGISTERED',
    label_status             ENUM('NOT_PRINTED','PRINTED','REPRINTED') NOT NULL DEFAULT 'NOT_PRINTED',
    reprint_count             INT             NOT NULL DEFAULT 0,
    current_vehicle_id        VARCHAR(20)     NULL,

    CONSTRAINT fk_parcel_shipment
        FOREIGN KEY (shipment_id) REFERENCES shipment(shipment_id),
    INDEX idx_parcel_shipment (shipment_id),
    INDEX idx_parcel_status (current_status)
);

-- ============================================================
-- TRACKING EVENT — append-only, per-unit status history
-- ============================================================
CREATE TABLE tracking_event (
    event_id               BIGINT          AUTO_INCREMENT PRIMARY KEY,
    tracking_id             VARCHAR(30)     NOT NULL,
    status                   ENUM(
                                'REGISTERED',
                                'QR_GENERATED',
                                'LOADED_ON_TRUCK',
                                'ARRIVED_AT_TNL',
                                'LOADED_TO_HAULER'
                             ) NOT NULL,
    vehicle_id                VARCHAR(20)     NULL,
    staff_id                  VARCHAR(20)     NOT NULL,
    remarks                    VARCHAR(255)    NULL,
    event_timestamp            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_event_parcel
        FOREIGN KEY (tracking_id) REFERENCES parcel_unit(tracking_id),
    INDEX idx_event_tracking (tracking_id),
    INDEX idx_event_timestamp (event_timestamp)
);

-- ============================================================
-- PRINT EVENT — label print/reprint history, separate from tracking
-- ============================================================
CREATE TABLE print_event (
    print_id                BIGINT          AUTO_INCREMENT PRIMARY KEY,
    tracking_id              VARCHAR(30)     NOT NULL,
    kind                      ENUM('PRINT','REPRINT') NOT NULL,
    labels_produced            INT             NOT NULL DEFAULT 1,
    staff_id                    VARCHAR(20)     NOT NULL,
    printer_id                   VARCHAR(20)     NULL,
    print_timestamp               TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_print_parcel
        FOREIGN KEY (tracking_id) REFERENCES parcel_unit(tracking_id),
    INDEX idx_print_tracking (tracking_id)
);

-- ============================================================
-- PAYMENT — collections recorded against a shipment
-- ============================================================
CREATE TABLE payment (
    payment_id               BIGINT          AUTO_INCREMENT PRIMARY KEY,
    shipment_id                VARCHAR(20)     NOT NULL,
    amount_paid                  DECIMAL(12,2)   NOT NULL,
    method                        ENUM('CASH','BANK','GCASH') NOT NULL,
    reference_no                   VARCHAR(100)    NULL,
    payment_date                    DATE            NOT NULL,
    statement_id                     VARCHAR(30)     NULL,
    recorded_at                       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_payment_shipment
        FOREIGN KEY (shipment_id) REFERENCES shipment(shipment_id),
    INDEX idx_payment_shipment (shipment_id)
);
