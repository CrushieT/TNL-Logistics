package com.tnl.logistics.migration;

import static org.junit.jupiter.api.Assertions.*;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class ParcelLossMigrationIntegrationTest {
    @Autowired JdbcTemplate server;
    @Autowired DataSourceProperties properties;
    private String schema;
    private DriverManagerDataSource dataSource;

    @BeforeEach void createSchema() {
        schema = "tnl_loss_migration_test_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        server.execute("CREATE DATABASE `" + schema + "`");
        String baseUrl = properties.getUrl();
        int optionsIndex = baseUrl.indexOf('?');
        int pathIndex = baseUrl.lastIndexOf('/', optionsIndex < 0 ? baseUrl.length() : optionsIndex);
        String suffix = optionsIndex < 0 ? "" : baseUrl.substring(optionsIndex);
        dataSource = new DriverManagerDataSource(baseUrl.substring(0, pathIndex + 1) + schema + suffix,
                properties.getUsername(), properties.getPassword());
        dataSource.setDriverClassName(properties.getDriverClassName());
    }

    @AfterEach void dropOwnedSchema() {
        if (schema != null && schema.matches("tnl_loss_migration_test_[a-f0-9]{12}")) {
            server.execute("DROP DATABASE `" + schema + "`");
        }
    }

    @Test void freshDatabaseIncludesLossSchema() {
        Flyway flyway = Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load();
        flyway.migrate();
        flyway.validate();
        JdbcTemplate database = new JdbcTemplate(dataSource);
        assertEquals(3, database.queryForObject("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name IN ('parcel_loss_event', 'waybill_reconciliation_event', 'parcel_exception_command')", Integer.class, schema));
        assertEquals("39", flyway.info().current().getVersion().toString());
    }

    @Test void upgradeDefaultsLossWithoutChangingExistingCustodyOrBilling() {
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target("38").load().migrate();
        JdbcTemplate database = new JdbcTemplate(dataSource);
        database.update("INSERT INTO client (client_id, name, address, contact_number) VALUES ('CL-LOSS', 'Migration Fixture', 'Test Hub', '00000000000')");
        database.update("INSERT INTO app_user (user_id, username, password_hash, full_name, role) VALUES ('USR-LOSS', 'loss_migration_fixture', 'unused-test-hash', 'Migration Fixture', 'ADMIN')");
        database.update("INSERT INTO shipment (shipment_id, client_id, recipient_name, recipient_address, recipient_contact, quantity, charge_model, shipping_fee, total_amount, registered_via) VALUES ('SHP-LOSS', 'CL-LOSS', 'Fixture', 'Test Hub', '00000000000', 1, 'FLAT', 100, 100, 'DESKTOP_OFFICE')");
        database.update("INSERT INTO waybill (waybill_id, shipment_id, generated_by, hauler_name, status) VALUES ('WYB-LOSS', 'SHP-LOSS', 'USR-LOSS', 'Fixture', 'SENT_TO_HAULER')");
        database.update("INSERT INTO parcel_unit (tracking_id, shipment_id, waybill_id, seq, current_status, label_status) VALUES ('TRK-LOSS', 'SHP-LOSS', 'WYB-LOSS', 1, 'LOADED_TO_HAULER', 'PRINTED')");
        Flyway flyway = Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load();
        assertEquals(1, flyway.migrate().migrationsExecuted);
        flyway.validate();
        assertFalse(Boolean.TRUE.equals(database.queryForObject("SELECT is_lost FROM parcel_unit WHERE tracking_id = 'TRK-LOSS'", Boolean.class)));
        assertEquals(0L, database.queryForObject("SELECT revision FROM parcel_unit WHERE tracking_id = 'TRK-LOSS'", Long.class));
        assertEquals("LOADED_TO_HAULER:PRINTED:WYB-LOSS", database.queryForObject("SELECT CONCAT(current_status, ':', label_status, ':', waybill_id) FROM parcel_unit WHERE tracking_id = 'TRK-LOSS'", String.class));
        assertEquals("SENT_TO_HAULER:0", database.queryForObject("SELECT CONCAT(status, ':', manifest_revision) FROM waybill WHERE waybill_id = 'WYB-LOSS'", String.class));
        assertEquals(new java.math.BigDecimal("100.00"), database.queryForObject("SELECT total_amount FROM shipment WHERE shipment_id = 'SHP-LOSS'", java.math.BigDecimal.class));
        assertEquals(0, database.queryForObject("SELECT COUNT(*) FROM parcel_loss_event", Integer.class));
    }
}
