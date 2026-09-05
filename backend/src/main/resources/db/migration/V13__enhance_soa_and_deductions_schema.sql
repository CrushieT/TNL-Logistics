-- ============================================================
-- Migration V13: Enhance SOA schema and itemized deductions
-- ============================================================

-- Allow standalone single SOA generation without mandatory batch
ALTER TABLE soa MODIFY COLUMN batch_id VARCHAR(30) NULL;

-- Create itemized deduction line items table
CREATE TABLE IF NOT EXISTS soa_deduction (
    deduction_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    soa_no          VARCHAR(30) NOT NULL,
    category        ENUM('BAD_ORDER','DISCREPANCY','CLAIM') NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    reason          VARCHAR(255) NOT NULL,
    reference_id    VARCHAR(50) NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_deduction_soa FOREIGN KEY (soa_no) REFERENCES soa(soa_no) ON DELETE CASCADE,
    INDEX idx_deduction_soa (soa_no)
);

CREATE INDEX idx_soa_statement_date ON soa (statement_date);
CREATE INDEX idx_soa_client_date ON soa (client_id, statement_date);
