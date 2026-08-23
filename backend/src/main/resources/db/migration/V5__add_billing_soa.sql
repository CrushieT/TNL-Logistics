-- ============================================================
-- WEEKLY COLLECTION — Thursday billing targets
-- ============================================================
CREATE TABLE weekly_collection (
    collection_id             VARCHAR(30)     PRIMARY KEY,
    client_id                    VARCHAR(20)     NOT NULL,
    week_of                        DATE            NOT NULL,
    collection_date                  DATE            NOT NULL,
    total_due                          DECIMAL(12,2)   NOT NULL,
    total_paid                          DECIMAL(12,2)   NOT NULL DEFAULT 0,
    balance                              DECIMAL(12,2)   NOT NULL,
    status                                 ENUM('FOR_COLLECTION','PARTIAL','PAID') NOT NULL DEFAULT 'FOR_COLLECTION',

    CONSTRAINT fk_collection_client
        FOREIGN KEY (client_id) REFERENCES client(client_id),
    INDEX idx_collection_client_week (client_id, week_of)
);

-- ============================================================
-- SOA BATCH — bulk billing statement export
-- ============================================================
CREATE TABLE soa_batch (
    batch_id                  VARCHAR(30)     PRIMARY KEY,
    collection_id                VARCHAR(30)     NOT NULL,
    scope                          ENUM('ALL','SELECTED') NOT NULL,
    soa_count                        INT             NOT NULL,
    generated_by                       VARCHAR(20)     NOT NULL,
    generated_at                         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_batch_collection
        FOREIGN KEY (collection_id) REFERENCES weekly_collection(collection_id),
    CONSTRAINT fk_batch_staff
        FOREIGN KEY (generated_by) REFERENCES app_user(user_id)
);

-- ============================================================
-- SOA — statement of account details per client
-- ============================================================
CREATE TABLE soa (
    soa_no                     VARCHAR(30)     PRIMARY KEY,
    batch_id                      VARCHAR(30)     NOT NULL,
    collection_id                    VARCHAR(30)     NOT NULL,
    client_id                          VARCHAR(20)     NOT NULL,
    previous_balance                     DECIMAL(12,2)   NOT NULL DEFAULT 0,
    current_charges                        DECIMAL(12,2)   NOT NULL,
    deductions                               DECIMAL(12,2)   NOT NULL DEFAULT 0,
    deduction_reason                           VARCHAR(255)    NULL,
    total_paid                                   DECIMAL(12,2)   NOT NULL DEFAULT 0,
    outstanding_balance                            DECIMAL(12,2)   NOT NULL,
    collected_by                                     VARCHAR(150)    NULL,
    statement_date                                     DATE            NOT NULL,
    pdf_path                                             VARCHAR(255)    NULL,

    CONSTRAINT fk_soa_batch
        FOREIGN KEY (batch_id) REFERENCES soa_batch(batch_id),
    CONSTRAINT fk_soa_collection
        FOREIGN KEY (collection_id) REFERENCES weekly_collection(collection_id),
    CONSTRAINT fk_soa_client
        FOREIGN KEY (client_id) REFERENCES client(client_id)
);

-- ============================================================
-- SOA IMMUTABILITY LOCK — linking shipments/payments
-- ============================================================
ALTER TABLE shipment
    ADD COLUMN statement_id VARCHAR(30) NULL,
    ADD CONSTRAINT fk_shipment_statement FOREIGN KEY (statement_id) REFERENCES soa(soa_no);

ALTER TABLE payment
    ADD CONSTRAINT fk_payment_statement FOREIGN KEY (statement_id) REFERENCES soa(soa_no);
