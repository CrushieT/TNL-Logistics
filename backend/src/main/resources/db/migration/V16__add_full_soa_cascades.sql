-- ============================================================
-- Migration V16: Add comprehensive cascade and set null foreign keys for SOA lifecycle
-- ============================================================

ALTER TABLE soa DROP FOREIGN KEY fk_soa_client;
ALTER TABLE soa ADD CONSTRAINT fk_soa_client FOREIGN KEY (client_id) REFERENCES client(client_id) ON DELETE CASCADE;

ALTER TABLE soa DROP FOREIGN KEY fk_soa_batch;
ALTER TABLE soa ADD CONSTRAINT fk_soa_batch FOREIGN KEY (batch_id) REFERENCES soa_batch(batch_id) ON DELETE SET NULL;

ALTER TABLE shipment DROP FOREIGN KEY fk_shipment_statement;
ALTER TABLE shipment ADD CONSTRAINT fk_shipment_statement FOREIGN KEY (statement_id) REFERENCES soa(soa_no) ON DELETE SET NULL;

ALTER TABLE payment DROP FOREIGN KEY fk_payment_statement;
ALTER TABLE payment ADD CONSTRAINT fk_payment_statement FOREIGN KEY (statement_id) REFERENCES soa(soa_no) ON DELETE SET NULL;
