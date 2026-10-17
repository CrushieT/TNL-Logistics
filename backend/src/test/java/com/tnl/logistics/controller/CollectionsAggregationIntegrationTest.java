package com.tnl.logistics.controller;

import com.tnl.logistics.dto.WeeklyClientCollectionItem;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.CollectionsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class CollectionsAggregationIntegrationTest {
    @Autowired private CollectionsService collectionsService;
    @Autowired private ShipmentRepository shipmentRepository;
    @Autowired private ClientRepository clientRepository;
    @Autowired private PaymentRepository paymentRepository;
    @Autowired private SoaRepository soaRepository;
    @Autowired private WeeklyCollectionRepository weeklyCollectionRepository;

    @Test
    void preservesFinancialRulesAcrossClientsAndCycleBoundaries() {
        LocalDate cycle = LocalDate.of(2036, 1, 10);
        Client partialClient = createClient("AGG-PARTIAL");
        Client settledClient = createClient("AGG-SETTLED");
        Client soaOnlyClient = createClient("AGG-SOA-ONLY");
        Shipment partial = createShipment("AGG-PARTIAL-1", partialClient, cycle.minusDays(6), null);
        createShipment("AGG-PARTIAL-2", partialClient, cycle, null);
        createShipment("AGG-BEFORE", partialClient, cycle.minusDays(7), null);
        createShipment("AGG-AFTER", partialClient, cycle.plusDays(1), null);
        Soa historical = createSoa("AGG-HIST", partialClient, cycle.minusDays(7), "0");
        createShipment("AGG-HIST-SHIP", partialClient, cycle, historical.getSoaNo());
        Soa settledSoa = createSoa("AGG-CURRENT", settledClient, cycle, "150");
        Shipment settled = createShipment("AGG-SETTLED-1", settledClient, cycle, settledSoa.getSoaNo());
        createSoa("AGG-ONLY", soaOnlyClient, cycle, "0");
        paymentRepository.saveAllAndFlush(List.of(
                new Payment(partial, new BigDecimal("20"), PaymentMethod.CASH, cycle.minusDays(1)),
                new Payment(partial, new BigDecimal("30"), PaymentMethod.CASH, cycle.plusDays(10)),
                new Payment(settled, new BigDecimal("100"), PaymentMethod.CASH, cycle)));

        var response = collectionsService.getWeeklyCollections(cycle);
        assertEquals(3, response.getItems().size());
        assertEquals(0, new BigDecimal("300").compareTo(response.getTotalDue()),
                () -> "Items: " + response.getItems().stream().map(item -> item.getClientId() + ":" + item.getShipmentsCount() + ":" + item.getCurrentCharges()).toList()
                        + "; legacy shipments: " + shipmentRepository.findByDateRegisteredBetweenOrderByDateRegisteredDesc(
                                collectionsService.calculateCycleStartDate(cycle).atStartOfDay(), cycle.atTime(23, 59, 59, 999999999))
                        .stream().map(Shipment::getShipmentId).toList());
        assertAmount("150", response.getTotalCollected());
        assertAmount("150", response.getOutstandingBalance());
        assertEquals(1, response.getActiveClientsCount());
        WeeklyClientCollectionItem partialItem = findItem(response.getItems(), partialClient);
        assertEquals(2, partialItem.getShipmentsCount());
        assertEquals(2, partialItem.getUnbilledShipmentsCount());
        assertAmount("200", partialItem.getCurrentCharges());
        assertAmount("50", partialItem.getPaid());
        assertAmount("150", partialItem.getNetAmountDue());
        assertEquals("READY_FOR_SOA", partialItem.getStatus());
        WeeklyClientCollectionItem settledItem = findItem(response.getItems(), settledClient);
        assertAmount("0", settledItem.getNetAmountDue());
        assertEquals("SETTLED", settledItem.getStatus());
        WeeklyClientCollectionItem soaOnlyItem = findItem(response.getItems(), soaOnlyClient);
        assertEquals(0, soaOnlyItem.getShipmentsCount());
        assertAmount("0", soaOnlyItem.getPreviousBalance());
        assertEquals("SOA_GENERATED", soaOnlyItem.getStatus());
        assertTrue(collectionsService.getWeeklyCollections(cycle.plusDays(100)).getItems().isEmpty());
    }

    @Autowired private com.tnl.logistics.service.DashboardService dashboardService;

    @Test
    void testCollectionsAndDashboardParityWithPerClientClampingAndDeductions() {
        LocalDate cycle = LocalDate.of(2036, 2, 14);

        // Client 1: Overpaid (charges 200, paid 250 -> balance clamped to 0)
        Client overpaidClient = createClient("AGG-CLAMP-OVERPAID");
        Shipment shipOver = createShipment("SHP-CLAMP-1", overpaidClient, cycle.minusDays(2), null, new BigDecimal("200.00"));
        paymentRepository.saveAndFlush(new Payment(shipOver, new BigDecimal("250.00"), PaymentMethod.CASH, cycle.minusDays(1)));

        // Client 2: Partial with deduction (charges 300, paid 100, deduction 50 -> netDue 150)
        Client partialClient = createClient("AGG-CLAMP-PARTIAL");
        Shipment shipPart = createShipment("SHP-CLAMP-2", partialClient, cycle.minusDays(3), null, new BigDecimal("300.00"));
        paymentRepository.saveAndFlush(new Payment(shipPart, new BigDecimal("100.00"), PaymentMethod.CASH, cycle.minusDays(2)));
        createSoa("SOA-CLAMP-2", partialClient, cycle, "50.00");

        // Client 3: SOA-only client (no shipments this cycle, previousBalance 100, deduction 20 -> netDue 80)
        Client soaOnlyClient = createClient("AGG-CLAMP-SOAONLY");
        WeeklyCollection wc3 = weeklyCollectionRepository.save(new WeeklyCollection("WC-CLAMP-3", soaOnlyClient,
                cycle.minusDays(6), cycle, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, "PENDING"));
        soaRepository.saveAndFlush(new Soa("SOA-CLAMP-3", null, wc3, soaOnlyClient, new BigDecimal("100.00"),
                BigDecimal.ZERO, new BigDecimal("20.00"), null, BigDecimal.ZERO,
                new BigDecimal("80.00"), null, cycle, null));

        // 1. Full Weekly Collections response
        var weeklyResponse = collectionsService.getWeeklyCollections(cycle);

        // 2. Internal Totals-only read
        var collectionTotals = collectionsService.getCollectionTotals(cycle);

        // 3. Dashboard summary
        var dashboardSummary = dashboardService.getDashboardSummary(cycle);

        // Assert exact financial equality across all representations
        assertEquals(weeklyResponse.getOutstandingBalance(), collectionTotals.outstandingBalance(),
                "Outstanding balance must match between weeklyCollections and collectionTotals");
        assertEquals(weeklyResponse.getActiveClientsCount(), collectionTotals.activeClientsCount(),
                "Active clients count must match between weeklyCollections and collectionTotals");

        assertEquals(0, collectionTotals.outstandingBalance().compareTo(dashboardSummary.getForCollection().getAmount()),
                "Dashboard forCollection amount must match collectionTotals outstandingBalance");
        assertEquals(collectionTotals.activeClientsCount(), dashboardSummary.getForCollection().getClientCount(),
                "Dashboard forCollection clientCount must match collectionTotals activeClientsCount");

        // Expected outstanding balance:
        // Client 1: max(0, 200 - 250) = 0
        // Client 2: max(0, 300 - 100 - 50) = 150
        // Client 3 (SOA-only, 0 shipments): max(0, 0 - 0 - 20) = 0
        // Total Outstanding = 0 + 150 + 0 = 150.00
        assertAmount("150.00", collectionTotals.outstandingBalance());
        assertEquals(2, collectionTotals.activeClientsCount(), "Only clients with unbilled shipments or net balance > 0 qualify as active");
    }

    private Client createClient(String id) {
        return clientRepository.save(new Client(id, id, "Test address", "09170000000", "test@example.com", ChargeModel.FLAT, true));
    }

    private Shipment createShipment(String id, Client client, LocalDate date, String statementId) {
        return createShipment(id, client, date, statementId, new BigDecimal("100"));
    }

    private Shipment createShipment(String id, Client client, LocalDate date, String statementId, BigDecimal amount) {
        BigDecimal fee = amount != null ? amount : new BigDecimal("100");
        Shipment shipment = new Shipment(id, client, "Recipient", "Address", "09170000000", 1,
                ChargeModel.FLAT, fee, BigDecimal.ZERO, fee, false, RegisteredVia.DESKTOP_OFFICE);
        shipment.setDateRegistered(date.atTime(12, 0));
        shipment.setStatementId(statementId);
        return shipmentRepository.saveAndFlush(shipment);
    }

    private Soa createSoa(String id, Client client, LocalDate cycle, String deductions) {
        WeeklyCollection collection = weeklyCollectionRepository.save(new WeeklyCollection(id, client,
                cycle.minusDays(6), cycle, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, "PENDING"));
        return soaRepository.saveAndFlush(new Soa(id, null, collection, client, new BigDecimal("999"),
                new BigDecimal("999"), new BigDecimal(deductions), null, BigDecimal.ZERO,
                new BigDecimal("999"), null, cycle, null));
    }

    private WeeklyClientCollectionItem findItem(List<WeeklyClientCollectionItem> items, Client client) {
        return items.stream().filter(item -> item.getClientId().equals(client.getClientId())).findFirst().orElseThrow();
    }

    private void assertAmount(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual));
    }
}
