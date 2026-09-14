-- ============================================================
-- V21: Legacy Upgrade Manifest & Reconciliation Records
-- ============================================================

CREATE TABLE IF NOT EXISTS legacy_upgrade_manifest (
    manifest_id             VARCHAR(64)     PRIMARY KEY,
    status                  VARCHAR(50)     NOT NULL,
    stage                   VARCHAR(50)     NOT NULL,
    backup_confirmed        VARCHAR(100)    NOT NULL,
    source_v1_checksum      INT             NULL,
    started_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at            TIMESTAMP       NULL,
    summary_notes           TEXT            NULL
);

CREATE TABLE IF NOT EXISTS legacy_reconciliation_record (
    record_id               BIGINT          AUTO_INCREMENT PRIMARY KEY,
    source_table            VARCHAR(50)     NOT NULL,
    source_id               VARCHAR(50)     NOT NULL,
    legacy_data_json        TEXT            NOT NULL,
    status                  ENUM('PENDING_REVIEW', 'RECONCILED', 'IGNORED') NOT NULL DEFAULT 'PENDING_REVIEW',
    reconciliation_notes    VARCHAR(500)    NULL,
    reviewed_by             VARCHAR(50)     NULL,
    reviewed_at             TIMESTAMP       NULL,
    created_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_reconciliation_source (source_table, source_id),
    INDEX idx_reconciliation_status (status)
);
