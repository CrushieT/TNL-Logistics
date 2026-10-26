package com.tnl.logistics.config;

import com.tnl.logistics.model.Client;
import com.tnl.logistics.service.IdentifierCounterService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.*;
import org.hibernate.Session;

/** Expands service-generated fixtures with bounded, parameterized multi-row inserts. */
final class LoadTestFixtureWriter {
    private static final int INSERT_ROW_LIMIT = 250;
    private static final Set<String> REFERENCE_COLUMNS = Set.of(
            "shipment_id", "tracking_id", "waybill_id", "print_job_id", "request_id", "target_id");
    private final EntityManager entityManager;
    private final IdentifierCounterService counters;
    private final List<Template> templates = new ArrayList<>();
    private final Map<String, BillingClient> clients = new HashMap<>();

    LoadTestFixtureWriter(EntityManager entityManager, IdentifierCounterService counters) {
        this.entityManager = entityManager;
        this.counters = counters;
    }

    void captureTemplates() {
        entityManager.flush();
        Map<String, Template> byShipment = new LinkedHashMap<>();
        entityManager.unwrap(Session.class).doWork(connection -> {
            for (FixtureTable table : FixtureTable.values()) {
                try (PreparedStatement statement = connection.prepareStatement(table.selectSql);
                        ResultSet result = statement.executeQuery()) {
                    while (result.next()) {
                        String shipmentId = result.getString("fixture_shipment_id");
                        Map<String, Object> row = new LinkedHashMap<>();
                        for (int column = 1; column <= result.getMetaData().getColumnCount(); column++) {
                            String name = result.getMetaData().getColumnLabel(column).toLowerCase(Locale.ROOT);
                            if (!name.equals("fixture_shipment_id") && !name.equals(table.generatedKey)) {
                                row.put(name, result.getObject(column));
                            }
                        }
                        byShipment.computeIfAbsent(shipmentId, ignored -> new Template()).rows
                                .computeIfAbsent(table, ignored -> new ArrayList<>()).add(row);
                    }
                }
            }
        });
        templates.addAll(byShipment.values());
        if (templates.isEmpty()) throw new IllegalStateException("Load-test workflow templates are missing");
        for (Client client : entityManager.createQuery("select client from Client client where client.active = true", Client.class).getResultList()) {
            clients.put(client.getClientId(), new BillingClient(client.getName(), client.getAddress(), client.getContactNumber(),
                    client.getRatePerKilo() == null ? new BigDecimal("45.00") : client.getRatePerKilo()));
        }
        entityManager.clear();
    }

