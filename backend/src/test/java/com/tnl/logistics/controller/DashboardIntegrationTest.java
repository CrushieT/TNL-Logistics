package com.tnl.logistics.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.DashboardSummaryResponse;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.CollectionsService;
import com.tnl.logistics.service.DashboardService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test verifying GET /api/v1/dashboard/summary contract,
 * RBAC authorization gates, and payload structure.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class DashboardIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @org.springframework.boot.test.mock.mockito.SpyBean
    private com.tnl.logistics.repository.ShipmentRepository shipmentRepository;

    @org.springframework.boot.test.mock.mockito.SpyBean
    private ParcelUnitRepository parcelUnitRepository;

    @Autowired private DashboardService dashboardService;
    @org.springframework.boot.test.mock.mockito.SpyBean
    private CollectionsService collectionsService;
    @Autowired private ClientRepository clientRepository;
    @Autowired private PaymentRepository paymentRepository;
    @Autowired private SoaRepository soaRepository;
    @Autowired private WeeklyCollectionRepository weeklyCollectionRepository;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void testDashboardResolvesCycleDiscoveryOnceAndPassesCalculatedStartToCollectionTotals() {
        LocalDate cycle = LocalDate.of(2036, 1, 10);
        LocalDate expectedStart = collectionsService.calculateCycleStartDate(cycle);
        reset(collectionsService);

        DashboardSummaryResponse response = dashboardService.getDashboardSummary(cycle);
        assertNotNull(response);

        // Verify calculateCycleStartDate was invoked exactly once for the Dashboard summary request
        verify(collectionsService, times(1)).calculateCycleStartDate(eq(cycle));

        // Verify getCollectionTotals was invoked with the pre-calculated cycle start
        verify(collectionsService, times(1)).getCollectionTotals(eq(cycle), eq(expectedStart));

        // Verify single-argument overload was never invoked during Dashboard summary calculation
        verify(collectionsService, never()).getCollectionTotals(eq(cycle));
    }

    @Test
    void testDashboardDefaultCycleResolvesCycleDiscoveryOnceAndPassesCalculatedStart() {
        reset(collectionsService);

        DashboardSummaryResponse response = dashboardService.getDashboardSummary();
        assertNotNull(response);

        // Verify calculateCycleStartDate was invoked exactly once
        verify(collectionsService, times(1)).calculateCycleStartDate(any(LocalDate.class));

        // Verify two-argument getCollectionTotals was invoked with resolved cycle boundary
        verify(collectionsService, times(1)).getCollectionTotals(any(LocalDate.class), any(LocalDate.class));
        verify(collectionsService, never()).getCollectionTotals(any(LocalDate.class));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testGetDashboardSummaryAsAdminReturns200AndExpectedStructure() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shipmentCount").isNumber())
                .andExpect(jsonPath("$.parcelCount").isNumber())
                .andExpect(jsonPath("$.todayShipmentCount").isNumber())
                .andExpect(jsonPath("$.todayDateFormatted").isString())
                .andExpect(jsonPath("$.unpaidTransactionCount").isNumber())
                .andExpect(jsonPath("$.forCollection").exists())
                .andExpect(jsonPath("$.forCollection.amount").isNumber())
                .andExpect(jsonPath("$.parcelUnitsByStatus").isArray())
                .andExpect(jsonPath("$.weeklyShipmentVolume").isArray())
                .andExpect(jsonPath("$.weeklyShipmentVolume.length()").value(7))
                .andExpect(jsonPath("$.weeklyShipmentVolume[0].label").value("Thu"))
                .andExpect(jsonPath("$.weeklyShipmentVolume[6].label").value("Wed"))
                .andExpect(jsonPath("$.forCollection.day").value("Thu"))
                .andExpect(jsonPath("$.outstandingVsCollected").isArray())
                .andExpect(jsonPath("$.recentActivity").isArray());
    }

    @Test
    @WithMockUser(username = "receiving", roles = {"RECEIVING_STAFF"})
    void testGetDashboardSummaryAsOfficeStaffReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "courier", roles = {"COURIER_STAFF"})
    void testGetDashboardSummaryAsFieldStaffReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    void testGetDashboardSummaryUnauthenticatedReturns401Unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testGetDashboardSummaryWithSpecificCycleReturns200() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/summary")
                .param("cycle", "2026-09-03")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shipmentCount").isNumber())
                .andExpect(jsonPath("$.weeklyShipmentVolume.length()").value(7));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testDashboardFailureReturnsHttp503AndStructuredErrorViaMockMvc() throws Exception {
        org.mockito.Mockito.doThrow(new org.springframework.dao.DataAccessResourceFailureException("Simulated DB connection failure"))
                .when(shipmentRepository).getCycleShipmentSummary(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());

        try {
            mockMvc.perform(get("/api/v1/dashboard/summary")
                    .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.status").value(503))
                    .andExpect(jsonPath("$.code").value("DASHBOARD_UNAVAILABLE"))
                    .andExpect(jsonPath("$.message").value("Dashboard data is temporarily unavailable due to a database error"));
        } finally {
            org.mockito.Mockito.reset(shipmentRepository);
        }
    }

    @Test
    void preservesFinancialStatesLatePaymentsAndOrderedParcelSegments() {
        LocalDate cycle = LocalDate.of(2036, 1, 10);
        Client client = createClient("DASH-STATES");
        Shipment unpaid = createShipment("DASH-UNPAID", client, cycle.minusDays(7).atStartOfDay(), 1, "100");
        Shipment partial = createShipment("DASH-PARTIAL", client, cycle.minusDays(3).atTime(12, 0), 2, "200");
        Shipment paid = createShipment("DASH-PAID", client, cycle.minusDays(1).atTime(23, 59, 59), 1, "100");
        Shipment overpaid = createShipment("DASH-OVERPAID", client, cycle.minusDays(1).atTime(12, 0), 1, "50");
        Shipment zero = createShipment("DASH-ZERO", client, cycle.minusDays(1).atTime(12, 0), 1, "0");
        Shipment zeroPaid = createShipment("DASH-ZERO-PAID", client, cycle.minusDays(1).atTime(12, 0), 1, "0");
        createShipment("DASH-BEFORE", client, cycle.minusDays(8).atTime(23, 59, 59), 9, "999");
        createShipment("DASH-AFTER", client, cycle.atStartOfDay(), 9, "999");
        paymentRepository.saveAllAndFlush(List.of(
                new Payment(partial, new BigDecimal("20"), PaymentMethod.CASH, cycle),
                new Payment(partial, new BigDecimal("30"), PaymentMethod.CASH, cycle.plusDays(10)),
                new Payment(paid, new BigDecimal("100"), PaymentMethod.CASH, cycle.plusDays(10)),
                new Payment(overpaid, new BigDecimal("75"), PaymentMethod.CASH, cycle),
                new Payment(zeroPaid, new BigDecimal("5"), PaymentMethod.CASH, cycle)));
        createParcel("DASH-P-REGISTERED", unpaid, 1, ParcelStatus.REGISTERED, false);
        createParcel("DASH-P-COMPLETED", partial, 1, ParcelStatus.COMPLETED, false);
        createParcel("DASH-P-LOST-COMP", partial, 2, ParcelStatus.COMPLETED, true);
        createParcel("DASH-P-QR", paid, 1, ParcelStatus.QR_GENERATED, false);
        createParcel("DASH-P-LOST-LOAD", overpaid, 1, ParcelStatus.LOADED_ON_TRUCK, true);
        createParcel("DASH-P-ARRIVED", zero, 1, ParcelStatus.ARRIVED_AT_TNL, false);
        createParcel("DASH-P-HAULER", zeroPaid, 1, ParcelStatus.LOADED_TO_HAULER, false);

        DashboardSummaryResponse response = assertMatchesExistingCalculation(cycle);
        assertEquals(6, response.getShipmentCount());
        assertEquals(7, response.getParcelCount());
        assertEquals(2, response.getUnpaidTransactionCount());
        assertAmount("220", response.getOutstandingVsCollected().get(0).getValue());
        assertAmount("230", response.getOutstandingVsCollected().get(1).getValue());
        var segments = response.getParcelUnitsByStatus();
        assertEquals(List.of("Registered", "QR Generated", "Loaded on Truck", "Arrived in Daet",
                "Loaded to Hauler", "Completed", "Lost"), segments.stream().map(segment -> segment.getLabel()).toList());
        assertEquals(List.of(1L, 1L, 0L, 1L, 1L, 1L, 2L), segments.stream().map(segment -> segment.getValue()).toList());
        assertEquals(List.of("#2563EB", "#0D9488", "#D97706", "#16A34A", "#7C3AED", "#059669", "#B91C1C"),
                segments.stream().map(segment -> segment.getColor()).toList());
    }

    @Test
    void preservesOptionalSegmentsAndGlobalOverpaymentClamping() {
        LocalDate cycle = LocalDate.of(2036, 2, 7);
        Client client = createClient("DASH-OPTIONAL");
        Shipment shipment = createShipment("DASH-OPTIONAL-S", client, cycle.minusDays(1).atTime(12, 0), 1, "10");
        paymentRepository.saveAndFlush(new Payment(shipment, new BigDecimal("20"), PaymentMethod.CASH, cycle.plusDays(1)));
        ParcelUnit parcel = createParcel("DASH-OPTIONAL-P", shipment, 1, ParcelStatus.COMPLETED, true);
        DashboardSummaryResponse lostResponse = assertMatchesExistingCalculation(cycle);
        assertEquals(0, lostResponse.getUnpaidTransactionCount());
        assertAmount("0", lostResponse.getOutstandingVsCollected().get(0).getValue());
        assertAmount("20", lostResponse.getOutstandingVsCollected().get(1).getValue());
        assertEquals(List.of("Registered", "QR Generated", "Loaded on Truck", "Arrived in Daet",
                "Loaded to Hauler", "Lost"), lostResponse.getParcelUnitsByStatus().stream().map(segment -> segment.getLabel()).toList());
        parcel.setLost(false);
        parcelUnitRepository.saveAndFlush(parcel);
        DashboardSummaryResponse recoveredResponse = assertMatchesExistingCalculation(cycle);
        assertEquals(List.of("Registered", "QR Generated", "Loaded on Truck", "Arrived in Daet",
                "Loaded to Hauler", "Completed"), recoveredResponse.getParcelUnitsByStatus().stream().map(segment -> segment.getLabel()).toList());
        assertEquals(1L, recoveredResponse.getParcelUnitsByStatus().get(5).getValue());
    }

    @Test
    void preservesCollectionsDeductionsStatementEligibilityAndSoaOnlyClients() {
        LocalDate cycle = LocalDate.of(2036, 2, 14);
        Client overpaidClient = createClient("DASH-COLL-OVER");
        Client partialClient = createClient("DASH-COLL-PART");
        Client soaOnlyClient = createClient("DASH-COLL-ONLY");
        Shipment overpaid = createShipment("DASH-COLL-OVER-S", overpaidClient, cycle.minusDays(1).atTime(12, 0), 1, "200");
        Shipment partial = createShipment("DASH-COLL-PART-S", partialClient, cycle.minusDays(1).atTime(12, 0), 1, "300");
        Soa historical = createSoa("DASH-COLL-HIST", partialClient, cycle.minusDays(7), "0");
        Shipment historicalShipment = createShipment("DASH-COLL-HIST-S", partialClient, cycle.minusDays(2).atTime(12, 0), 1, "100");
        historicalShipment.setStatementId(historical.getSoaNo());
        shipmentRepository.saveAndFlush(historicalShipment);
        createSoa("DASH-COLL-CURRENT", partialClient, cycle, "50");
        createSoa("DASH-COLL-SOA-ONLY", soaOnlyClient, cycle, "20");
        paymentRepository.saveAllAndFlush(List.of(
                new Payment(overpaid, new BigDecimal("250"), PaymentMethod.CASH, cycle),
                new Payment(partial, new BigDecimal("100"), PaymentMethod.CASH, cycle.plusDays(10))));

        DashboardSummaryResponse response = assertMatchesExistingCalculation(cycle);
        assertEquals(3, response.getShipmentCount());
        assertEquals(2, response.getUnpaidTransactionCount());
        assertAmount("250", response.getOutstandingVsCollected().get(0).getValue());
        assertAmount("350", response.getOutstandingVsCollected().get(1).getValue());
        assertAmount("150", response.getForCollection().getAmount());
        var collections = collectionsService.getWeeklyCollections(cycle);
        assertAmount("150", collections.getOutstandingBalance());
        assertEquals(3, collections.getItems().size());
        assertEquals(collections.getActiveClientsCount(), response.getForCollection().getClientCount());
        assertTrue(collections.getItems().stream().anyMatch(item -> item.getClientId().equals(soaOnlyClient.getClientId())
                && item.getShipmentsCount() == 0));
    }

    @Test
    void preservesEmptyCycleZerosAndSegmentOmission() {
        DashboardSummaryResponse response = assertMatchesExistingCalculation(LocalDate.of(2036, 3, 7));
        assertEquals(0, response.getShipmentCount());
        assertEquals(0, response.getParcelCount());
        assertEquals(0, response.getUnpaidTransactionCount());
        assertEquals(5, response.getParcelUnitsByStatus().size());
        assertTrue(response.getParcelUnitsByStatus().stream().allMatch(segment -> segment.getValue() == 0));
        assertTrue(response.getWeeklyShipmentVolume().stream().allMatch(point -> point.getValue() == 0));
        response.getOutstandingVsCollected().forEach(row -> assertAmount("0", row.getValue()));
    }

    @Test
    void preservesExistingJdbcPrecisionAtNextMidnightBoundary() {
        LocalDate cycle = LocalDate.of(2036, 3, 14);
        Client client = createClient("DASH-BOUNDARY");
        Shipment boundary = createShipment("DASH-BOUNDARY-S", client, cycle.atStartOfDay(), 1, "125.25");
        createParcel("DASH-BOUNDARY-P", boundary, 1, ParcelStatus.COMPLETED, true);
        DashboardSummaryResponse response = assertMatchesExistingCalculation(cycle);
        assertEquals(shipmentRepository.countShipmentsRegisteredBetween(cycle.minusDays(7).atStartOfDay(),
                cycle.atStartOfDay()), response.getShipmentCount());
    }

    private DashboardSummaryResponse assertMatchesExistingCalculation(LocalDate cycle) {
        DashboardSummaryResponse actual = dashboardService.getDashboardSummary(cycle);
        doAnswer(invocation -> {
            LocalDateTime start = invocation.getArgument(0);
            LocalDateTime end = invocation.getArgument(1);
            long shipmentCount = shipmentRepository.countShipmentsRegisteredBetween(start, end);
            long parcelCount = shipmentRepository.countParcelsRegisteredBetween(start, end);
            BigDecimal totalCharges = shipmentRepository.sumTotalShipmentChargesBetween(start, end);
            long unpaidCount = shipmentRepository.countUnpaidShipmentsBetween(start, end);
            BigDecimal collected = shipmentRepository.sumTotalPaymentsBetween(start, end);
            CycleShipmentSummary legacy = mock(CycleShipmentSummary.class);
            when(legacy.getShipmentCount()).thenReturn(shipmentCount);
            when(legacy.getParcelCount()).thenReturn(parcelCount);
            when(legacy.getTotalCharges()).thenReturn(totalCharges);
            when(legacy.getUnpaidShipmentCount()).thenReturn(unpaidCount);
            when(legacy.getCollectedPayments()).thenReturn(collected);
            return legacy;
        }).when(shipmentRepository).getCycleShipmentSummary(any(), any());
        doAnswer(invocation -> {
            LocalDateTime start = invocation.getArgument(0);
            LocalDateTime end = invocation.getArgument(1);
            List<Object[]> rows = new ArrayList<>();
            for (Object[] row : parcelUnitRepository.countParcelsGroupedByStatusBetween(start, end)) {
                rows.add(new Object[]{false, row[0], row[1]});
            }
            long lostCount = parcelUnitRepository.countLostParcelsBetween(start, end);
            if (lostCount > 0) {
                rows.add(new Object[]{true, ParcelStatus.REGISTERED, lostCount});
            }
            return rows;
        }).when(parcelUnitRepository).countParcelsGroupedByLossAndStatusBetween(any(), any());
        try {
            DashboardSummaryResponse expected = dashboardService.getDashboardSummary(cycle);
            assertEquals(objectMapper.valueToTree(expected), objectMapper.valueToTree(actual),
                    "Every Dashboard response field must match the existing calculations");
        } finally {
            reset(shipmentRepository, parcelUnitRepository);
        }
        return actual;
    }

    private Client createClient(String id) {
        return clientRepository.saveAndFlush(new Client(id, id, "Test address", "09170000000",
                "test@example.com", ChargeModel.FLAT, true));
    }

    private Shipment createShipment(String id, Client client, LocalDateTime registeredAt, int quantity, String amount) {
        BigDecimal charges = new BigDecimal(amount);
        Shipment shipment = new Shipment(id, client, "Recipient", "Address", "09170000000", quantity,
                ChargeModel.FLAT, charges, BigDecimal.ZERO, charges, false, RegisteredVia.DESKTOP_OFFICE);
        shipment.setDateRegistered(registeredAt);
        return shipmentRepository.saveAndFlush(shipment);
    }

    private ParcelUnit createParcel(String id, Shipment shipment, int sequence, ParcelStatus status, boolean isLost) {
        ParcelUnit parcel = new ParcelUnit(id, shipment, sequence, BigDecimal.ONE, BigDecimal.ONE,
                BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE);
        parcel.setCurrentStatus(status);
        parcel.setLost(isLost);
        return parcelUnitRepository.saveAndFlush(parcel);
    }

    private Soa createSoa(String id, Client client, LocalDate cycle, String deductions) {
        WeeklyCollection collection = weeklyCollectionRepository.save(new WeeklyCollection(id, client,
                cycle.minusDays(6), cycle, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, "PENDING"));
        return soaRepository.saveAndFlush(new Soa(id, null, collection, client, new BigDecimal("100"),
                BigDecimal.ZERO, new BigDecimal(deductions), null, BigDecimal.ZERO,
                BigDecimal.ZERO, null, cycle, null));
    }

    private void assertAmount(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual));
    }
}
