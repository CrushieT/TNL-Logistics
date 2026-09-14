package com.tnl.logistics.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Locale;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdentifierCounterService {

    private final JdbcTemplate jdbcTemplate;

    @PersistenceContext
    private EntityManager entityManager;

    public IdentifierCounterService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public long next(IdentifierFamily family, Integer year) {
        return next(family, year, 1);
    }

    @Transactional
    public long next(IdentifierFamily family, Integer year, int allocationSize) {
        if (allocationSize < 1) {
            throw new IllegalArgumentException("Identifier allocation size must be positive");
        }

        entityManager.flush();
        String counterKey = family.counterKey(year);
        jdbcTemplate.update(
                "INSERT INTO identifier_counter (counter_key, last_issued, initialized) VALUES (?, 0, FALSE) "
                        + "ON DUPLICATE KEY UPDATE counter_key = VALUES(counter_key)",
                counterKey
        );

        CounterState counterState = jdbcTemplate.queryForObject(
                "SELECT last_issued, initialized FROM identifier_counter WHERE counter_key = ? FOR UPDATE",
                (resultSet, rowNumber) -> new CounterState(
                        resultSet.getLong("last_issued"),
                        resultSet.getBoolean("initialized")
                ),
                counterKey
        );
        if (counterState == null) {
            throw new IllegalStateException("Identifier counter was not created for " + counterKey);
        }

        long lastIssued = counterState.lastIssued();
        if (!counterState.initialized()) {
            lastIssued = findHighWaterMark(family, year);
            jdbcTemplate.update(
                    "UPDATE identifier_counter SET last_issued = ?, initialized = TRUE WHERE counter_key = ?",
                    lastIssued,
                    counterKey
            );
        }

        if (lastIssued == Long.MAX_VALUE) {
            throw new IllegalStateException("Identifier counter is exhausted for " + counterKey);
        }

        long nextValue;
        try {
            nextValue = Math.addExact(lastIssued, allocationSize);
        } catch (ArithmeticException ex) {
            throw new IllegalStateException("Identifier counter is exhausted for " + counterKey, ex);
        }
        jdbcTemplate.update(
                "UPDATE identifier_counter SET last_issued = ? WHERE counter_key = ?",
                nextValue,
                counterKey
        );
        return lastIssued + 1;
    }

    private record CounterState(long lastIssued, boolean initialized) {
    }

    private long findHighWaterMark(IdentifierFamily family, Integer year) {
        String regex = family.regex(year);
        Long highWaterMark = jdbcTemplate.queryForObject(
                "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(" + family.columnName()
                        + ", '-', -1) AS UNSIGNED)), 0) FROM " + family.tableName()
                        + " WHERE " + family.columnName() + " REGEXP ?",
                Long.class,
                regex
        );
        return highWaterMark == null ? 0 : highWaterMark;
    }

    public enum IdentifierFamily {
        CLIENT("client", "client_id", "CL", false),
        USER("app_user", "user_id", "U", false),
        VEHICLE("vehicle", "vehicle_id", "VH", false),
        SHIPMENT("shipment", "shipment_id", "SHP", true),
        TRACKING("parcel_unit", "tracking_id", "TRK", true),
        WAYBILL("waybill", "waybill_id", "WYB", true);

        private final String tableName;
        private final String columnName;
        private final String prefix;
        private final boolean yearScoped;

        IdentifierFamily(String tableName, String columnName, String prefix, boolean yearScoped) {
            this.tableName = tableName;
            this.columnName = columnName;
            this.prefix = prefix;
            this.yearScoped = yearScoped;
        }

        private String tableName() {
            return tableName;
        }

        private String columnName() {
            return columnName;
        }

        private String counterKey(Integer year) {
            validateYear(year);
            return yearScoped ? name() + ":" + year : name();
        }

        private String regex(Integer year) {
            validateYear(year);
            return yearScoped
                    ? "^" + prefix + "-" + year + "-[0-9]+$"
                    : "^" + prefix.toUpperCase(Locale.ROOT) + "-[0-9]+$";
        }

        private void validateYear(Integer year) {
            if (yearScoped && (year == null || year < 2000 || year > 9999)) {
                throw new IllegalArgumentException("A four-digit year is required for " + name());
            }
        }
    }
}