    void expandBatch(int batchStart, List<String> clientIds) {
        int year = LocalDate.now().getYear();
        long shipmentSequence = counters.next(IdentifierCounterService.IdentifierFamily.SHIPMENT, year, clientIds.size());
        int parcelCount = 0;
        int waybillCount = 0;
        for (int offset = 0; offset < clientIds.size(); offset++) {
            Template template = templateFor(batchStart + offset);
            parcelCount += template.rows.get(FixtureTable.PARCEL).size();
            waybillCount += template.rows.getOrDefault(FixtureTable.WAYBILL, List.of()).size();
        }
        long trackingSequence = counters.next(IdentifierCounterService.IdentifierFamily.TRACKING, year, parcelCount);
        long waybillSequence = waybillCount == 0 ? 0 : counters.next(IdentifierCounterService.IdentifierFamily.WAYBILL, year, waybillCount);
        Map<FixtureTable, List<Map<String, Object>>> batch = new EnumMap<>(FixtureTable.class);
        for (int offset = 0; offset < clientIds.size(); offset++) {
            int shipmentIndex = batchStart + offset;
            Template template = templateFor(shipmentIndex);
            String shipmentId = String.format("SHP-%d-%03d", year, shipmentSequence++);
            Map<String, String> references = new HashMap<>();
            references.put((String) template.shipment().get("shipment_id"), shipmentId);
            for (Map<String, Object> parcel : template.rows.get(FixtureTable.PARCEL)) {
                references.put((String) parcel.get("tracking_id"), String.format("TRK-%d-%06d", year, trackingSequence++));
            }
            for (Map<String, Object> waybill : template.rows.getOrDefault(FixtureTable.WAYBILL, List.of())) {
                references.put((String) waybill.get("waybill_id"), String.format("WYB-%d-%03d", year, waybillSequence++));
            }
            for (FixtureTable table : List.of(FixtureTable.PRINT_JOB, FixtureTable.EXCEPTION_COMMAND)) {
                String key = table == FixtureTable.PRINT_JOB ? "print_job_id" : "request_id";
                for (Map<String, Object> row : template.rows.getOrDefault(table, List.of())) {
                    String original = (String) row.get(key);
                    references.put(original, UUID.nameUUIDFromBytes((shipmentId + ":" + original).getBytes(StandardCharsets.UTF_8)).toString());
                }
            }
            BillingClient client = Objects.requireNonNull(clients.get(clientIds.get(offset)), "Missing load-test client");
            BigDecimal oldTotal = (BigDecimal) template.shipment().get("total_amount");
            BigDecimal shippingFee = ((BigDecimal) template.shipment().get("billable_weight")).multiply(client.rate).setScale(2, RoundingMode.HALF_UP);
            BigDecimal totalAmount = shippingFee.add((BigDecimal) template.shipment().get("other_charges"));
            for (FixtureTable table : FixtureTable.values()) {
                for (Map<String, Object> original : template.rows.getOrDefault(table, List.of())) {
                    Map<String, Object> row = new LinkedHashMap<>(original);
                    for (String column : REFERENCE_COLUMNS) {
                        if (row.get(column) instanceof String value) {
                            String replacement = references.get(value);
                            if (replacement == null) throw new IllegalStateException("Unmapped fixture reference: " + column);
                            row.put(column, replacement);
                        }
                    }
                    if (table == FixtureTable.SHIPMENT) {
                        row.put("client_id", clientIds.get(offset));
                        row.put("recipient_name", client.name);
                        row.put("recipient_address", client.address);
                        row.put("recipient_contact", client.contact);
                        row.put("applied_rate_per_kilo", client.rate);
                        row.put("shipping_fee", shippingFee);
                        row.put("total_amount", totalAmount);
                        row.put("description", String.format("LT%02d-%08d Synthetic cargo and delivery supplies", (shipmentIndex - 1) % 24 + 1, shipmentIndex));
                    } else if (table == FixtureTable.WAYBILL) {
                        row.put("generation_key", "loadtest-" + row.get("waybill_id"));
                    } else if (table == FixtureTable.PAYMENT) {
                        row.put("amount_paid", ((BigDecimal) row.get("amount_paid")).multiply(totalAmount).divide(oldTotal, 2, RoundingMode.HALF_UP));
                        if (!"PAID-AT-REGISTRATION".equals(row.get("reference_no"))) {
                            row.put("reference_no", "LT-PAY-" + shipmentIndex + "-" + batch.getOrDefault(table, List.of()).size());
                        }
                    } else if (table == FixtureTable.PRINT_JOB) {
                        String originalJobId = (String) original.get("print_job_id");
                        List<String> trackingIds = template.rows.get(FixtureTable.PRINT_EVENT).stream()
                                .filter(event -> originalJobId.equals(event.get("print_job_id")))
                                .map(event -> references.get(event.get("tracking_id"))).sorted().toList();
                        row.put("request_fingerprint", fingerprint(String.join("\n", shipmentId, String.join(",", trackingIds),
                                (String) row.get("staff_id"), Objects.toString(row.get("printer_id"), ""))));
                    }
                    batch.computeIfAbsent(table, ignored -> new ArrayList<>()).add(row);
                }
            }
        }
        entityManager.unwrap(Session.class).doWork(connection -> {
            for (FixtureTable table : FixtureTable.values()) writeRows(connection, table, batch.getOrDefault(table, List.of()));
        });
        entityManager.clear();
    }

    private Template templateFor(int shipmentIndex) {
        return templates.get((shipmentIndex - 1) % templates.size());
    }

