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

    @Autowired
    private ShipmentRepository shipmentRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private ParcelUnitRepository parcelUnitRepository;

    @Autowired
    private SoaRepository soaRepository;

    @Autowired
    private com.tnl.logistics.service.CollectionsService collectionsService;

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
    @WithMockUser(username = "office", roles = {"OFFICE_STAFF"})
    void testGetReportSummaryAsOfficeStaffReturns200() throws Exception {
        mockMvc.perform(get("/api/v1/reports/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kpis").exists());
    }

    @Test
    @WithMockUser(username = "field", roles = {"FIELD_STAFF"})
    void testGetReportSummaryAsFieldStaffReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/reports/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    void testGetReportSummaryUnauthenticatedReturnsForbiddenOrUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/reports/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
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
}
