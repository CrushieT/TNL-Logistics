-- ============================================================
-- Migration V14: Add ON DELETE CASCADE to weekly_collection client FK
-- ============================================================

ALTER TABLE weekly_collection DROP FOREIGN KEY fk_collection_client;
ALTER TABLE weekly_collection ADD CONSTRAINT fk_collection_client FOREIGN KEY (client_id) REFERENCES client(client_id) ON DELETE CASCADE;
