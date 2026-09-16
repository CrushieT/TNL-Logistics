package com.tnl.logistics.migration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Dedicated offline migration service that converts legacy main databases to canonical schema.
 * Renames legacy tables to legacy_* archives, executes canonical migrations V1..V21,
 * and populates reconciliation records with lossless source values.
 */
@Service
public class LegacyDatabaseUpgradeService {

    private static final Logger log = LoggerFactory.getLogger(LegacyDatabaseUpgradeService.class);

    private static final List<String> LEGACY_TABLES = List.of(
            "clients",
            "shipments",
            "parcel_units",
            "qr_codes",
            "tracking_events",
            "statements_of_account",
            "charges",
            "payments",
            "weekly_collections"
    );

    private static final List<String> CANONICAL_CORE_TABLES = List.of(
            "client",
            "shipment",
            "parcel_unit",
            "tracking_event",
            "print_event",
            "payment"
    );

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public LegacyDatabaseUpgradeService(DataSource dataSource, JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.dataSource = dataSource;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public PreflightCheckResult performPreflightCheck() {
        return performPreflightCheck(this.dataSource);
    }

    public PreflightCheckResult performPreflightCheck(DataSource targetDataSource) {
        JdbcTemplate jt = new JdbcTemplate(targetDataSource);

        boolean hasFlywayHistory = tableExists(targetDataSource, "flyway_schema_history");
        boolean hasLegacyArchiveHistory = tableExists(targetDataSource, "legacy_flyway_schema_history");
        boolean hasCanonicalCore = CANONICAL_CORE_TABLES.stream().anyMatch(t -> tableExists(targetDataSource, t));
        boolean hasLegacyTables = LEGACY_TABLES.stream().anyMatch(t -> tableExists(targetDataSource, t));
        boolean hasArchivedTables = LEGACY_TABLES.stream().allMatch(t -> tableExists(targetDataSource, "legacy_" + t));

        if (!hasFlywayHistory && !hasLegacyTables && !hasCanonicalCore && !hasArchivedTables) {
            return new PreflightCheckResult(false, "EMPTY_DATABASE",
                    "Database is empty. Standard Flyway migrations should be used instead of legacy upgrade.");
        }

        if (hasCanonicalCore && hasLegacyTables) {
            return new PreflightCheckResult(false, "MIXED_SCHEMA",
                    "Database contains both operational canonical tables and legacy tables. Refusing upgrade on mixed schema.");
        }

        if (hasFlywayHistory) {
            Integer maxVersion = jt.queryForObject(
                    "SELECT COALESCE(MAX(CAST(version AS UNSIGNED)), 0) FROM flyway_schema_history WHERE version REGEXP '^[0-9]+$'",
                    Integer.class
            );
            if (maxVersion != null && maxVersion > 1) {
                return new PreflightCheckResult(false, "ALREADY_CURRENT",
                        "Database contains modern Flyway history (version " + maxVersion + "). Legacy upgrade cannot run on current schema.");
            }

            Integer v1Checksum = jt.queryForObject(
                    "SELECT checksum FROM flyway_schema_history WHERE version = '1'",
                    Integer.class
            );

            Integer expectedLegacyV1Checksum = calculateExpectedLegacyV1Checksum(targetDataSource);
            if (expectedLegacyV1Checksum != null && !Objects.equals(v1Checksum, expectedLegacyV1Checksum)) {
                return new PreflightCheckResult(false, "CHECKSUM_MISMATCH",
                        "Flyway V1 checksum (" + v1Checksum + ") does not match legacy main V1 checksum (" + expectedLegacyV1Checksum + ").");
            }
        }

        if (hasArchivedTables && !hasLegacyTables) {
            return new PreflightCheckResult(true, "RESUMABLE_ARCHIVE",
                    "Legacy tables are already archived. Can resume canonical migration and reconciliation.");
        }

        boolean allLegacyPresent = LEGACY_TABLES.stream().allMatch(t -> tableExists(targetDataSource, t));
        if (!allLegacyPresent) {
            return new PreflightCheckResult(false, "INCOMPLETE_LEGACY",
                    "Database is missing one or more required legacy tables. Refusing unrecognized schema.");
        }

        return new PreflightCheckResult(true, "READY", "Legacy main database verified and ready for upgrade.");
    }

    public UpgradeReport executeLegacyUpgrade(boolean backupConfirmed, String backupId) {
        return executeLegacyUpgrade(this.dataSource, backupConfirmed, backupId);
    }

    public UpgradeReport executeLegacyUpgrade(DataSource targetDataSource, boolean backupConfirmed, String backupId) {
        if (!backupConfirmed) {
            throw new IllegalStateException("Safety gate violated: Legacy upgrade requires confirmed backup. Pass --backup-confirmed=true.");
        }

        PreflightCheckResult preflight = performPreflightCheck(targetDataSource);
        if (!preflight.isCanProceed()) {
            throw new IllegalStateException("Preflight validation failed: " + preflight.getMessage());
        }

        String manifestId = "UPG-" + System.currentTimeMillis();
        String backupRef = backupId != null && !backupId.isBlank() ? backupId : "CONFIRMED-" + System.currentTimeMillis();
        log.info("Starting legacy database upgrade. Manifest: {}, Backup reference: {}", manifestId, backupRef);

        // 1. Record Manifest
        ensureManifestTableExists(targetDataSource);
        recordManifestStage(targetDataSource, manifestId, "IN_PROGRESS", "PREFLIGHT_PASSED", backupRef, "Preflight checks passed");

        // 2. Archive legacy tables to legacy_*
        archiveLegacyTables(targetDataSource);
        recordManifestStage(targetDataSource, manifestId, "IN_PROGRESS", "TABLES_ARCHIVED", backupRef, "Legacy tables archived into legacy_* namespace");

        // 3. Execute Canonical Flyway Migrations (V1..V21)
        executeCanonicalMigrations(targetDataSource);
        recordManifestStage(targetDataSource, manifestId, "IN_PROGRESS", "CANONICAL_MIGRATED", backupRef, "Canonical schema migrations applied");

        // 4. Populate Lossless Reconciliation Records
        Map<String, Integer> reconciliationCounts = populateReconciliationRecords(targetDataSource);
        recordManifestStage(targetDataSource, manifestId, "COMPLETED", "RECONCILIATION_COMPLETED", backupRef, "Reconciliation records generated");

        UpgradeReport report = new UpgradeReport(
                manifestId,
                backupRef,
                true,
                reconciliationCounts,
                "Legacy database successfully upgraded to canonical schema. Operational tables are active and legacy data is queued for staff reconciliation."
        );
        log.info("Legacy database upgrade completed successfully: {}", report);
        return report;
    }

    private void archiveLegacyTables(DataSource ds) {
        JdbcTemplate jt = new JdbcTemplate(ds);
        for (String table : LEGACY_TABLES) {
            String archiveTable = "legacy_" + table;
            if (tableExists(ds, table) && !tableExists(ds, archiveTable)) {
                log.info("Archiving table {} -> {}", table, archiveTable);
                jt.execute("RENAME TABLE `" + table + "` TO `" + archiveTable + "`");
            }
        }
        if (tableExists(ds, "flyway_schema_history") && !tableExists(ds, "legacy_flyway_schema_history")) {
            log.info("Archiving flyway_schema_history -> legacy_flyway_schema_history");
            jt.execute("RENAME TABLE `flyway_schema_history` TO `legacy_flyway_schema_history`");
        }
    }

    private void executeCanonicalMigrations(DataSource ds) {
        log.info("Executing canonical Flyway migration chain (V1..V21)...");
        Flyway flyway = Flyway.configure()
                .dataSource(ds)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .baselineDescription("Legacy Archive Baseline")
                .load();
        flyway.migrate();
    }

    private Map<String, Integer> populateReconciliationRecords(DataSource ds) {
        Map<String, Integer> counts = new LinkedHashMap<>();

        counts.put("clients", reconcileTable(ds, "legacy_clients", "id",
                "Legacy client record. Physical address and verified contact number required before operational creation."));

        counts.put("shipments", reconcileTable(ds, "legacy_shipments", "id",
                "Legacy shipment record. Recipient details, package count, charge model, and fee required before operational creation."));

        counts.put("parcel_units", reconcileTable(ds, "legacy_parcel_units", "id",
                "Legacy parcel record. Dimensions, weight, and tracking ID required before operational creation."));

        counts.put("qr_codes", reconcileTable(ds, "legacy_qr_codes", "id",
                "Legacy QR code data. Unit link required before operational creation."));

        counts.put("tracking_events", reconcileTable(ds, "legacy_tracking_events", "id",
                "Legacy tracking event history. Staff ID and tracking unit mapping required before operational creation."));

        counts.put("statements_of_account", reconcileTable(ds, "legacy_statements_of_account", "id",
                "Legacy Statement of Account summary. Client association required before operational creation."));

        counts.put("charges", reconcileTable(ds, "legacy_charges", "id",
                "Legacy charge line item. Shipment association required before operational creation."));

        counts.put("payments", reconcileTable(ds, "legacy_payments", "id",
                "Legacy payment record. Method mapping and shipment reference required before operational creation."));

        counts.put("weekly_collections", reconcileTable(ds, "legacy_weekly_collections", "id",
                "Legacy weekly collection summary. Staff association required before operational creation."));

        return counts;
    }

    private int reconcileTable(DataSource ds, String tableName, String idColumn, String defaultNote) {
        if (!tableExists(ds, tableName)) {
            return 0;
        }

        JdbcTemplate jt = new JdbcTemplate(ds);
        String selectSql = "SELECT * FROM `" + tableName + "`";
        List<Map<String, Object>> rows = jt.queryForList(selectSql);
        int inserted = 0;

        for (Map<String, Object> row : rows) {
            String sourceId = String.valueOf(row.get(idColumn));
            try {
                String json = objectMapper.writeValueAsString(row);
                jt.update(
                        "INSERT INTO legacy_reconciliation_record (source_table, source_id, legacy_data_json, status, reconciliation_notes) " +
                        "VALUES (?, ?, ?, 'PENDING_REVIEW', ?)",
                        tableName, sourceId, json, defaultNote
                );
                inserted++;
            } catch (Exception e) {
                log.error("Failed to serialize legacy row from {}: {}", tableName, row, e);
            }
        }
        log.info("Populated {} reconciliation entries from {}", inserted, tableName);
        return inserted;
    }

    private void ensureManifestTableExists(DataSource ds) {
        JdbcTemplate jt = new JdbcTemplate(ds);
        jt.execute(
                "CREATE TABLE IF NOT EXISTS legacy_upgrade_manifest (" +
                "  manifest_id VARCHAR(64) PRIMARY KEY," +
                "  status VARCHAR(50) NOT NULL," +
                "  stage VARCHAR(50) NOT NULL," +
                "  backup_confirmed VARCHAR(100) NOT NULL," +
                "  source_v1_checksum INT NULL," +
                "  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "  completed_at TIMESTAMP NULL," +
                "  summary_notes TEXT NULL" +
                ")"
        );
    }

    private void recordManifestStage(DataSource ds, String manifestId, String status, String stage, String backupRef, String notes) {
        ensureManifestTableExists(ds);
        JdbcTemplate jt = new JdbcTemplate(ds);
        Integer v1Checksum = null;
        if (tableExists(ds, "legacy_flyway_schema_history")) {
            v1Checksum = queryChecksumSafely(ds, "legacy_flyway_schema_history");
        } else if (tableExists(ds, "flyway_schema_history")) {
            v1Checksum = queryChecksumSafely(ds, "flyway_schema_history");
        }

        LocalDateTime completedAt = "COMPLETED".equals(status) ? LocalDateTime.now() : null;

        jt.update(
                "INSERT INTO legacy_upgrade_manifest (manifest_id, status, stage, backup_confirmed, source_v1_checksum, completed_at, summary_notes) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?) " +
                "ON DUPLICATE KEY UPDATE status = VALUES(status), stage = VALUES(stage), completed_at = VALUES(completed_at), summary_notes = VALUES(summary_notes)",
                manifestId, status, stage, backupRef, v1Checksum, completedAt, notes
        );
    }

    private Integer queryChecksumSafely(DataSource ds, String historyTable) {
        try {
            JdbcTemplate jt = new JdbcTemplate(ds);
            return jt.queryForObject(
                    "SELECT checksum FROM `" + historyTable + "` WHERE version = '1'",
                    Integer.class
            );
        } catch (Exception ignored) {
            return null;
        }
    }

    public Integer calculateExpectedLegacyV1Checksum() {
        return calculateExpectedLegacyV1Checksum(this.dataSource);
    }

    public Integer calculateExpectedLegacyV1Checksum(DataSource ds) {
        try {
            Flyway legacyFlyway = Flyway.configure()
                    .dataSource(ds)
                    .locations("classpath:db/legacy")
                    .table("legacy_probe_history_" + Math.abs(UUID.randomUUID().hashCode()))
                    .load();
            for (MigrationInfo info : legacyFlyway.info().all()) {
                if ("1".equals(info.getVersion().getVersion())) {
                    return info.getChecksum();
                }
            }
        } catch (Exception e) {
            log.warn("Could not calculate legacy V1 checksum via Flyway: {}", e.getMessage());
        }
        return null;
    }

    public boolean tableExists(String tableName) {
        return tableExists(this.dataSource, tableName);
    }

    public boolean tableExists(DataSource ds, String tableName) {
        try {
            JdbcTemplate jt = new JdbcTemplate(ds);
            Integer count = jt.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
                    Integer.class,
                    tableName
            );
            return count != null && count > 0;
        } catch (Exception e) {
            log.warn("Failed checking table existence for {}: {}", tableName, e.getMessage());
            return false;
        }
    }

