-- ============================================================
-- Migration V26: Expand payment method enum to include CHEQUE and OTHER
-- ============================================================

ALTER TABLE payment
    MODIFY COLUMN method ENUM('CASH', 'BANK', 'GCASH', 'CHEQUE', 'OTHER') NOT NULL;
