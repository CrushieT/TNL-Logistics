package com.tnl.logistics.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Integration test verifying GET /api/v1/reports/summary operational and
 * financial reporting engine, RBAC access control, and query parameter filtering.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class ReportIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @Autowired
    private ClientRepository clientRepository;

    @org.springframework.boot.test.mock.mockito.SpyBean
    private ShipmentRepository shipmentRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private ParcelUnitRepository parcelUnitRepository;

    @Autowired
    private SoaRepository soaRepository;

    @Autowired
    private com.tnl.logistics.service.CollectionsService collectionsService;

    @Autowired
    private WeeklyCollectionRepository weeklyCollectionRepository;

    private ParcelUnit createParcel(String trackingId, Shipment shipment, int seq, ParcelStatus status, boolean lost, BigDecimal weight, BigDecimal volume) {
        ParcelUnit p = new ParcelUnit();
        p.setTrackingId(trackingId);
        p.setShipment(shipment);
        p.setSeq(seq);
        p.setCurrentStatus(status);
        p.setLost(lost);
        p.setWeightKg(weight != null ? weight : new BigDecimal("2.50"));
        p.setLengthCm(new BigDecimal("20.00"));
        p.setWidthCm(new BigDecimal("20.00"));
        p.setHeightCm(new BigDecimal("20.00"));
        p.setVolumeCbm(volume != null ? volume : new BigDecimal("0.0080"));
        return parcelUnitRepository.save(p);
    }

    private Soa createSoa(String soaNo, Client client, LocalDate statementDate, BigDecimal deductions, String reason) {
        WeeklyCollection collection = weeklyCollectionRepository.save(new WeeklyCollection(
                "COL-" + soaNo,
                client,
                statementDate.minusDays(6),
                statementDate,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                "PENDING"
        ));
        Soa soa = new Soa(
                soaNo,
                null,
                collection,
                client,
                new BigDecimal("1000.00"),
                new BigDecimal("1000.00"),
                deductions != null ? deductions : BigDecimal.ZERO,
                reason,
                BigDecimal.ZERO,
                new BigDecimal("1000.00").subtract(deductions != null ? deductions : BigDecimal.ZERO),
                "Staff",
                statementDate,
                null
        );
        return soaRepository.save(soa);
    }

    private Client createOrGetClient(String id, String name) {
        return clientRepository.findById(id).orElseGet(() -> {
            Client c = new Client();
            c.setClientId(id);
            c.setName(name);
            c.setContactNumber("0917-111-2222");
            c.setAddress("Test City");
            c.setActive(true);
            return clientRepository.save(c);
        });
    }

    private Shipment createShipment(String id, Client client, BigDecimal totalAmount, LocalDateTime regDate) {
        Shipment s = new Shipment();
        s.setShipmentId(id);
        s.setClient(client);
        s.setRecipientName("Recipient " + id);
        s.setRecipientAddress("Address " + id);
        s.setRecipientContact("0912-345-6789");
        s.setQuantity(1);
        s.setChargeModel(ChargeModel.FLAT);
        s.setShippingFee(totalAmount);
        s.setOtherCharges(BigDecimal.ZERO);
        s.setTotalAmount(totalAmount);
        s.setPaidAtRegistration(false);
        s.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        s.setDateRegistered(regDate);
        return shipmentRepository.save(s);
    }

    private Payment recordPayment(Shipment shipment, BigDecimal amount, PaymentMethod method, LocalDate paymentDate) {
        Payment p = new Payment(shipment, amount, method, paymentDate);
        return paymentRepository.save(p);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testGetReportSummaryAsAdminReturns200AndStructure() throws Exception {
        mockMvc.perform(get("/api/v1/reports/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.startDate").isNotEmpty())
                .andExpect(jsonPath("$.endDate").isNotEmpty())
                .andExpect(jsonPath("$.kpis").isMap())
                .andExpect(jsonPath("$.kpis.totalBilledRevenue").isNumber())
                .andExpect(jsonPath("$.kpis.totalCollectedRevenue").isNumber())
                .andExpect(jsonPath("$.kpis.outstandingReceivables").isNumber())
                .andExpect(jsonPath("$.kpis.totalShipments").isNumber())
                .andExpect(jsonPath("$.kpis.totalParcels").isNumber())
                .andExpect(jsonPath("$.kpis.deliveryCompletionRate").isNumber())
                .andExpect(jsonPath("$.clientRevenue").isArray())
                .andExpect(jsonPath("$.paymentMethods").isArray())
                .andExpect(jsonPath("$.deductions").isArray())
                .andExpect(jsonPath("$.dailyVolume").isArray())
                .andExpect(jsonPath("$.statusDistribution").isArray())
                .andExpect(jsonPath("$.receivablesAging").isArray());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testGetReportSummaryAsAdminReturns200() throws Exception {
        mockMvc.perform(get("/api/v1/reports/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kpis").exists());
    }

    @Test
    @WithMockUser(username = "courier", roles = {"COURIER_STAFF"})
    void testGetReportSummaryAsFieldStaffReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/reports/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    void testGetReportSummaryUnauthenticatedReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/reports/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testGetReportSummaryWithExplicitDateRange() throws Exception {
        LocalDate start = LocalDate.now().minusDays(15);
        LocalDate end = LocalDate.now();

        mockMvc.perform(get("/api/v1/reports/summary")
                .param("startDate", start.toString())
                .param("endDate", end.toString())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.startDate").value(start.toString()))
                .andExpect(jsonPath("$.endDate").value(end.toString()))
                .andExpect(jsonPath("$.dailyVolume").isArray());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testHistoricalPaidShipmentExcludedFromLiveAging() throws Exception {
        Client client = createOrGetClient("CL-RPT-PAID", "Fully Paid Client");
        LocalDateTime regDate = LocalDateTime.now().minusDays(45);
        Shipment shipment = createShipment("SHP-HIST-PAID", client, new BigDecimal("2500.00"), regDate);

        // Fully pay this shipment 40 days ago (well outside any 7-day query window)
        recordPayment(shipment, new BigDecimal("2500.00"), PaymentMethod.BANK, LocalDate.now().minusDays(40));

        // Request report for the last 7 days
        LocalDate start = LocalDate.now().minusDays(7);
        LocalDate end = LocalDate.now();

        mockMvc.perform(get("/api/v1/reports/summary")
                .param("startDate", start.toString())
                .param("endDate", end.toString())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.receivablesAging[?(@.clientId == 'CL-RPT-PAID')]").doesNotExist());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testPeriodCashCollectionBasedOnPaymentDateNotRegistrationDate() throws Exception {
        Client client = createOrGetClient("CL-RPT-CASH", "Cash Flow Client");

        // Shipment registered 60 days ago
        LocalDateTime regDate = LocalDateTime.now().minusDays(60);
        Shipment shipment = createShipment("SHP-CASH-TEST", client, new BigDecimal("1800.00"), regDate);

        // Cash payment recorded TODAY (inside current reporting window)
        recordPayment(shipment, new BigDecimal("600.00"), PaymentMethod.GCASH, LocalDate.now());

        // Request report for today only
        LocalDate today = LocalDate.now();

        mockMvc.perform(get("/api/v1/reports/summary")
                .param("startDate", today.toString())
                .param("endDate", today.toString())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                // Period collected must reflect today's cash payment
                .andExpect(jsonPath("$.kpis.totalCollectedRevenue").value(600.00))
                // Period billed must NOT include the shipment registered 60 days ago
                .andExpect(jsonPath("$.kpis.totalBilledRevenue").value(0.00))
                // Payment methods breakdown includes GCASH with 600.00
                .andExpect(jsonPath("$.paymentMethods[?(@.method == 'GCASH')].totalAmount").value(600.00));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testKpiAndClientRowLiveBalancesReconcileWithAgingTotals() throws Exception {
        Client clientA = createOrGetClient("CL-RECON-A", "Recon Client A");
        Client clientB = createOrGetClient("CL-RECON-B", "Recon Client B");
        Client clientC = createOrGetClient("CL-RECON-C", "Recon Client C");

        // Client A: Current Due (registered 3 days ago, unpaid 1000.00)
        createShipment("SHP-REC-A", clientA, new BigDecimal("1000.00"), LocalDateTime.now().minusDays(3));

        // Client B: Past Due (registered 10 days ago, billed 2000.00, paid 500.00, balance 1500.00)
        Shipment shipB = createShipment("SHP-REC-B", clientB, new BigDecimal("2000.00"), LocalDateTime.now().minusDays(10));
        recordPayment(shipB, new BigDecimal("500.00"), PaymentMethod.CASH, LocalDate.now().minusDays(9));

        // Client C: Overdue (registered 20 days ago, unpaid 3000.00)
        createShipment("SHP-REC-C", clientC, new BigDecimal("3000.00"), LocalDateTime.now().minusDays(20));

        LocalDate today = LocalDate.now();

        mockMvc.perform(get("/api/v1/reports/summary")
                .param("startDate", today.toString())
                .param("endDate", today.toString())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                // Verify KPI outstandingReceivables reconciles with the sum of all aging rows
                .andExpect(result -> {
                    String json = result.getResponse().getContentAsString();
                    com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(json);
                    double kpiOutstanding = root.path("kpis").path("outstandingReceivables").asDouble();
                    double agingSum = 0.0;
                    for (com.fasterxml.jackson.databind.JsonNode row : root.path("receivablesAging")) {
                        agingSum += row.path("totalOutstanding").asDouble();
                    }
                    assertEquals(kpiOutstanding, agingSum, 0.01, "KPI outstandingReceivables must reconcile with sum of aging rows");
                })
                // Aging buckets verify correct age assignment
                .andExpect(jsonPath("$.receivablesAging[?(@.clientId == 'CL-RECON-A')].currentDue").value(1000.00))
                .andExpect(jsonPath("$.receivablesAging[?(@.clientId == 'CL-RECON-B')].pastDue").value(1500.00))
                .andExpect(jsonPath("$.receivablesAging[?(@.clientId == 'CL-RECON-C')].overdue").value(3000.00))
                // Client revenue live balances match aging totalOutstanding
                .andExpect(jsonPath("$.clientRevenue[?(@.clientId == 'CL-RECON-A')].balance").value(1000.00))
                .andExpect(jsonPath("$.clientRevenue[?(@.clientId == 'CL-RECON-B')].balance").value(1500.00))
                .andExpect(jsonPath("$.clientRevenue[?(@.clientId == 'CL-RECON-C')].balance").value(3000.00));
    }

    @Test
    void testDeterministicAgingBucketsWithInjectedClock() {
        // Fixed date: 2026-11-20
        LocalDate fixedToday = LocalDate.of(2026, 11, 20);
        Clock fixedClock = Clock.fixed(fixedToday.atStartOfDay(ZoneId.systemDefault()).toInstant(), ZoneId.systemDefault());

        com.tnl.logistics.service.impl.ReportServiceImpl customReportService = new com.tnl.logistics.service.impl.ReportServiceImpl(
                shipmentRepository,
                parcelUnitRepository,
                paymentRepository,
                soaRepository,
                clientRepository,
                collectionsService,
                fixedClock
        );

        Client client = createOrGetClient("CL-CLOCK-TEST", "Clock Injected Client");

        // Shipment 1: 5 days old relative to fixedToday -> 0-7d Current Due
        createShipment("SHP-CLK-1", client, new BigDecimal("100.00"), fixedToday.minusDays(5).atTime(10, 0));

        // Shipment 2: 10 days old relative to fixedToday -> 8-14d Past Due
        createShipment("SHP-CLK-2", client, new BigDecimal("200.00"), fixedToday.minusDays(10).atTime(10, 0));

        // Shipment 3: 25 days old relative to fixedToday -> 15+d Overdue
        createShipment("SHP-CLK-3", client, new BigDecimal("300.00"), fixedToday.minusDays(25).atTime(10, 0));

        com.tnl.logistics.dto.ReportSummaryResponse summary = customReportService.getReportSummary(fixedToday.minusDays(7), fixedToday);

        com.tnl.logistics.dto.ReceivablesAgingReportRow row = summary.getReceivablesAging().stream()
                .filter(r -> "CL-CLOCK-TEST".equals(r.getClientId()))
                .findFirst()
                .orElseThrow();

        assertEquals(0, new BigDecimal("100.00").compareTo(row.getCurrentDue()));
        assertEquals(0, new BigDecimal("200.00").compareTo(row.getPastDue()));
        assertEquals(0, new BigDecimal("300.00").compareTo(row.getOverdue()));
        assertEquals(0, new BigDecimal("600.00").compareTo(row.getTotalOutstanding()));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testMultipleParcelsDoNotMultiplyShipmentRevenueAndStatusDistributionAccurate() throws Exception {
        Client client = createOrGetClient("CL-RPT-PARCELS", "Multi-Parcel Client");
        LocalDateTime regDate = LocalDateTime.now().minusDays(2);
        Shipment shipment = createShipment("SHP-MULTI-PARCEL", client, new BigDecimal("3000.00"), regDate);

        // 3 parcels for 1 shipment
        createParcel("TRK-MP-001", shipment, 1, ParcelStatus.COMPLETED, false, new BigDecimal("3.00"), new BigDecimal("0.0100"));
        createParcel("TRK-MP-002", shipment, 2, ParcelStatus.LOADED_ON_TRUCK, false, new BigDecimal("2.00"), new BigDecimal("0.0050"));
        createParcel("TRK-MP-003", shipment, 3, ParcelStatus.QR_GENERATED, true, new BigDecimal("1.00"), new BigDecimal("0.0020"));

        LocalDate start = LocalDate.now().minusDays(3);
        LocalDate end = LocalDate.now().minusDays(1);

        mockMvc.perform(get("/api/v1/reports/summary")
                .param("startDate", start.toString())
                .param("endDate", end.toString())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                // Ensure shipment revenue and count are NOT multiplied by 3 parcels
                .andExpect(jsonPath("$.kpis.totalShipments").value(1))
                .andExpect(jsonPath("$.kpis.totalBilledRevenue").value(3000.00))
                .andExpect(jsonPath("$.kpis.totalParcels").value(3))
                // 1 completed out of 3 total = 33.3%
                .andExpect(jsonPath("$.kpis.deliveryCompletionRate").value(33.3))
                // Status distribution
                .andExpect(jsonPath("$.statusDistribution[?(@.status == 'COMPLETED')].count").value(1))
                .andExpect(jsonPath("$.statusDistribution[?(@.status == 'COMPLETED')].percentage").value(33.3))
                .andExpect(jsonPath("$.statusDistribution[?(@.status == 'LOADED_ON_TRUCK')].count").value(1))
                .andExpect(jsonPath("$.statusDistribution[?(@.status == 'LOADED_ON_TRUCK')].percentage").value(33.3))
                // TRK-MP-003 is lost, so QR_GENERATED non-lost count is 0
                .andExpect(jsonPath("$.statusDistribution[?(@.status == 'QR_GENERATED')].count").value(0))
                .andExpect(jsonPath("$.statusDistribution[?(@.status == 'LOST')].count").value(1))
                .andExpect(jsonPath("$.statusDistribution[?(@.status == 'LOST')].percentage").value(33.3))
                // Client revenue row for CL-RPT-PARCELS
                .andExpect(jsonPath("$.clientRevenue[?(@.clientId == 'CL-RPT-PARCELS')].totalShipments").value(1))
                .andExpect(jsonPath("$.clientRevenue[?(@.clientId == 'CL-RPT-PARCELS')].totalBilled").value(3000.00));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testMultiplePaymentsOnSingleShipmentDoNotMultiplyRevenueAndReflectPartialBalance() throws Exception {
        Client client = createOrGetClient("CL-RPT-MULTIPAY", "Multi-Payment Client");
        LocalDateTime regDate = LocalDateTime.now().minusDays(5);
        Shipment shipment = createShipment("SHP-MULTI-PAY", client, new BigDecimal("5000.00"), regDate);

        // Record 2 partial payments for the same shipment
        recordPayment(shipment, new BigDecimal("1000.00"), PaymentMethod.CASH, LocalDate.now().minusDays(3));
        recordPayment(shipment, new BigDecimal("1500.00"), PaymentMethod.BANK, LocalDate.now().minusDays(2));

        LocalDate start = LocalDate.now().minusDays(7);
        LocalDate end = LocalDate.now();

        mockMvc.perform(get("/api/v1/reports/summary")
                .param("startDate", start.toString())
                .param("endDate", end.toString())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                // Verify billed revenue is 5000 (not multiplied)
                .andExpect(jsonPath("$.kpis.totalBilledRevenue").value(5000.00))
                // Aging for this client reflects remaining balance: 5000 - (1000 + 1500) = 2500
                .andExpect(jsonPath("$.receivablesAging[?(@.clientId == 'CL-RPT-MULTIPAY')].totalOutstanding").value(2500.00))
                .andExpect(jsonPath("$.receivablesAging[?(@.clientId == 'CL-RPT-MULTIPAY')].currentDue").value(2500.00))
                .andExpect(jsonPath("$.receivablesAging[?(@.clientId == 'CL-RPT-MULTIPAY')].unpaidShipmentsCount").value(1))
                // Client revenue row: billed 5000, paid 2500, balance 2500, status PARTIAL
                .andExpect(jsonPath("$.clientRevenue[?(@.clientId == 'CL-RPT-MULTIPAY')].totalBilled").value(5000.00))
                .andExpect(jsonPath("$.clientRevenue[?(@.clientId == 'CL-RPT-MULTIPAY')].totalPaid").value(2500.00))
                .andExpect(jsonPath("$.clientRevenue[?(@.clientId == 'CL-RPT-MULTIPAY')].balance").value(2500.00))
                .andExpect(jsonPath("$.clientRevenue[?(@.clientId == 'CL-RPT-MULTIPAY')].paymentStatus").value("PARTIAL"))
                // Payment methods breakdown includes CASH >= 1000 and BANK >= 1500
                .andExpect(jsonPath("$.paymentMethods[?(@.method == 'CASH')].totalAmount").value(1000.00))
                .andExpect(jsonPath("$.paymentMethods[?(@.method == 'BANK')].totalAmount").value(1500.00));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testDeductionsCategoryPrecedenceAndOrdering() throws Exception {
        Client client = createOrGetClient("CL-RPT-DEDUCT", "Deductions Client");
        LocalDate statementDate = LocalDate.now().minusDays(2);

        createSoa("SOA-DED-1", client, statementDate, new BigDecimal("200.00"), "Damage to cartons in transit");
        createSoa("SOA-DED-2", client, statementDate, new BigDecimal("150.00"), "Weight discrepancy on weighing");
        createSoa("SOA-DED-3", client, statementDate, new BigDecimal("100.00"), "General goodwill claim");

        LocalDate start = LocalDate.now().minusDays(5);
        LocalDate end = LocalDate.now();

        mockMvc.perform(get("/api/v1/reports/summary")
                .param("startDate", start.toString())
                .param("endDate", end.toString())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                // Deductions array has exactly 3 categories in precedence order: BAD_ORDER, DISCREPANCY, CLAIM
                .andExpect(jsonPath("$.deductions[0].category").value("BAD_ORDER"))
                .andExpect(jsonPath("$.deductions[0].count").value(1))
                .andExpect(jsonPath("$.deductions[0].totalAmount").value(200.00))
                .andExpect(jsonPath("$.deductions[1].category").value("DISCREPANCY"))
                .andExpect(jsonPath("$.deductions[1].count").value(1))
                .andExpect(jsonPath("$.deductions[1].totalAmount").value(150.00))
                .andExpect(jsonPath("$.deductions[2].category").value("CLAIM"))
                .andExpect(jsonPath("$.deductions[2].count").value(1))
                .andExpect(jsonPath("$.deductions[2].totalAmount").value(100.00));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testReversedDateRangeAutoInvertsAndReturnsValidReport() throws Exception {
        LocalDate laterDate = LocalDate.now().plusDays(5);
        LocalDate earlierDate = LocalDate.now().minusDays(5);

        // Provide inverted range (start is later than end)
        mockMvc.perform(get("/api/v1/reports/summary")
                .param("startDate", laterDate.toString())
                .param("endDate", earlierDate.toString())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                // Assert that the service auto-reversed the dates
                .andExpect(jsonPath("$.startDate").value(earlierDate.toString()))
                .andExpect(jsonPath("$.endDate").value(laterDate.toString()));
    }

    @Test
    void testReportFailureReturns503AndNeverFabricatesZeroes() {
        // Construct a ReportServiceImpl with a failing mock repository that throws DataAccessException
        ShipmentRepository failingShipmentRepo = org.mockito.Mockito.mock(ShipmentRepository.class);
        org.mockito.Mockito.when(failingShipmentRepo.getPeriodShipmentTotals(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenThrow(new org.springframework.dao.DataAccessResourceFailureException("Database connection timeout"));

        com.tnl.logistics.service.impl.ReportServiceImpl serviceWithFailure = new com.tnl.logistics.service.impl.ReportServiceImpl(
                failingShipmentRepo,
                parcelUnitRepository,
                paymentRepository,
                soaRepository,
                clientRepository,
                collectionsService,
                Clock.systemDefaultZone()
        );

        org.springframework.web.server.ResponseStatusException ex = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> serviceWithFailure.getReportSummary(LocalDate.now().minusDays(7), LocalDate.now())
        );

        assertEquals(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, ex.getStatusCode());
        assertTrue(ex.getReason() != null && ex.getReason().contains("REPORT_UNAVAILABLE"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testReportFailureReturnsHttp503AndStructuredErrorViaMockMvc() throws Exception {
        org.mockito.Mockito.doThrow(new org.springframework.dao.DataAccessResourceFailureException("Simulated DB connection failure"))
                .when(shipmentRepository).getPeriodShipmentTotals(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());

        try {
            mockMvc.perform(get("/api/v1/reports/summary")
                    .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.status").value(503))
                    .andExpect(jsonPath("$.code").value("REPORT_UNAVAILABLE"))
                    .andExpect(jsonPath("$.message").value("Financial report calculation is temporarily unavailable"))
                    .andExpect(jsonPath("$.error").exists())
                    .andExpect(jsonPath("$.timestamp").exists());
        } finally {
            org.mockito.Mockito.reset(shipmentRepository);
        }
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testCompletedAndLostParcelsCompletionRateSemantics() throws Exception {
        Client client = createOrGetClient("CL-RPT-COMPL-LOST", "Completion Rate Semantics Client");
        LocalDateTime regDate = LocalDate.now().minusDays(1).atTime(10, 0);
        Shipment s = createShipment("SHP-CPL-1", client, new BigDecimal("2000.00"), regDate);

        // Parcel 1: COMPLETED, NOT lost
        createParcel("TRK-CPL-1", s, 1, ParcelStatus.COMPLETED, false, new BigDecimal("2.50"), new BigDecimal("0.0060"));
        // Parcel 2: COMPLETED, but marked LOST
        createParcel("TRK-CPL-2", s, 2, ParcelStatus.COMPLETED, true, new BigDecimal("3.50"), new BigDecimal("0.0080"));

        LocalDate start = LocalDate.now().minusDays(3);
        LocalDate end = LocalDate.now();

        mockMvc.perform(get("/api/v1/reports/summary")
                .param("startDate", start.toString())
                .param("endDate", end.toString())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                // Top-level KPIs: both parcels are COMPLETED, so completion rate = 100.0%
                .andExpect(jsonPath("$.kpis.totalParcels").value(2))
                .andExpect(jsonPath("$.kpis.deliveryCompletionRate").value(100.0))
                // Status distribution: non-lost COMPLETED count is 1 (50.0%)
                .andExpect(jsonPath("$.statusDistribution[?(@.status == 'COMPLETED')].count").value(1))
                .andExpect(jsonPath("$.statusDistribution[?(@.status == 'COMPLETED')].percentage").value(50.0))
                // Status distribution: LOST count is 1 (50.0%)
                .andExpect(jsonPath("$.statusDistribution[?(@.status == 'LOST')].count").value(1))
                .andExpect(jsonPath("$.statusDistribution[?(@.status == 'LOST')].percentage").value(50.0))
                // Daily volume for registration day: completedDeliveries counts all completed parcels = 2
                .andExpect(jsonPath("$.dailyVolume[?(@.date == '" + regDate.toLocalDate().toString() + "')].completedDeliveries").value(2))
                .andExpect(jsonPath("$.dailyVolume[?(@.date == '" + regDate.toLocalDate().toString() + "')].parcelsCount").value(2));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testBoundedLargeRangeAndMemoryStability() throws Exception {
        Client client = createOrGetClient("CL-RPT-LARGE", "Large Range Client");
        LocalDate today = LocalDate.now();

        // Seed 12 shipments across past 360 days (one per month)
        for (int i = 0; i < 12; i++) {
            LocalDateTime regDate = today.minusDays(i * 30 + 1).atTime(10, 0);
            Shipment s = createShipment("SHP-LRG-" + i, client, new BigDecimal("1000.00"), regDate);
            createParcel("TRK-LRG-" + i + "-1", s, 1, ParcelStatus.COMPLETED, false, new BigDecimal("2.00"), new BigDecimal("0.0050"));
            createParcel("TRK-LRG-" + i + "-2", s, 2, ParcelStatus.ARRIVED_AT_TNL, false, new BigDecimal("3.00"), new BigDecimal("0.0080"));
            if (i % 2 == 0) {
                recordPayment(s, new BigDecimal("500.00"), PaymentMethod.BANK, regDate.toLocalDate().plusDays(2));
            }
        }

        LocalDate start = today.minusDays(365);
        LocalDate end = today;

        long memoryBefore = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();

        mockMvc.perform(get("/api/v1/reports/summary")
                .param("startDate", start.toString())
                .param("endDate", end.toString())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.startDate").value(start.toString()))
                .andExpect(jsonPath("$.endDate").value(end.toString()))
                .andExpect(jsonPath("$.kpis.totalShipments").value(12))
                .andExpect(jsonPath("$.kpis.totalBilledRevenue").value(12000.00))
                .andExpect(jsonPath("$.kpis.totalParcels").value(24))
                .andExpect(jsonPath("$.dailyVolume").isArray())
                .andExpect(result -> {
                    String json = result.getResponse().getContentAsString();
                    com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(json);
                    assertEquals(366, root.path("dailyVolume").size(), "Full year range should have 366 daily entries");
                });

        long memoryAfter = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();
        long retainedDelta = memoryAfter - memoryBefore;

        assertTrue(retainedDelta < 50 * 1024 * 1024, "Retained heap delta must remain bounded");
    }
}
