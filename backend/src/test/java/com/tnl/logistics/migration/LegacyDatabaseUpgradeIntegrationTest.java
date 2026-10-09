package com.tnl.logistics.migration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.test.context.ActiveProfiles;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * MySQL-backed integration test suite verifying:
 * 1. Legacy main V1 database conversion with representative data and reconciliation queueing.
 * 2. Refusal on unconfirmed backup, checksum mismatch, and mixed operational schema.
 * 3. Existing current dev database (V1..V20) receiving forward migration V21.
 * 4. Fresh empty database running V1..V21 directly.
 */
@SpringBootTest
@ActiveProfiles("test")
public class LegacyDatabaseUpgradeIntegrationTest {

    private static final String LEGACY_DB_NAME = "tnl_legacy_integ_test";
    private static final String FRESH_DB_NAME = "tnl_fresh_integ_test";
    private static final String USERNAME_COLLISION_DB_NAME = "tnl_username_collision_integ_test";
    private static final String USERNAME_NORMALIZATION_DB_NAME = "tnl_username_normalization_integ_test";
    private static final String FOUR_ROLE_FRESH_DB_NAME = "tnl_four_role_fresh_integ_test";
    private static final String FOUR_ROLE_UPGRADE_DB_NAME = "tnl_four_role_upgrade_integ_test";
    private static final String FOUR_ROLE_INVALID_DB_NAME = "tnl_four_role_invalid_integ_test";

    @Autowired
    private DataSource defaultDataSource;

    @Autowired
    private JdbcTemplate defaultJdbcTemplate;

    @Autowired
    private DataSourceProperties dataSourceProperties;

    @Autowired
    private LegacyDatabaseUpgradeService upgradeService;

    @Autowired
    private ObjectMapper objectMapper;

    private DriverManagerDataSource legacyDataSource;
    private JdbcTemplate legacyJdbcTemplate;

