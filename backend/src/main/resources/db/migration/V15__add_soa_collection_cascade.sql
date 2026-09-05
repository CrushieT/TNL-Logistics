-- ============================================================
-- Migration V15: Add CASCADE to soa and soa_batch collection foreign keys
-- ============================================================

ALTER TABLE soa DROP FOREIGN KEY fk_soa_collection;
ALTER TABLE soa ADD CONSTRAINT fk_soa_collection FOREIGN KEY (collection_id) REFERENCES weekly_collection(collection_id) ON DELETE CASCADE;

ALTER TABLE soa_batch DROP FOREIGN KEY fk_batch_collection;
ALTER TABLE soa_batch ADD CONSTRAINT fk_batch_collection FOREIGN KEY (collection_id) REFERENCES weekly_collection(collection_id) ON DELETE CASCADE;