    public static class PreflightCheckResult {
        private final boolean canProceed;
        private final String code;
        private final String message;

        public PreflightCheckResult(boolean canProceed, String code, String message) {
            this.canProceed = canProceed;
            this.code = code;
            this.message = message;
        }

        public boolean isCanProceed() { return canProceed; }
        public String getCode() { return code; }
        public String getMessage() { return message; }
    }

    public static class UpgradeReport {
        private final String manifestId;
        private final String backupReference;
        private final boolean success;
        private final Map<String, Integer> reconciliationCounts;
        private final String message;

        public UpgradeReport(String manifestId, String backupReference, boolean success,
                             Map<String, Integer> reconciliationCounts, String message) {
            this.manifestId = manifestId;
            this.backupReference = backupReference;
            this.success = success;
            this.reconciliationCounts = reconciliationCounts;
            this.message = message;
        }

        public String getManifestId() { return manifestId; }
        public String getBackupReference() { return backupReference; }
        public boolean isSuccess() { return success; }
        public Map<String, Integer> getReconciliationCounts() { return reconciliationCounts; }
        public String getMessage() { return message; }

        @Override
        public String toString() {
            return "UpgradeReport{" +
                    "manifestId='" + manifestId + '\'' +
                    ", backupReference='" + backupReference + '\'' +
                    ", success=" + success +
                    ", reconciliationCounts=" + reconciliationCounts +
                    ", message='" + message + '\'' +
                    '}';
        }
    }
}
