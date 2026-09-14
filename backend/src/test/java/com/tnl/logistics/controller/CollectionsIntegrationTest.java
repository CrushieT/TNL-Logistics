package com.tnl.logistics.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.CollectionsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Integration tests verifying collection cycle discovery, fixed 7-day windows,
 * empty cycle omission, unbilled gap recovery, and finalized SOA date preservation.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class CollectionsIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CollectionsService collectionsService;

    @Autowired
    private ShipmentRepository shipmentRepository;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private SoaRepository soaRepository;

    private Client testClient;

    @BeforeEach
    void setUp() {
        testClient = clientRepository.findAll().stream().findFirst().orElseGet(() -> {
            Client c = new Client();
            c.setClientId("CL-CYCLE-TEST");
            c.setName("Cycle Test Client");
            c.setContactNumber("0917-000-1111");
            c.setAddress("Test City");
            c.setActive(true);
            return clientRepository.save(c);
        });
    }

    private Shipment createShipment(String id, LocalDateTime regDate, String statementId) {
        Shipment s = new Shipment();
        s.setShipmentId(id);
        s.setClient(testClient);
        s.setRecipientName("Recipient " + id);
        s.setRecipientAddress("Address " + id);
        s.setRecipientContact("0912-345-6789");
        s.setQuantity(1);
        s.setChargeModel(ChargeModel.FLAT);
        s.setShippingFee(new BigDecimal("100.00"));
        s.setOtherCharges(BigDecimal.ZERO);
        s.setTotalAmount(new BigDecimal("100.00"));
        s.setPaidAtRegistration(false);
        s.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        s.setDateRegistered(regDate);
        s.setStatementId(statementId);
        return shipmentRepository.save(s);
    }

    @Test
    void testFixedSevenDayBillingWindow() {
        LocalDate thursday = LocalDate.of(2026, 9, 17);
        LocalDate start = collectionsService.calculateCycleStartDate(thursday);
        assertEquals(LocalDate.of(2026, 9, 11), start);
        assertEquals(6, java.time.temporal.ChronoUnit.DAYS.between(start, thursday));

        LocalDate monthCrossThursday = LocalDate.of(2026, 10, 1);
        LocalDate monthCrossStart = collectionsService.calculateCycleStartDate(monthCrossThursday);
        assertEquals(LocalDate.of(2026, 9, 25), monthCrossStart);
        assertEquals(6, java.time.temporal.ChronoUnit.DAYS.between(monthCrossStart, monthCrossThursday));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testUnbilledRegistrationWeekAppearsOnce() throws Exception {
        // Register two shipments in the same Thursday cycle: Friday and Tuesday
        LocalDateTime friday = LocalDateTime.of(2026, 9, 11, 10, 0);
        LocalDateTime tuesday = LocalDateTime.of(2026, 9, 15, 14, 0);

        createShipment("SHP-CYC-1", friday, null);
        createShipment("SHP-CYC-2", tuesday, null);

        LocalDate expectedThursday = LocalDate.of(2026, 9, 17);
        List<LocalDate> activeCycles = collectionsService.getActiveCycleDates();

        assertTrue(activeCycles.contains(expectedThursday));
        long occurrences = activeCycles.stream().filter(d -> d.equals(expectedThursday)).count();
        assertEquals(1, occurrences);
    }

    @Autowired
    private WeeklyCollectionRepository weeklyCollectionRepository;

    private WeeklyCollection createWeeklyCollection(String id, LocalDate date) {
        WeeklyCollection wc = new WeeklyCollection(id, testClient, date.minusDays(6), date,
                new BigDecimal("500.00"), BigDecimal.ZERO, new BigDecimal("500.00"), "FOR_COLLECTION");
        return weeklyCollectionRepository.save(wc);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testGapsBetweenFinalizedCyclesStillExposeInterveningUnbilledWeeks() throws Exception {
        // Finalized SOA for week 1 (Aug 27) and week 3 (Sep 10)
        LocalDate week1Thursday = LocalDate.of(2026, 8, 27);
        LocalDate week3Thursday = LocalDate.of(2026, 9, 10);

        Soa soa1 = new Soa();
        soa1.setSoaNo("SOA-TEST-001");
        soa1.setClient(testClient);
        soa1.setCollection(createWeeklyCollection("WC-TEST-001", week1Thursday));
        soa1.setStatementDate(week1Thursday);
        soa1.setCurrentCharges(new BigDecimal("500.00"));
        soa1.setPreviousBalance(BigDecimal.ZERO);
        soa1.setTotalPaid(new BigDecimal("500.00"));
        soa1.setDeductions(BigDecimal.ZERO);
        soa1.setOutstandingBalance(BigDecimal.ZERO);
        soaRepository.save(soa1);

        Soa soa3 = new Soa();
        soa3.setSoaNo("SOA-TEST-003");
        soa3.setClient(testClient);
        soa3.setCollection(createWeeklyCollection("WC-TEST-003", week3Thursday));
        soa3.setStatementDate(week3Thursday);
        soa3.setCurrentCharges(new BigDecimal("500.00"));
        soa3.setPreviousBalance(BigDecimal.ZERO);
        soa3.setTotalPaid(new BigDecimal("500.00"));
        soa3.setDeductions(BigDecimal.ZERO);
        soa3.setOutstandingBalance(BigDecimal.ZERO);
        soaRepository.save(soa3);

        // Intervening unbilled shipment registered in Week 2 (Sep 2)
        LocalDateTime week2RegDate = LocalDateTime.of(2026, 9, 2, 11, 0);
        createShipment("SHP-CYC-GAP", week2RegDate, null);
        LocalDate week2Thursday = LocalDate.of(2026, 9, 3);

        List<LocalDate> activeCycles = collectionsService.getActiveCycleDates();

        assertTrue(activeCycles.contains(week1Thursday), "Week 1 finalized SOA date should be present");
        assertTrue(activeCycles.contains(week2Thursday), "Intervening Week 2 unbilled cycle should be discovered");
        assertTrue(activeCycles.contains(week3Thursday), "Week 3 finalized SOA date should be present");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testFinalizedHistoricalSoaCyclesRemainVisible() throws Exception {
        LocalDate historicalDate = LocalDate.of(2026, 7, 16);
        Soa soa = new Soa();
        soa.setSoaNo("SOA-HIST-001");
        soa.setClient(testClient);
        soa.setCollection(createWeeklyCollection("WC-HIST-001", historicalDate));
        soa.setStatementDate(historicalDate);
        soa.setCurrentCharges(new BigDecimal("1000.00"));
        soa.setPreviousBalance(BigDecimal.ZERO);
        soa.setTotalPaid(new BigDecimal("1000.00"));
        soa.setDeductions(BigDecimal.ZERO);
        soa.setOutstandingBalance(BigDecimal.ZERO);
        soaRepository.save(soa);

        List<LocalDate> cycles = collectionsService.getActiveCycleDates();
        assertTrue(cycles.contains(historicalDate));
    }

    @Test
    void testActiveCycleAlwaysIncludesCurrentOngoingWeekEvenWithNoShipments() {
        LocalDate expectedActiveCycle = collectionsService.calculateActiveCycleDate(LocalDate.now());
        List<LocalDate> activeCycles = collectionsService.getActiveCycleDates();

        assertNotNull(activeCycles);
        assertFalse(activeCycles.isEmpty());
        assertEquals(expectedActiveCycle, activeCycles.get(0), "The active ongoing cycle must always be at index 0");
    }

    @Test
    void testCycleStartAnchorsWhenPrecedingCycleIsLessThanSevenDays() {
        LocalDate cycleEnd = LocalDate.of(2026, 8, 27);
        LocalDate precedingCycle = LocalDate.of(2026, 8, 25); // 2 days earlier

        Soa soa = new Soa();
        soa.setSoaNo("SOA-ANCHOR-001");
        soa.setClient(testClient);
        soa.setCollection(createWeeklyCollection("WC-ANCHOR-001", precedingCycle));
        soa.setStatementDate(precedingCycle);
        soa.setCurrentCharges(new BigDecimal("100.00"));
        soa.setPreviousBalance(BigDecimal.ZERO);
        soa.setTotalPaid(new BigDecimal("100.00"));
        soa.setDeductions(BigDecimal.ZERO);
        soa.setOutstandingBalance(BigDecimal.ZERO);
        soaRepository.save(soa);

        LocalDate start = collectionsService.calculateCycleStartDate(cycleEnd);
        assertEquals(LocalDate.of(2026, 8, 26), start, "Start date should anchor to preceding cycle + 1 day");
    }
}
