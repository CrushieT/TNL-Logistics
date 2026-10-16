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

    private Client createClient(String id) {
        return clientRepository.save(new Client(id, id, "Test address", "09170000000", "test@example.com", ChargeModel.FLAT, true));
    }

    private Shipment createShipment(String id, Client client, LocalDate date, String statementId) {
        Shipment shipment = new Shipment(id, client, "Recipient", "Address", "09170000000", 1,
                ChargeModel.FLAT, new BigDecimal("100"), BigDecimal.ZERO, new BigDecimal("100"), false, RegisteredVia.DESKTOP_OFFICE);
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
