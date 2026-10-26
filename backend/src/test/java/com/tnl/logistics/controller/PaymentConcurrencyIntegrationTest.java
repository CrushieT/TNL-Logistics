package com.tnl.logistics.controller;

import com.tnl.logistics.dto.PaymentRecordRequest;
import com.tnl.logistics.dto.SaveStatementRequest;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class PaymentConcurrencyIntegrationTest {
    @Autowired PaymentService paymentService;
    @Autowired SoaService soaService;
    @Autowired CollectionsService collectionService;
    @Autowired ClientRepository clients;
    @Autowired ShipmentRepository shipments;
    @Autowired SoaRepository statements;
    @Autowired WeeklyCollectionRepository collections;
    @Autowired PaymentRepository payments;
    @Autowired AppUserRepository users;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired JdbcTemplate jdbc;
    private final List<String> clientIds = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        for (String clientId : clientIds) {
            jdbc.update("DELETE FROM payment WHERE shipment_id IN (SELECT shipment_id FROM shipment WHERE client_id = ?)", clientId);
            jdbc.update("UPDATE shipment SET statement_id = NULL WHERE client_id = ?", clientId);
            jdbc.update("DELETE FROM shipment WHERE client_id = ?", clientId);
            jdbc.update("DELETE FROM soa WHERE client_id = ?", clientId);
            jdbc.update("DELETE FROM soa_batch WHERE collection_id IN (SELECT collection_id FROM weekly_collection WHERE client_id = ?)", clientId);
            jdbc.update("DELETE FROM weekly_collection WHERE client_id = ?", clientId);
            jdbc.update("DELETE FROM client WHERE client_id = ?", clientId);
        }
    }

    @Test
    void differentShipmentsCannotOvercollectTheirSharedStatement() throws Exception {
        Fixture fixture = createFixture(2, "800.00");
        List<Integer> outcomes = race(() -> pay(fixture.shipmentIds().get(0), "150.00"),
                () -> pay(fixture.shipmentIds().get(1), "150.00"));
        assertEquals(List.of(201, 400), outcomes.stream().sorted().toList());
        assertTotals(fixture, "150.00", "50.00");
    }

    @Test
    void concurrentValidPartialPaymentsBothContributeToTotals() throws Exception {
        Fixture fixture = createFixture(2, "800.00");
        assertEquals(List.of(201, 201), race(() -> pay(fixture.shipmentIds().get(0), "100.00"),
                () -> pay(fixture.shipmentIds().get(1), "100.00")));
        assertTotals(fixture, "200.00", "0.00");
    }

    @Test
    void sameShipmentPaymentsRemainSerialized() throws Exception {
        Fixture fixture = createFixture(1, "300.00");
        assertEquals(List.of(201, 409), race(() -> pay(fixture.shipmentIds().getFirst(), "200.00"),
                () -> pay(fixture.shipmentIds().getFirst(), "200.00")).stream().sorted().toList());
        assertTotals(fixture, "200.00", "0.00");
    }

    @Test
    void deductionEditAndPaymentHaveASerialFinancialOutcome() throws Exception {
        Fixture fixture = createFixture(1, "300.00");
        String adminId = users.findByRoleAndActiveTrue(UserRole.ADMIN).getFirst().getUserId();
        List<Integer> outcomes = race(() -> pay(fixture.shipmentIds().getFirst(), "200.00"), () -> {
            try {
                soaService.saveStatement(new SaveStatementRequest(fixture.clientId(), LocalDate.now(),
                        new BigDecimal("400.00"), "Concurrent adjustment", "Collector"), adminId);
                return 201;
            } catch (IllegalArgumentException exception) {
                return 400;
            }
        });
        assertEquals(List.of(201, 400), outcomes.stream().sorted().toList());
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            Soa statement = statements.findById(fixture.statementId()).orElseThrow();
            BigDecimal ledgerPaid = payments.findByShipment_ShipmentIdIn(fixture.shipmentIds()).stream()
                    .map(Payment::getAmountPaid).reduce(BigDecimal.ZERO, BigDecimal::add);
            assertEquals(0, ledgerPaid.compareTo(statement.getTotalPaid()));
            assertEquals(0, statement.getCurrentCharges().subtract(statement.getDeductions()).subtract(ledgerPaid)
                    .compareTo(statement.getOutstandingBalance()));
            assertTrue(statement.getOutstandingBalance().signum() >= 0);
        });
    }

    @Test
    void firstStatementLinkingAndPaymentPreserveTheLedger() throws Exception {
        Fixture fixture = createFixture(1, "0.00");
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            Shipment shipment = shipments.findById(fixture.shipmentIds().getFirst()).orElseThrow();
            shipment.setStatementId(null);
            shipments.saveAndFlush(shipment);
            statements.deleteById(fixture.statementId());
        });
        String adminId = users.findByRoleAndActiveTrue(UserRole.ADMIN).getFirst().getUserId();
        assertEquals(List.of(201, 201), race(() -> pay(fixture.shipmentIds().getFirst(), "100.00"), () -> {
            soaService.saveStatement(new SaveStatementRequest(fixture.clientId(), LocalDate.now(),
                    new BigDecimal("300.00"), "First statement", "Collector"), adminId);
            return 201;
        }));
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            Shipment shipment = shipments.findById(fixture.shipmentIds().getFirst()).orElseThrow();
            assertNotNull(shipment.getStatementId());
            Soa statement = statements.findById(shipment.getStatementId()).orElseThrow();
            assertEquals(0, new BigDecimal("100.00").compareTo(statement.getTotalPaid()));
            assertEquals(0, new BigDecimal("100.00").compareTo(statement.getOutstandingBalance()));
            List<Payment> ledger = payments.findByShipment_ShipmentId(shipment.getShipmentId());
            assertEquals(1, ledger.size());
            assertEquals(statement.getSoaNo(), ledger.getFirst().getStatementId());
        });
    }

    @Test
    void anUncommittedPaymentDoesNotBlockAnIndependentStatement() throws Exception {
        Fixture first = createFixture(1, "300.00");
        Fixture second = createFixture(1, "300.00");
        CountDownLatch firstPaymentWritten = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            TransactionTemplate firstTransaction = new TransactionTemplate(transactionManager);
            firstTransaction.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_READ_COMMITTED);
            Future<?> pending = executor.submit(() -> firstTransaction.executeWithoutResult(status -> {
                pay(first.shipmentIds().getFirst(), "100.00");
                firstPaymentWritten.countDown();
                await(releaseFirst);
            }));
            assertTrue(firstPaymentWritten.await(10, TimeUnit.SECONDS));
            Future<Integer> independent = executor.submit(() -> pay(second.shipmentIds().getFirst(), "100.00"));
            assertEquals(201, independent.get(5, TimeUnit.SECONDS));
            releaseFirst.countDown();
            pending.get(10, TimeUnit.SECONDS);
            assertTotals(first, "100.00", "100.00");
            assertTotals(second, "100.00", "100.00");
        } finally {
            releaseFirst.countDown();
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(20, TimeUnit.SECONDS));
        }
    }

    private int pay(String shipmentId, String amount) {
        try {
            paymentService.recordPayment(new PaymentRecordRequest(shipmentId, new BigDecimal(amount),
                    PaymentMethod.CASH, null, LocalDate.now(), null), null);
            return 201;
        } catch (ResponseStatusException exception) {
            return exception.getStatusCode().value();
        } catch (IllegalArgumentException exception) {
            return 400;
        }
    }

    private List<Integer> race(Supplier<Integer> first, Supplier<Integer> second) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Integer>> futures = List.of(first, second).stream().map(operation -> executor.submit(() -> {
                ready.countDown();
                await(start);
                return operation.get();
            })).toList();
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            return List.of(futures.get(0).get(15, TimeUnit.SECONDS), futures.get(1).get(15, TimeUnit.SECONDS));
        } finally {
            start.countDown();
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(20, TimeUnit.SECONDS));
        }
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(10, TimeUnit.SECONDS)) throw new AssertionError("Concurrent transaction did not reach its checkpoint");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AssertionError(exception);
        }
    }

    private Fixture createFixture(int shipmentCount, String deduction) {
        return new TransactionTemplate(transactionManager).execute(status -> {
            String suffix = UUID.randomUUID().toString().substring(0, 8);
            String clientId = "CL-PAY-" + suffix;
            clientIds.add(clientId);
            Client client = clients.save(new Client(clientId, "Payment race " + suffix, "Address", "09170000000",
                    null, ChargeModel.FLAT, true));
            LocalDate closingDate = collectionService.calculateActiveCycleDate(LocalDate.now());
            BigDecimal charges = new BigDecimal("500.00").multiply(BigDecimal.valueOf(shipmentCount));
            BigDecimal balance = charges.subtract(new BigDecimal(deduction));
            WeeklyCollection collection = collections.save(new WeeklyCollection("COL-PAY-" + suffix, client,
                    collectionService.calculateCycleStartDate(closingDate), closingDate, charges, BigDecimal.ZERO, balance, "FOR_COLLECTION"));
            Soa statement = statements.save(new Soa("SOA-PAY-" + suffix, null, collection, client, BigDecimal.ZERO,
                    charges, new BigDecimal(deduction), "Adjustment", BigDecimal.ZERO, balance, "Collector", closingDate, null));
            List<String> shipmentIds = new ArrayList<>();
            for (int index = 0; index < shipmentCount; index++) {
                Shipment shipment = new Shipment("SHP-PAY-" + suffix + index, client, client.getName(), "Address", "09170000000", 1,
                        ChargeModel.FLAT, new BigDecimal("500.00"), BigDecimal.ZERO, new BigDecimal("500.00"), false, RegisteredVia.DESKTOP_OFFICE);
                shipment.setStatementId(statement.getSoaNo());
                shipments.save(shipment);
                shipmentIds.add(shipment.getShipmentId());
            }
            return new Fixture(clientId, statement.getSoaNo(), collection.getCollectionId(), shipmentIds);
        });
    }

    private void assertTotals(Fixture fixture, String paid, String balance) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            Soa statement = statements.findById(fixture.statementId()).orElseThrow();
            WeeklyCollection collection = collections.findById(fixture.collectionId()).orElseThrow();
            BigDecimal ledgerPaid = payments.findByShipment_ShipmentIdIn(fixture.shipmentIds()).stream()
                    .map(Payment::getAmountPaid).reduce(BigDecimal.ZERO, BigDecimal::add);
            assertEquals(0, new BigDecimal(paid).compareTo(ledgerPaid));
            assertEquals(0, ledgerPaid.compareTo(statement.getTotalPaid()));
            assertEquals(0, ledgerPaid.compareTo(collection.getTotalPaid()));
            assertEquals(0, new BigDecimal(balance).compareTo(statement.getOutstandingBalance()));
            assertEquals(0, statement.getOutstandingBalance().compareTo(collection.getBalance()));
        });
    }

    private record Fixture(String clientId, String statementId, String collectionId, List<String> shipmentIds) {}
}