    @BeforeEach
    public void setup() throws Exception {
        // Ensure default test DB has V21 tables active
        try (Connection conn = defaultDataSource.getConnection()) {
            ScriptUtils.executeSqlScript(conn, new ClassPathResource("db/migration/V21__create_legacy_reconciliation_schema.sql"));
        }

        defaultJdbcTemplate.execute("DROP DATABASE IF EXISTS " + LEGACY_DB_NAME);
        defaultJdbcTemplate.execute("CREATE DATABASE " + LEGACY_DB_NAME + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

        legacyDataSource = new DriverManagerDataSource();
        legacyDataSource.setDriverClassName(dataSourceProperties.getDriverClassName());
        String baseUrl = dataSourceProperties.getUrl();
        String legacyUrl = baseUrl.contains("/tnl_test")
                ? baseUrl.replace("/tnl_test", "/" + LEGACY_DB_NAME)
                : baseUrl.replaceAll("(?<=3306/)[^?]+", LEGACY_DB_NAME);
        legacyDataSource.setUrl(legacyUrl);
        legacyDataSource.setUsername(dataSourceProperties.getUsername());
        legacyDataSource.setPassword(dataSourceProperties.getPassword());
        legacyJdbcTemplate = new JdbcTemplate(legacyDataSource);
    }

    @AfterEach
    public void tearDown() {
        try {
            defaultJdbcTemplate.execute("DROP DATABASE IF EXISTS " + LEGACY_DB_NAME);
            defaultJdbcTemplate.execute("DROP DATABASE IF EXISTS " + FRESH_DB_NAME);
            defaultJdbcTemplate.execute("DROP DATABASE IF EXISTS " + USERNAME_COLLISION_DB_NAME);
            defaultJdbcTemplate.execute("DROP DATABASE IF EXISTS " + USERNAME_NORMALIZATION_DB_NAME);
            defaultJdbcTemplate.execute("DROP DATABASE IF EXISTS " + FOUR_ROLE_FRESH_DB_NAME);
            defaultJdbcTemplate.execute("DROP DATABASE IF EXISTS " + FOUR_ROLE_UPGRADE_DB_NAME);
            defaultJdbcTemplate.execute("DROP DATABASE IF EXISTS " + FOUR_ROLE_INVALID_DB_NAME);
        } catch (Exception ignored) {}
    }

    private void populateLegacyMainV1Schema(Integer overrideChecksum) throws Exception {
        // Execute DDL from legacy main V1 using ScriptUtils to preserve full schema comments and syntax
        try (Connection conn = legacyDataSource.getConnection()) {
            ScriptUtils.executeSqlScript(conn, new ClassPathResource("db/legacy/V1__legacy_main_init_schema.sql"));
        }

        // Create flyway_schema_history
        legacyJdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS flyway_schema_history (" +
                "  installed_rank INT NOT NULL," +
                "  version VARCHAR(50)," +
                "  description VARCHAR(200) NOT NULL," +
                "  type VARCHAR(20) NOT NULL," +
                "  script VARCHAR(1000) NOT NULL," +
                "  checksum INT," +
                "  installed_by VARCHAR(100) NOT NULL," +
                "  installed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "  execution_time INT NOT NULL," +
                "  success BOOLEAN NOT NULL," +
                "  PRIMARY KEY (installed_rank)," +
                "  INDEX idx_flyway_success (success)" +
                ")"
        );

        Integer checksum = overrideChecksum != null
                ? overrideChecksum
                : upgradeService.calculateExpectedLegacyV1Checksum(legacyDataSource);

        legacyJdbcTemplate.update(
                "INSERT INTO flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, execution_time, success) " +
                "VALUES (1, '1', 'init schema', 'SQL', 'V1__init_schema.sql', ?, 'root', 25, TRUE)",
                checksum
        );

        // Insert representative legacy data
        legacyJdbcTemplate.update("INSERT INTO clients (id, name, email, phone) VALUES (1, 'Northbridge Trading', 'orders@northbridge.ph', '0917-555-0148')");
        legacyJdbcTemplate.update("INSERT INTO shipments (id, client_id, origin, destination, status) VALUES (101, 1, 'Manila', 'Baguio', 'DELIVERED')");
        legacyJdbcTemplate.update("INSERT INTO parcel_units (id, shipment_id, weight, dimensions, description) VALUES (201, 101, 8.50, '40x30x20 cm', 'Machinery Spares')");
        legacyJdbcTemplate.update("INSERT INTO payments (id, client_id, amount, payment_method, status) VALUES (301, 1, 4500.00, 'BANK_TRANSFER', 'CONFIRMED')");
    }

    @Test
    public void testLegacyConversionFlowWithRepresentativeData() throws Exception {
        populateLegacyMainV1Schema(null);

        // Verify preflight passes
        var preflight = upgradeService.performPreflightCheck(legacyDataSource);
        assertTrue(preflight.isCanProceed(), "Preflight must pass for valid legacy database");
        assertEquals("READY", preflight.getCode());

        // Execute legacy upgrade
        var report = upgradeService.executeLegacyUpgrade(legacyDataSource, true, "BKP-INTEG-2026-09-14");
        assertTrue(report.isSuccess());
        assertNotNull(report.getManifestId());
        assertEquals("BKP-INTEG-2026-09-14", report.getBackupReference());

        // Verify archive isolation
        assertTrue(upgradeService.tableExists(legacyDataSource, "legacy_clients"));
        assertTrue(upgradeService.tableExists(legacyDataSource, "legacy_shipments"));
        assertTrue(upgradeService.tableExists(legacyDataSource, "legacy_parcel_units"));
        assertTrue(upgradeService.tableExists(legacyDataSource, "legacy_payments"));
        assertTrue(upgradeService.tableExists(legacyDataSource, "legacy_flyway_schema_history"));

        // Verify operational schema created
        assertTrue(upgradeService.tableExists(legacyDataSource, "client"));
        assertTrue(upgradeService.tableExists(legacyDataSource, "shipment"));
        assertTrue(upgradeService.tableExists(legacyDataSource, "parcel_unit"));
        assertTrue(upgradeService.tableExists(legacyDataSource, "payment"));
        assertTrue(upgradeService.tableExists(legacyDataSource, "legacy_reconciliation_record"));
        assertTrue(upgradeService.tableExists(legacyDataSource, "legacy_upgrade_manifest"));

        // Verify lossless reconciliation queueing
        List<Map<String, Object>> recRows = legacyJdbcTemplate.queryForList(
                "SELECT source_table, source_id, legacy_data_json, status, reconciliation_notes FROM legacy_reconciliation_record ORDER BY record_id ASC"
        );
        assertFalse(recRows.isEmpty());

        Map<String, Object> clientRec = recRows.stream()
                .filter(r -> "legacy_clients".equals(r.get("source_table")))
                .findFirst()
                .orElseThrow();
        assertEquals("1", String.valueOf(clientRec.get("source_id")));
        JsonNode clientJson = objectMapper.readTree((String) clientRec.get("legacy_data_json"));
        assertEquals("Northbridge Trading", clientJson.get("name").asText());
        assertEquals("orders@northbridge.ph", clientJson.get("email").asText());
        assertEquals("PENDING_REVIEW", String.valueOf(clientRec.get("status")));

        Map<String, Object> shipRec = recRows.stream()
                .filter(r -> "legacy_shipments".equals(r.get("source_table")))
                .findFirst()
                .orElseThrow();
        assertEquals("101", String.valueOf(shipRec.get("source_id")));
        JsonNode shipJson = objectMapper.readTree((String) shipRec.get("legacy_data_json"));
        assertEquals("Manila", shipJson.get("origin").asText());
        assertEquals("Baguio", shipJson.get("destination").asText());

        // Verify standard Flyway validation succeeds on the operational schema
        Flyway flyway = Flyway.configure()
                .dataSource(legacyDataSource)
                .locations("classpath:db/migration")
                .load();
        flyway.validate();
    }

    @Test
    public void testPreflightRefusesWhenBackupUnconfirmed() {
        assertThrows(IllegalStateException.class, () ->
                upgradeService.executeLegacyUpgrade(legacyDataSource, false, null)
        );
    }

    @Test
    public void testPreflightRefusesOnChecksumMismatch() throws Exception {
        populateLegacyMainV1Schema(999999999);

        var preflight = upgradeService.performPreflightCheck(legacyDataSource);
        assertFalse(preflight.isCanProceed());
        assertEquals("CHECKSUM_MISMATCH", preflight.getCode());

        assertThrows(IllegalStateException.class, () ->
                upgradeService.executeLegacyUpgrade(legacyDataSource, true, "BKP-TEST")
        );
    }

    @Test
    public void testPreflightRefusesOnMixedSchema() throws Exception {
        populateLegacyMainV1Schema(null);
        // Introduce an operational canonical table into the legacy namespace
        legacyJdbcTemplate.execute("CREATE TABLE client (client_id VARCHAR(20) PRIMARY KEY)");

        var preflight = upgradeService.performPreflightCheck(legacyDataSource);
        assertFalse(preflight.isCanProceed());
        assertEquals("MIXED_SCHEMA", preflight.getCode());
    }

    @Test
    public void testCurrentDevDatabaseReachesV25Successfully() {
        assertTrue(upgradeService.tableExists(defaultDataSource, "legacy_reconciliation_record"));
        assertTrue(upgradeService.tableExists(defaultDataSource, "legacy_upgrade_manifest"));

        Flyway flyway = Flyway.configure()
                .dataSource(defaultDataSource)
                .locations("classpath:db/migration")
                .load();
        flyway.validate();
    }

    @Test
    public void testFreshEmptyDatabaseMigrations() {
        defaultJdbcTemplate.execute("DROP DATABASE IF EXISTS " + FRESH_DB_NAME);
        defaultJdbcTemplate.execute("CREATE DATABASE " + FRESH_DB_NAME + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

        DriverManagerDataSource freshDs = new DriverManagerDataSource();
        freshDs.setDriverClassName(dataSourceProperties.getDriverClassName());
        String baseUrl = dataSourceProperties.getUrl();
        String freshUrl = baseUrl.contains("/tnl_test")
                ? baseUrl.replace("/tnl_test", "/" + FRESH_DB_NAME)
                : baseUrl.replaceAll("(?<=3306/)[^?]+", FRESH_DB_NAME);
        freshDs.setUrl(freshUrl);
        freshDs.setUsername(dataSourceProperties.getUsername());
        freshDs.setPassword(dataSourceProperties.getPassword());

        Flyway.configure()
                .dataSource(freshDs)
                .locations("classpath:db/migration")
                .target("33")
                .load()
                .migrate();

        JdbcTemplate freshJdbcTemplate = new JdbcTemplate(freshDs);
        freshJdbcTemplate.update("INSERT INTO client (client_id, name, address, contact_number) VALUES ('CL-LEGACY-WB', 'Legacy Client', 'Baguio', '09170000000')");
        freshJdbcTemplate.update("INSERT INTO app_user (user_id, username, password_hash, full_name, role, staff_type) VALUES ('USR-LEGACY-WB', 'legacy_waybill', 'hash', 'Legacy Staff', 'FIELD_STAFF', 'HAULER_STAFF')");
        freshJdbcTemplate.update("INSERT INTO shipment (shipment_id, client_id, recipient_name, recipient_address, recipient_contact, quantity, charge_model, shipping_fee, total_amount, registered_via) " +
                "VALUES ('SHP-LEGACY-WB', 'CL-LEGACY-WB', 'Recipient', 'Baguio', '09170000000', 2, 'FLAT', 100.00, 100.00, 'DESKTOP_OFFICE')");
        freshJdbcTemplate.update("INSERT INTO parcel_unit (tracking_id, shipment_id, seq) VALUES ('TRK-LEGACY-1', 'SHP-LEGACY-WB', 1), ('TRK-LEGACY-2', 'SHP-LEGACY-WB', 2)");
        freshJdbcTemplate.update("INSERT INTO waybill (waybill_id, shipment_id, generated_by) VALUES ('WYB-LEGACY-WB', 'SHP-LEGACY-WB', 'USR-LEGACY-WB')");

        Flyway flyway = Flyway.configure()
                .dataSource(freshDs)
                .locations("classpath:db/migration")
                .load();

        var result = flyway.migrate();
        assertEquals(4, result.migrationsExecuted);
        flyway.validate();

        assertEquals("Cordillera Freight", freshJdbcTemplate.queryForObject(
                "SELECT hauler_name FROM waybill WHERE waybill_id = 'WYB-LEGACY-WB'", String.class));
        assertEquals("USR-LEGACY-WB", freshJdbcTemplate.queryForObject(
                "SELECT generated_by FROM waybill WHERE waybill_id = 'WYB-LEGACY-WB'", String.class));
        assertFinalAccountSchema(freshJdbcTemplate);

        assertEquals(2, freshJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM parcel_unit WHERE waybill_id = 'WYB-LEGACY-WB'", Integer.class));

        assertTrue(upgradeService.tableExists(freshDs, "client"));
        assertTrue(upgradeService.tableExists(freshDs, "shipment"));
        assertTrue(upgradeService.tableExists(freshDs, "legacy_reconciliation_record"));
        assertTrue(upgradeService.tableExists(freshDs, "legacy_upgrade_manifest"));
    }

    @Test
    public void testFourRoleFreshMigrationPath() {
        DriverManagerDataSource dataSource = createIsolatedDatabase(FOUR_ROLE_FRESH_DB_NAME);

        var result = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .load()
                .migrate();

        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        assertTrue(result.migrationsExecuted >= 37);
        assertEquals("37", jdbcTemplate.queryForObject(
                "SELECT version FROM flyway_schema_history WHERE success = TRUE ORDER BY installed_rank DESC LIMIT 1",
                String.class));
        assertTrue(upgradeService.tableExists(dataSource, "app_user"));
        assertFinalAccountSchema(jdbcTemplate);
    }

    @Test
    public void testFourRoleV35UpgradeMapsRolesAndIncrementsTokenVersions() {
        DriverManagerDataSource dataSource = createIsolatedDatabase(FOUR_ROLE_UPGRADE_DB_NAME);
        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .target("35")
                .load()
                .migrate();

        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        jdbcTemplate.update("INSERT INTO app_user (user_id, username, password_hash, full_name, role, staff_type, token_version) VALUES " +
                "('USR-MIG-ADMIN', 'mig_admin', 'hash', 'Admin', 'ADMIN', NULL, 4), " +
                "('USR-MIG-RECEIVING', 'mig_receiving', 'hash', 'Receiving', 'OFFICE_STAFF', NULL, 5), " +
                "('USR-MIG-COURIER', 'mig_courier', 'hash', 'Courier', 'FIELD_STAFF', 'INTERNAL_TRUCK', 6), " +
                "('USR-MIG-DISPATCH', 'mig_dispatch', 'hash', 'Dispatch', 'FIELD_STAFF', 'HAULER_STAFF', 7)");

        var result = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .load()
                .migrate();

        assertEquals(2, result.migrationsExecuted);
        assertEquals("ADMIN:4", finalIdentity(jdbcTemplate, "USR-MIG-ADMIN"));
        assertEquals("RECEIVING_STAFF:6", finalIdentity(jdbcTemplate, "USR-MIG-RECEIVING"));
        assertEquals("COURIER_STAFF:7", finalIdentity(jdbcTemplate, "USR-MIG-COURIER"));
        assertEquals("DISPATCH_STAFF:8", finalIdentity(jdbcTemplate, "USR-MIG-DISPATCH"));
        assertFinalAccountSchema(jdbcTemplate);
    }

    @Test
    public void testFourRoleV35UpgradeRejectsUnmappableFieldStaffWithoutMutation() {
        DriverManagerDataSource dataSource = createIsolatedDatabase(FOUR_ROLE_INVALID_DB_NAME, true);
        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .target("35")
                .load()
                .migrate();

        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        jdbcTemplate.update("INSERT INTO app_user (user_id, username, password_hash, full_name, role, staff_type, token_version) " +
                "VALUES ('USR-MIG-INVALID', 'mig_invalid', 'hash', 'Invalid', 'FIELD_STAFF', NULL, 9)");

        Flyway migration = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .load();

        assertThrows(Exception.class, migration::migrate);
        assertEquals("FIELD_STAFF:9:null", migratedIdentity(jdbcTemplate, "USR-MIG-INVALID"));
        assertEquals(0, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE version = '36' AND success = TRUE", Integer.class));
    }


    @Test
    public void testFinalRoleMigrationRejectsLegacyAndUnknownRolesBeforeSchemaMutation() {
        for (String invalidRole : List.of("OFFICE_STAFF", "FIELD_STAFF", "UNKNOWN_ROLE", "")) {
            DriverManagerDataSource dataSource = createIsolatedDatabase(FOUR_ROLE_INVALID_DB_NAME, true);
            Flyway.configure().dataSource(dataSource).locations("classpath:db/migration")
                    .target("36").load().migrate();
            JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
            jdbcTemplate.execute("ALTER TABLE app_user MODIFY COLUMN role VARCHAR(32) NULL");
            jdbcTemplate.update("INSERT INTO app_user (user_id, username, password_hash, full_name, role, token_version, hauler_company) "
                    + "VALUES ('USR-CLOSURE-INVALID', 'closure_invalid', 'hash', 'Invalid', ?, 9, 'Retained Company')", invalidRole);
            assertFinalMigrationRefusesWithoutMutation(dataSource, jdbcTemplate, invalidRole);
        }
    }

    @Test
    public void testFinalRoleMigrationRejectsNullRoleBeforeSchemaMutation() {
        DriverManagerDataSource dataSource = createIsolatedDatabase(FOUR_ROLE_INVALID_DB_NAME);
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration")
                .target("36").load().migrate();
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        jdbcTemplate.execute("ALTER TABLE app_user MODIFY COLUMN role VARCHAR(32) NULL");
        jdbcTemplate.update("INSERT INTO app_user (user_id, username, password_hash, full_name, role, token_version, hauler_company) "
                + "VALUES ('USR-CLOSURE-INVALID', 'closure_invalid', 'hash', 'Invalid', NULL, 9, 'Retained Company')");
        assertFinalMigrationRefusesWithoutMutation(dataSource, jdbcTemplate, null);
    }

    private void assertFinalMigrationRefusesWithoutMutation(
            DataSource dataSource, JdbcTemplate jdbcTemplate, String invalidRole) {
        Flyway migration = Flyway.configure().dataSource(dataSource)
                .locations("classpath:db/migration").load();
        assertThrows(Exception.class, migration::migrate);
        assertEquals(invalidRole, jdbcTemplate.queryForObject(
                "SELECT role FROM app_user WHERE user_id = 'USR-CLOSURE-INVALID'", String.class));
        assertEquals(9, jdbcTemplate.queryForObject(
                "SELECT token_version FROM app_user WHERE user_id = 'USR-CLOSURE-INVALID'", Integer.class));
        assertEquals("Retained Company", jdbcTemplate.queryForObject(
                "SELECT hauler_company FROM app_user WHERE user_id = 'USR-CLOSURE-INVALID'", String.class));
        assertEquals(1, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() "
                        + "AND table_name = 'app_user' AND column_name = 'staff_type'", Integer.class));
        assertEquals(0, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE version = '37' AND success = TRUE", Integer.class));
    }

    private void assertFinalAccountSchema(JdbcTemplate jdbcTemplate) {
        assertEquals(0, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() "
                        + "AND table_name = 'app_user' AND column_name IN ('staff_type', 'hauler_company')", Integer.class));
        assertEquals("enum('ADMIN','RECEIVING_STAFF','COURIER_STAFF','DISPATCH_STAFF')",
                jdbcTemplate.queryForObject(
                        "SELECT column_type FROM information_schema.columns WHERE table_schema = DATABASE() "
                                + "AND table_name = 'app_user' AND column_name = 'role'", String.class));
    }

    private String finalIdentity(JdbcTemplate jdbcTemplate, String userId) {
        return jdbcTemplate.queryForObject(
                "SELECT CONCAT(role, ':', token_version) FROM app_user WHERE user_id = ?", String.class, userId);
    }

    private DriverManagerDataSource createIsolatedDatabase(String databaseName) {
        return createIsolatedDatabase(databaseName, false);
    }

    private DriverManagerDataSource createIsolatedDatabase(String databaseName, boolean usePermissiveSqlMode) {
        defaultJdbcTemplate.execute("DROP DATABASE IF EXISTS " + databaseName);
        defaultJdbcTemplate.execute("CREATE DATABASE " + databaseName + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName(dataSourceProperties.getDriverClassName());
        String baseUrl = dataSourceProperties.getUrl();
        String databaseUrl = baseUrl.contains("/tnl_test")
                ? baseUrl.replace("/tnl_test", "/" + databaseName)
                : baseUrl.replaceAll("(?<=3306/)[^?]+", databaseName);
        if (usePermissiveSqlMode) {
            databaseUrl += databaseUrl.contains("?") ? "&sessionVariables=sql_mode=''" : "?sessionVariables=sql_mode=''";
        }
        dataSource.setUrl(databaseUrl);
        dataSource.setUsername(dataSourceProperties.getUsername());
        dataSource.setPassword(dataSourceProperties.getPassword());
        return dataSource;
    }

    private String migratedIdentity(JdbcTemplate jdbcTemplate, String userId) {
        return jdbcTemplate.queryForObject(
                "SELECT CONCAT(role, ':', token_version, ':', COALESCE(staff_type, 'null')) FROM app_user WHERE user_id = ?",
                String.class,
                userId);
    }

    @Test
    public void testUsernameMigrationStopsOnCanonicalCollision() {
        defaultJdbcTemplate.execute("DROP DATABASE IF EXISTS " + USERNAME_COLLISION_DB_NAME);
        defaultJdbcTemplate.execute("CREATE DATABASE " + USERNAME_COLLISION_DB_NAME + " CHARACTER SET utf8mb4 COLLATE utf8mb4_bin");

        DriverManagerDataSource collisionDataSource = new DriverManagerDataSource();
        collisionDataSource.setDriverClassName(dataSourceProperties.getDriverClassName());
        String baseUrl = dataSourceProperties.getUrl();
        String collisionUrl = baseUrl.contains("/tnl_test")
                ? baseUrl.replace("/tnl_test", "/" + USERNAME_COLLISION_DB_NAME)
                : baseUrl.replaceAll("(?<=3306/)[^?]+", USERNAME_COLLISION_DB_NAME);
        collisionDataSource.setUrl(collisionUrl);
        collisionDataSource.setUsername(dataSourceProperties.getUsername());
        collisionDataSource.setPassword(dataSourceProperties.getPassword());

        Flyway.configure()
                .dataSource(collisionDataSource)
                .locations("classpath:db/migration")
                .target("23")
                .load()
                .migrate();

        JdbcTemplate collisionJdbcTemplate = new JdbcTemplate(collisionDataSource);
        collisionJdbcTemplate.update(
                "INSERT INTO app_user (user_id, username, password_hash, full_name, role, active, must_change_password, token_version) " +
                        "VALUES ('USR-COLLISION-1', 'collision_user', 'hash', 'Collision One', 'OFFICE_STAFF', TRUE, FALSE, 1)"
        );
        collisionJdbcTemplate.update(
                "INSERT INTO app_user (user_id, username, password_hash, full_name, role, active, must_change_password, token_version) " +
                        "VALUES ('USR-COLLISION-2', 'COLLISION_USER', 'hash', 'Collision Two', 'OFFICE_STAFF', TRUE, FALSE, 1)"
        );

        Flyway collisionMigration = Flyway.configure()
                .dataSource(collisionDataSource)
                .locations("classpath:db/migration")
                .load();

        assertThrows(Exception.class, collisionMigration::migrate);
        assertEquals("collision_user", collisionJdbcTemplate.queryForObject(
                "SELECT username FROM app_user WHERE user_id = 'USR-COLLISION-1'", String.class));
        assertEquals("COLLISION_USER", collisionJdbcTemplate.queryForObject(
                "SELECT username FROM app_user WHERE user_id = 'USR-COLLISION-2'", String.class));
    }

    @Test
    public void testUsernameMigrationCanonicalizesMixedCaseUsername() {
        defaultJdbcTemplate.execute("DROP DATABASE IF EXISTS " + USERNAME_NORMALIZATION_DB_NAME);
        defaultJdbcTemplate.execute("CREATE DATABASE " + USERNAME_NORMALIZATION_DB_NAME + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

        DriverManagerDataSource normalizationDataSource = new DriverManagerDataSource();
        normalizationDataSource.setDriverClassName(dataSourceProperties.getDriverClassName());
        String baseUrl = dataSourceProperties.getUrl();
        String normalizationUrl = baseUrl.contains("/tnl_test")
                ? baseUrl.replace("/tnl_test", "/" + USERNAME_NORMALIZATION_DB_NAME)
                : baseUrl.replaceAll("(?<=3306/)[^?]+", USERNAME_NORMALIZATION_DB_NAME);
        normalizationDataSource.setUrl(normalizationUrl);
        normalizationDataSource.setUsername(dataSourceProperties.getUsername());
        normalizationDataSource.setPassword(dataSourceProperties.getPassword());

        Flyway.configure()
                .dataSource(normalizationDataSource)
                .locations("classpath:db/migration")
                .target("24")
                .load()
                .migrate();

        JdbcTemplate normalizationJdbcTemplate = new JdbcTemplate(normalizationDataSource);
        normalizationJdbcTemplate.update(
                "INSERT INTO app_user (user_id, username, password_hash, full_name, role, active, must_change_password, token_version) " +
                        "VALUES ('USR-NORMALIZE-1', 'Mixed_User', 'hash', 'Mixed User', 'OFFICE_STAFF', TRUE, FALSE, 1)"
        );

        Flyway.configure()
                .dataSource(normalizationDataSource)
                .locations("classpath:db/migration")
                .load()
                .migrate();

        assertEquals("mixed_user", normalizationJdbcTemplate.queryForObject(
                "SELECT username FROM app_user WHERE user_id = 'USR-NORMALIZE-1'", String.class));
    }
}
