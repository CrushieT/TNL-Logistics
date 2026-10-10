package com.tnl.logistics.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(classes = V34PrimaryKeyMigrationIntegrationTest.DatabaseConfiguration.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class V34PrimaryKeyMigrationIntegrationTest {
    private static final String DATABASE_NAME = "tnl_v34_primary_key_integ_test";

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(DataSourceProperties.class)
    static class DatabaseConfiguration {}

    @Autowired
    private DataSourceProperties dataSourceProperties;

    private JdbcTemplate administrationJdbcTemplate;
    private DriverManagerDataSource migrationDataSource;
    private JdbcTemplate migrationJdbcTemplate;

    @BeforeEach
    void createIsolatedUpgradeDatabase() {
        String testUrl = dataSourceProperties.getUrl();
        assertTrue(testUrl.matches("jdbc:mysql://(?:localhost|127\\.0\\.0\\.1):\\d+/tnl_test(?:\\?.*)?"),
                "Migration regression must use the local dedicated test database configuration");
        DriverManagerDataSource testDataSource = dataSourceProperties.initializeDataSourceBuilder()
                .type(DriverManagerDataSource.class).build();
        administrationJdbcTemplate = new JdbcTemplate(testDataSource);
        administrationJdbcTemplate.execute("DROP DATABASE IF EXISTS " + DATABASE_NAME);
        administrationJdbcTemplate.execute("CREATE DATABASE " + DATABASE_NAME);

        migrationDataSource = new DriverManagerDataSource();
        migrationDataSource.setDriverClassName(dataSourceProperties.getDriverClassName());
        String migrationUrl = testUrl.replace("/tnl_test", "/" + DATABASE_NAME);
        migrationDataSource.setUrl(migrationUrl);
        migrationDataSource.setUsername(dataSourceProperties.getUsername());
        migrationDataSource.setPassword(dataSourceProperties.getPassword());
        Flyway.configure().dataSource(migrationDataSource).locations("classpath:db/migration")
                .target("33").load().migrate();

        migrationDataSource.setUrl(migrationUrl + (migrationUrl.contains("?") ? "&" : "?")
                + "sessionVariables=sql_require_primary_key=ON");
        migrationJdbcTemplate = new JdbcTemplate(migrationDataSource);
        assertEquals(1, migrationJdbcTemplate.queryForObject("SELECT @@SESSION.sql_require_primary_key", Integer.class));
    }

    @AfterEach
    void removeIsolatedUpgradeDatabase() {
        if (administrationJdbcTemplate != null) {
            administrationJdbcTemplate.execute("DROP DATABASE IF EXISTS " + DATABASE_NAME);
        }
    }

    @Test
    void migratesExistingWaybillThroughV38WithPrimaryKeysRequired() {
        seedExistingWaybill(2);
        Flyway migration = createMigration();
        assertEquals(5, migration.migrate().migrationsExecuted);
        migration.validate();

        assertEquals(2, migrationJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM parcel_unit WHERE waybill_id = 'WYB-UPGRADE'", Integer.class));
        assertEquals("Existing Hauler", migrationJdbcTemplate.queryForObject(
                "SELECT hauler_name FROM waybill WHERE waybill_id = 'WYB-UPGRADE'", String.class));
        assertEquals("USR-UPGRADE", migrationJdbcTemplate.queryForObject(
                "SELECT generated_by FROM waybill WHERE waybill_id = 'WYB-UPGRADE'", String.class));
        assertEquals("DISPATCH_STAFF", migrationJdbcTemplate.queryForObject(
                "SELECT role FROM app_user WHERE user_id = 'USR-UPGRADE'", String.class));
        assertEquals(0, countGuardTables());
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1})
    void rejectsIncompleteBackfillBeforeBusinessSchemaChanges(int parcelCount) {
        seedExistingWaybill(parcelCount);
        Exception failure = assertThrows(Exception.class, () -> createMigration().migrate());
        Throwable rootCause = failure;
        while (rootCause.getCause() != null) rootCause = rootCause.getCause();
        assertTrue(rootCause.getMessage().contains("chk_waybill_backfill"), rootCause.getMessage());
        assertEquals(1, countGuardTables());
        assertEquals(1, migrationJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() "
                        + "AND table_name = 'waybill_backfill_guard' AND constraint_type = 'PRIMARY KEY'", Integer.class));
        assertEquals(0, countManifestColumns());
        assertEquals(1, migrationJdbcTemplate.queryForObject("SELECT COUNT(*) FROM waybill", Integer.class));
        assertEquals(parcelCount, migrationJdbcTemplate.queryForObject("SELECT COUNT(*) FROM parcel_unit", Integer.class));
        assertEquals(1, migrationJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE version = '34' AND success = FALSE", Integer.class));
    }

    @Test
    void repairsFailedBackfillOnlyAfterTestDataAndGuardAreCorrected() {
        seedExistingWaybill(1);
        Flyway migration = createMigration();
        assertThrows(Exception.class, migration::migrate);
        assertEquals(0, countManifestColumns());

        migrationJdbcTemplate.update("INSERT INTO parcel_unit (tracking_id, shipment_id, seq) "
                + "VALUES ('TRK-UPGRADE-2', 'SHP-UPGRADE', 2)");
        migrationJdbcTemplate.execute("DROP TABLE waybill_backfill_guard");
        migration.repair();
        assertEquals(5, migration.migrate().migrationsExecuted);
        migration.validate();
        assertEquals(2, migrationJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM parcel_unit WHERE waybill_id = 'WYB-UPGRADE'", Integer.class));
        assertEquals(0, migrationJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE success = FALSE", Integer.class));
    }

    private Flyway createMigration() {
        return Flyway.configure().dataSource(migrationDataSource).locations("classpath:db/migration").load();
    }

    @Test
    void recoversOriginalPrimaryKeyFailureWithoutRemovingBusinessData(@TempDir Path originalMigrations) throws IOException {
        seedExistingWaybill(2);
        Flyway originalMigration = createOriginalMigration(originalMigrations);
        Exception failure = assertThrows(Exception.class, originalMigration::migrate);
        Throwable rootCause = failure;
        while (rootCause.getCause() != null) rootCause = rootCause.getCause();
        assertTrue(rootCause instanceof java.sql.SQLException);
        assertEquals(3750, ((java.sql.SQLException) rootCause).getErrorCode());
        assertEquals(0, countGuardTables());
        assertEquals(0, countManifestColumns());

        Flyway correctedMigration = createMigration();
        assertThrows(Exception.class, correctedMigration::validate);
        correctedMigration.repair();
        assertEquals(5, correctedMigration.migrate().migrationsExecuted);
        correctedMigration.validate();
        assertEquals(2, migrationJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM parcel_unit WHERE waybill_id = 'WYB-UPGRADE'", Integer.class));
        assertEquals(1, migrationJdbcTemplate.queryForObject("SELECT COUNT(*) FROM shipment", Integer.class));
        assertEquals(1, migrationJdbcTemplate.queryForObject("SELECT COUNT(*) FROM waybill", Integer.class));
    }

    @Test
    void reconcilesOriginalSuccessfulV34ChecksumWithoutReapplyingBackfill(@TempDir Path originalMigrations) throws IOException {
        seedExistingWaybill(2);
        Flyway originalMigration = createOriginalMigration(originalMigrations);
        String requiredKeyUrl = migrationDataSource.getUrl();
        migrationDataSource.setUrl(requiredKeyUrl.replace("sql_require_primary_key=ON", "sql_require_primary_key=OFF"));
        assertEquals(1, originalMigration.migrate().migrationsExecuted);
        migrationDataSource.setUrl(requiredKeyUrl);

        Flyway correctedMigration = createMigration();
        Exception failure = assertThrows(Exception.class, correctedMigration::validate);
        assertTrue(failure.getMessage().contains("checksum mismatch for migration version 34"), failure.getMessage());
        correctedMigration.repair();
        assertEquals(4, correctedMigration.migrate().migrationsExecuted);
        correctedMigration.validate();
        assertEquals(2, migrationJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM parcel_unit WHERE waybill_id = 'WYB-UPGRADE'", Integer.class));
        assertEquals(1, migrationJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE version = '34' AND success = TRUE", Integer.class));
    }

    private Flyway createOriginalMigration(Path originalMigrations) throws IOException {
        var resources = new PathMatchingResourcePatternResolver().getResources("classpath:db/migration/V*.sql");
        for (var resource : resources) {
            String source;
            try (var inputStream = resource.getInputStream()) {
                source = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
            }
            if ("V34__split_waybill_manifests.sql".equals(resource.getFilename())) {
                source = source.replace("valid TINYINT NOT NULL PRIMARY KEY", "valid TINYINT NOT NULL");
            }
            Files.writeString(originalMigrations.resolve(resource.getFilename()), source, StandardCharsets.UTF_8);
        }
        return Flyway.configure().dataSource(migrationDataSource)
                .locations("filesystem:" + originalMigrations).target("34").load();
    }

    private int countGuardTables() {
        return migrationJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() "
                        + "AND table_name = 'waybill_backfill_guard'", Integer.class);
    }

    private int countManifestColumns() {
        return migrationJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() "
                        + "AND ((table_name = 'waybill' AND column_name IN ('generation_key', 'sent_by', 'completed_by')) "
                        + "OR (table_name = 'parcel_unit' AND column_name = 'waybill_id'))", Integer.class);
    }

    private void seedExistingWaybill(int parcelCount) {
        migrationJdbcTemplate.update("INSERT INTO client (client_id, name, address, contact_number) "
                + "VALUES ('CL-UPGRADE', 'Existing Client', 'Delivery street', '09170000000')");
        migrationJdbcTemplate.update("INSERT INTO app_user (user_id, username, password_hash, full_name, role, staff_type) "
                + "VALUES ('USR-UPGRADE', 'upgrade_staff', 'unused-test-hash', 'Existing Staff', 'FIELD_STAFF', 'HAULER_STAFF')");
        migrationJdbcTemplate.update("INSERT INTO shipment (shipment_id, client_id, recipient_name, recipient_address, "
                + "recipient_contact, quantity, charge_model, shipping_fee, total_amount, registered_via) "
                + "VALUES ('SHP-UPGRADE', 'CL-UPGRADE', 'Existing Recipient', 'Delivery street', '09170000000', "
                + "2, 'FLAT', 100.00, 100.00, 'DESKTOP_OFFICE')");
        for (int parcelIndex = 1; parcelIndex <= parcelCount; parcelIndex++) {
            migrationJdbcTemplate.update("INSERT INTO parcel_unit (tracking_id, shipment_id, seq) VALUES (?, 'SHP-UPGRADE', ?)",
                    "TRK-UPGRADE-" + parcelIndex, parcelIndex);
        }
        migrationJdbcTemplate.update("INSERT INTO waybill (waybill_id, shipment_id, generated_by, hauler_name) "
                + "VALUES ('WYB-UPGRADE', 'SHP-UPGRADE', 'USR-UPGRADE', 'Existing Hauler')");
    }
}