    private void writeRows(Connection connection, FixtureTable table, List<Map<String, Object>> rows) throws SQLException {
        if (rows.isEmpty()) return;
        List<String> columns = List.copyOf(rows.getFirst().keySet());
        String placeholders = "(" + String.join(",", Collections.nCopies(columns.size(), "?")) + ")";
        for (int start = 0; start < rows.size(); start += INSERT_ROW_LIMIT) {
            List<Map<String, Object>> chunk = rows.subList(start, Math.min(start + INSERT_ROW_LIMIT, rows.size()));
            String sql = "INSERT INTO " + table.tableName + " (`" + String.join("`,`", columns) + "`) VALUES "
                    + String.join(",", Collections.nCopies(chunk.size(), placeholders));
            try (PreparedStatement statement = connection.prepareStatement(sql)) {
                int parameter = 1;
                for (Map<String, Object> row : chunk) {
                    for (String column : columns) statement.setObject(parameter++, row.get(column));
                }
                statement.executeUpdate();
            }
        }
    }

    private static String fingerprint(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private record BillingClient(String name, String address, String contact, BigDecimal rate) {}

    private static final class Template {
        private final Map<FixtureTable, List<Map<String, Object>>> rows = new EnumMap<>(FixtureTable.class);
        private Map<String, Object> shipment() { return rows.get(FixtureTable.SHIPMENT).getFirst(); }
    }

    // Parent tables precede their dependents. Only database-generated numeric keys are omitted.
    private enum FixtureTable {
        SHIPMENT("shipment", "", "SELECT fixture.*, fixture.shipment_id AS fixture_shipment_id FROM shipment fixture ORDER BY CAST(SUBSTRING_INDEX(fixture.shipment_id, '-', -1) AS UNSIGNED)"),
        WAYBILL("waybill", "", "SELECT fixture.*, fixture.shipment_id AS fixture_shipment_id FROM waybill fixture ORDER BY fixture.waybill_id"),
        PARCEL("parcel_unit", "", "SELECT fixture.*, fixture.shipment_id AS fixture_shipment_id FROM parcel_unit fixture ORDER BY fixture.tracking_id"),
        TRACKING("tracking_event", "event_id", "SELECT fixture.*, parcel.shipment_id AS fixture_shipment_id FROM tracking_event fixture JOIN parcel_unit parcel ON parcel.tracking_id=fixture.tracking_id ORDER BY fixture.event_id"),
        PAYMENT("payment", "payment_id", "SELECT fixture.*, fixture.shipment_id AS fixture_shipment_id FROM payment fixture ORDER BY fixture.payment_id"),
        PRINT_JOB("print_audit_job", "", "SELECT fixture.*, fixture.shipment_id AS fixture_shipment_id FROM print_audit_job fixture ORDER BY fixture.print_job_id"),
        PRINT_EVENT("print_event", "print_id", "SELECT fixture.*, parcel.shipment_id AS fixture_shipment_id FROM print_event fixture JOIN parcel_unit parcel ON parcel.tracking_id=fixture.tracking_id ORDER BY fixture.print_id"),
        EXCEPTION_COMMAND("parcel_exception_command", "", "SELECT fixture.*, COALESCE(parcel.shipment_id, waybill.shipment_id) AS fixture_shipment_id FROM parcel_exception_command fixture LEFT JOIN parcel_unit parcel ON parcel.tracking_id=fixture.target_id LEFT JOIN waybill ON waybill.waybill_id=fixture.target_id ORDER BY fixture.request_id"),
        LOSS("parcel_loss_event", "event_id", "SELECT fixture.*, parcel.shipment_id AS fixture_shipment_id FROM parcel_loss_event fixture JOIN parcel_unit parcel ON parcel.tracking_id=fixture.tracking_id ORDER BY fixture.event_id"),
        RECONCILIATION("waybill_reconciliation_event", "event_id", "SELECT fixture.*, waybill.shipment_id AS fixture_shipment_id FROM waybill_reconciliation_event fixture JOIN waybill ON waybill.waybill_id=fixture.waybill_id ORDER BY fixture.event_id"),
        RETURN_SCAN("waybill_return_scan", "id", "SELECT fixture.*, waybill.shipment_id AS fixture_shipment_id FROM waybill_return_scan fixture JOIN waybill ON waybill.waybill_id=fixture.waybill_id ORDER BY fixture.id");

        private final String tableName;
        private final String generatedKey;
        private final String selectSql;
        FixtureTable(String tableName, String generatedKey, String selectSql) {
            this.tableName = tableName;
            this.generatedKey = generatedKey;
            this.selectSql = selectSql;
        }
    }
}
