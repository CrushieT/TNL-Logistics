package com.tnl.logistics.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.EnsureV1Request;
import com.tnl.logistics.dto.ParcelUnitRequest;
import com.tnl.logistics.dto.PaymentRecordRequest;
import com.tnl.logistics.dto.SaveStatementRequest;
import com.tnl.logistics.dto.SaveStatementVersionRequest;
import com.tnl.logistics.dto.ShipmentRegistrationRequest;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.ChargeModel;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.PaymentMethod;
import com.tnl.logistics.model.RegisteredVia;
import com.tnl.logistics.model.Shipment;
import com.tnl.logistics.model.Soa;
import com.tnl.logistics.model.SoaVersion;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.ClientRepository;
import com.tnl.logistics.repository.ShipmentRepository;
import com.tnl.logistics.repository.SoaRepository;
import com.tnl.logistics.repository.SoaVersionRepository;
import com.tnl.logistics.service.CollectionsService;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.TimeZone;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class SoaCycleVersioningIntegrationTest {

    private static final ZoneId MANILA_ZONE = ZoneId.of("Asia/Manila");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private ShipmentRepository shipmentRepository;

    @Autowired
    private SoaRepository soaRepository;

    @Autowired
    private SoaVersionRepository soaVersionRepository;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private CollectionsService collectionsService;

    private Client testClient;

    @BeforeEach
    void setUp() {
        testClient = clientRepository.findById("CL-VERSION-01").orElseGet(() -> {
            Client c = new Client("CL-VERSION-01", "Acme Versioning Corp", "Makati City", "09171112233", "acme@versioning.ph", ChargeModel.FLAT, true);
            return clientRepository.save(c);
        });
        if (!Boolean.TRUE.equals(testClient.getActive())) {
            testClient.setActive(true);
            clientRepository.save(testClient);
        }
    }

    private Shipment createTestShipment(String shipmentId, LocalDate busDate, LocalDateTime regDate, BigDecimal fee) {
        Shipment s = new Shipment();
        s.setShipmentId(shipmentId);
        s.setClient(testClient);
        s.setRecipientName("Consignee " + shipmentId);
        s.setRecipientContact("09170000000");
        s.setRecipientAddress("Metro Manila");
        s.setRoute("Manila -> Baguio");
        s.setDescription("Sample Freight");
        s.setQuantity(1);
        s.setChargeModel(ChargeModel.FLAT);
        s.setShippingFee(fee);
        s.setOtherCharges(BigDecimal.ZERO);
        s.setTotalAmount(fee);
        s.setBusinessRegistrationDate(busDate);
        s.setDateRegistered(regDate);
        s.setPaidAtRegistration(false);
        s.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        return shipmentRepository.save(s);
    }

    @Test
    @DisplayName("1. Half-open cycle boundary: Wednesday 23:59:59 Manila belongs to cycle; Thursday 00:00:00 Manila belongs to following cycle")
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testHalfOpenCycleBoundaryFiltering() throws Exception {
        LocalDate pastThursday = LocalDate.now(MANILA_ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.THURSDAY)).minusWeeks(2);
        LocalDate previousCycleStart = collectionsService.calculateCycleStartDate(pastThursday);

        // Shipment A: inside cycle (Wednesday 23:59:59 Manila)
        LocalDateTime wednesdayNight = pastThursday.minusDays(1).atTime(23, 59, 59);
        Shipment insideShipment = createTestShipment("SH-IN-" + UUID.randomUUID().toString().substring(0, 6),
                pastThursday.minusDays(1), wednesdayNight, new BigDecimal("1000.00"));

        // Shipment B: on cutoff (Thursday 00:00:00 Manila) -> belongs to NEXT cycle
        LocalDateTime thursdayMidnight = pastThursday.atStartOfDay();
        Shipment outsideShipment = createTestShipment("SH-OUT-" + UUID.randomUUID().toString().substring(0, 6),
                pastThursday, thursdayMidnight, new BigDecimal("2000.00"));

        // Query preview for pastThursday
        mockMvc.perform(get("/api/v1/soa/preview")
                        .param("clientId", testClient.getClientId())
                        .param("targetDate", pastThursday.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clientId").value(testClient.getClientId()))
                .andExpect(jsonPath("$.cycleThursday").value(pastThursday.toString()))
                .andExpect(jsonPath("$.items[?(@.shipmentId == '" + insideShipment.getShipmentId() + "')]").exists())
                .andExpect(jsonPath("$.items[?(@.shipmentId == '" + outsideShipment.getShipmentId() + "')]").doesNotExist());
    }

    @Test
    @DisplayName("2. Database query interprets cutoff consistently under UTC and Manila JVM timezones")
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testTimezoneAgnosticInterpretation() throws Exception {
        TimeZone originalDefault = TimeZone.getDefault();
        try {
            LocalDate pastThursday = LocalDate.now(MANILA_ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.THURSDAY)).minusWeeks(3);
            LocalDateTime regTime = pastThursday.minusDays(2).atTime(14, 0, 0);
            Shipment testShipment = createTestShipment("SH-TZ-" + UUID.randomUUID().toString().substring(0, 6),
                    null, regTime, new BigDecimal("750.00"));

            // Test under UTC JVM default
            TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
            mockMvc.perform(get("/api/v1/soa/preview")
                            .param("clientId", testClient.getClientId())
                            .param("targetDate", pastThursday.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items[?(@.shipmentId == '" + testShipment.getShipmentId() + "')]").exists());

            // Test under Manila JVM default
            TimeZone.setDefault(TimeZone.getTimeZone("Asia/Manila"));
            mockMvc.perform(get("/api/v1/soa/preview")
                            .param("clientId", testClient.getClientId())
                            .param("targetDate", pastThursday.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items[?(@.shipmentId == '" + testShipment.getShipmentId() + "')]").exists());
        } finally {
            TimeZone.setDefault(originalDefault);
        }
    }

    @Test
    @DisplayName("3. Open cycle Generate/Save/Print remains live with LIVE SOA banner and no version number")
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testOpenCycleRemainsLive() throws Exception {
        LocalDate nextThursday = LocalDate.now(MANILA_ZONE).with(TemporalAdjusters.next(DayOfWeek.THURSDAY));
        Shipment s = createTestShipment("SH-OPEN-" + UUID.randomUUID().toString().substring(0, 6),
                nextThursday.minusDays(1), nextThursday.minusDays(1).atTime(10, 0), new BigDecimal("500.00"));

        // Preview open cycle
        mockMvc.perform(get("/api/v1/soa/preview")
                        .param("clientId", testClient.getClientId())
                        .param("targetDate", nextThursday.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isCycleClosed").value(false))
                .andExpect(jsonPath("$.isLive").value(true))
                .andExpect(jsonPath("$.hasSnapshot").value(false))
                .andExpect(jsonPath("$.activeVersion").value(nullValue()))
                .andExpect(jsonPath("$.latestVersionNumber").value(nullValue()));

        // Save open cycle (updates live SOA, no snapshot)
        SaveStatementRequest saveReq = new SaveStatementRequest(
                testClient.getClientId(),
                nextThursday,
                new BigDecimal("50.00"),
                "Open cycle test adjustment",
                "Juan Collector"
        );

        mockMvc.perform(post("/api/v1/soa/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(saveReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deductionAmount").value(50.00))
                .andExpect(jsonPath("$.hasSnapshot").value(false))
                .andExpect(jsonPath("$.isLive").value(true));

        // Ensure no record in soa_version
        assertEquals(0, soaVersionRepository.count());
    }

    @Test
    @DisplayName("4. Closed cycle Generate in Weekly Collections prepares live SOA without taking snapshot")
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testClosedCycleGeneratePreparesLiveWithoutSnapshot() throws Exception {
        LocalDate pastThursday = LocalDate.now(MANILA_ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.THURSDAY)).minusWeeks(2);
        createTestShipment("SH-GEN-" + UUID.randomUUID().toString().substring(0, 8),
                pastThursday.minusDays(2), pastThursday.minusDays(2).atTime(10, 0), new BigDecimal("1200.00"));

        mockMvc.perform(post("/api/v1/soa/generate")
                        .param("clientId", testClient.getClientId())
                        .param("targetDate", pastThursday.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isCycleClosed").value(true))
                .andExpect(jsonPath("$.hasSnapshot").value(false))
                .andExpect(jsonPath("$.isLive").value(true))
                .andExpect(jsonPath("$.activeVersion").value(nullValue()));

        assertEquals(0, soaVersionRepository.count());
    }

    @Test
    @DisplayName("5. First explicit Save or Print captures exactly one Version 1 with immutable snapshot and trusted logo")
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testFirstSaveOrPrintCapturesV1Snapshot() throws Exception {
        LocalDate pastThursday = LocalDate.now(MANILA_ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.THURSDAY)).minusWeeks(2);
        createTestShipment("SH-V1-" + UUID.randomUUID().toString().substring(0, 8),
                pastThursday.minusDays(3), pastThursday.minusDays(3).atTime(9, 0), new BigDecimal("2500.00"));

        String reqId = UUID.randomUUID().toString();
        EnsureV1Request ensureReq = new EnsureV1Request(testClient.getClientId(), pastThursday, reqId);

        mockMvc.perform(post("/api/v1/soa/ensure-v1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(ensureReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeVersion").value(1))
                .andExpect(jsonPath("$.latestVersionNumber").value(1))
                .andExpect(jsonPath("$.hasSnapshot").value(true))
                .andExpect(jsonPath("$.isLive").value(false))
                .andExpect(jsonPath("$.logoHash").exists());

        // Idempotency: second call returns the same V1
        mockMvc.perform(post("/api/v1/soa/ensure-v1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(ensureReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeVersion").value(1))
                .andExpect(jsonPath("$.versionsCount").value(1));

        // Fetch version 1 preview explicitly
        mockMvc.perform(get("/api/v1/soa/preview")
                        .param("clientId", testClient.getClientId())
                        .param("targetDate", pastThursday.toString())
                        .param("version", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeVersion").value(1))
                .andExpect(jsonPath("$.totalCharges").value(2500.00))
                .andExpect(jsonPath("$.isLive").value(false));
    }

    @Test
    @DisplayName("6. Payments recorded after V1 capture update live account and financial revision, but do not alter frozen snapshot")
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testPostCapturePaymentDoesNotAlterSnapshot() throws Exception {
        LocalDate pastThursday = LocalDate.now(MANILA_ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.THURSDAY)).minusWeeks(2);
        Shipment shipment = createTestShipment("SH-PAY-" + UUID.randomUUID().toString().substring(0, 8),
                pastThursday.minusDays(3), pastThursday.minusDays(3).atTime(9, 0), new BigDecimal("3000.00"));

        // Capture V1
        EnsureV1Request ensureReq = new EnsureV1Request(testClient.getClientId(), pastThursday, UUID.randomUUID().toString());
        mockMvc.perform(post("/api/v1/soa/ensure-v1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(ensureReq)))
                .andExpect(status().isOk());

        // Live preview before payment has financialRevision = 1
        mockMvc.perform(get("/api/v1/soa/preview")
                        .param("clientId", testClient.getClientId())
                        .param("targetDate", pastThursday.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.financialRevision").value(1))
                .andExpect(jsonPath("$.amountDue").value(3000.00));

        // Record a 1000.00 payment
        PaymentRecordRequest payReq = new PaymentRecordRequest(
                shipment.getShipmentId(),
                new BigDecimal("1000.00"),
                PaymentMethod.CASH,
                null,
                LocalDate.now(MANILA_ZONE),
                null
        );
        mockMvc.perform(post("/api/v1/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payReq)))
                .andExpect(status().isCreated());

        // Live preview now has financialRevision = 2, amountDue = 2000.00
        mockMvc.perform(get("/api/v1/soa/preview")
                        .param("clientId", testClient.getClientId())
                        .param("targetDate", pastThursday.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.financialRevision").value(2))
                .andExpect(jsonPath("$.amountDue").value(2000.00));

        // Frozen V1 still shows original pre-payment amountDue = 3000.00
        mockMvc.perform(get("/api/v1/soa/preview")
                        .param("clientId", testClient.getClientId())
                        .param("targetDate", pastThursday.toString())
                        .param("version", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeVersion").value(1))
                .andExpect(jsonPath("$.amountDue").value(3000.00))
                .andExpect(jsonPath("$.liveOutstandingBalance").value(2000.00));
    }

    @Test
    @DisplayName("7. Explicit Save New Version captures Version 2 with optimistic locking, rejecting stale revision with 409")
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testSaveNewVersionWithOptimisticLocking() throws Exception {
        LocalDate pastThursday = LocalDate.now(MANILA_ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.THURSDAY)).minusWeeks(2);
        createTestShipment("SH-VER-" + UUID.randomUUID().toString().substring(0, 8),
                pastThursday.minusDays(3), pastThursday.minusDays(3).atTime(9, 0), new BigDecimal("4000.00"));

        // Capture V1
        mockMvc.perform(post("/api/v1/soa/ensure-v1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new EnsureV1Request(testClient.getClientId(), pastThursday, UUID.randomUUID().toString()))))
                .andExpect(status().isOk());

        // Attempt to save V2 with STALE revision (e.g. revision 99)
        SaveStatementVersionRequest staleReq = new SaveStatementVersionRequest(
                testClient.getClientId(),
                pastThursday,
                new BigDecimal("200.00"),
                "Adjustment V2",
                "Collector Mary",
                99,
                UUID.randomUUID().toString()
        );
        mockMvc.perform(post("/api/v1/soa/version")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(staleReq)))
                .andExpect(status().isConflict());

        // Save V2 with expected financialRevision = 1
        SaveStatementVersionRequest validV2Req = new SaveStatementVersionRequest(
                testClient.getClientId(),
                pastThursday,
                new BigDecimal("200.00"),
                "Adjustment V2 Approved",
                "Collector Mary",
                1,
                UUID.randomUUID().toString()
        );
        mockMvc.perform(post("/api/v1/soa/version")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validV2Req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeVersion").value(2))
                .andExpect(jsonPath("$.latestVersionNumber").value(2))
                .andExpect(jsonPath("$.versionsCount").value(2))
                .andExpect(jsonPath("$.deductionAmount").value(200.00))
                .andExpect(jsonPath("$.amountDue").value(3800.00));

        // List versions endpoint returns both V2 and V1
        Soa soa = soaRepository.findByClient_ClientIdAndStatementDate(testClient.getClientId(), pastThursday).orElseThrow();
        mockMvc.perform(get("/api/v1/soa/versions")
                        .param("soaNo", soa.getSoaNo()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].versionNumber").value(2))
                .andExpect(jsonPath("$[1].versionNumber").value(1));
    }

    @Test
    @DisplayName("8. Role gating: non-admin roles are rejected with 403 Forbidden on version capture endpoints")
    void testNonAdminForbiddenOnVersionEndpoints() throws Exception {
        LocalDate pastThursday = LocalDate.now(MANILA_ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.THURSDAY)).minusWeeks(2);
        EnsureV1Request ensureReq = new EnsureV1Request(testClient.getClientId(), pastThursday, UUID.randomUUID().toString());

        // RECEIVING_STAFF
        mockMvc.perform(post("/api/v1/soa/ensure-v1")
                        .with(user("USR-STAFF").roles("RECEIVING_STAFF"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(ensureReq)))
                .andExpect(status().isForbidden());

        // DRIVER
        mockMvc.perform(post("/api/v1/soa/ensure-v1")
                        .with(user("USR-DRIVER").roles("DRIVER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(ensureReq)))
                .andExpect(status().isForbidden());

        // HAULER
        mockMvc.perform(post("/api/v1/soa/ensure-v1")
                        .with(user("USR-HAULER").roles("HAULER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(ensureReq)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("9. Staff retention audit: user who captured SOA version cannot be deleted without audit preservation")
    @WithMockUser(username = "USR-AUDIT-ADMIN", roles = {"ADMIN"})
    void testStaffRetentionAuditIntegrity() throws Exception {
        AppUser staffUser = appUserRepository.findById("USR-AUDIT-ADMIN").orElseGet(() -> {
            AppUser u = new AppUser();
            u.setUserId("USR-AUDIT-ADMIN");
            u.setUsername("audit_admin");
            u.setPasswordHash("$2a$10$dummy");
            u.setRole(UserRole.ADMIN);
            u.setFullName("Audit Admin User");
            return appUserRepository.save(u);
        });

        LocalDate pastThursday = LocalDate.now(MANILA_ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.THURSDAY)).minusWeeks(2);
        createTestShipment("SH-AUD-" + UUID.randomUUID().toString().substring(0, 6),
                pastThursday.minusDays(3), pastThursday.minusDays(3).atTime(9, 0), new BigDecimal("1500.00"));

        // Capture V1
        EnsureV1Request ensureReq = new EnsureV1Request(testClient.getClientId(), pastThursday, UUID.randomUUID().toString());
        mockMvc.perform(post("/api/v1/soa/ensure-v1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(ensureReq)))
                .andExpect(status().isOk());

        // Audit presence count must be > 0 for this user
        long auditCount = appUserRepository.countAuditReferencePresence(staffUser.getUserId());
        assertTrue(auditCount > 0, "Audit reference presence must include soa_version captured_by_user_id");
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void generateAfterFinalizationPreservesLedgerAndSnapshot() throws Exception {
        LocalDate cycle = LocalDate.now(MANILA_ZONE).with(TemporalAdjusters.previous(DayOfWeek.THURSDAY));
        createTestShipment("SH-NOOP-" + UUID.randomUUID().toString().substring(0, 6),
                cycle.minusDays(1), cycle.minusDays(1).atTime(10, 0), new BigDecimal("1000.00"));
        SaveStatementRequest request = new SaveStatementRequest(testClient.getClientId(), cycle,
                new BigDecimal("100.00"), "Saved", "Collector");
        mockMvc.perform(post("/api/v1/soa/save").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request))).andExpect(status().isOk());
        Soa before = soaRepository.findByClient_ClientIdAndStatementDate(testClient.getClientId(), cycle).orElseThrow();
        int revision = before.getFinancialRevision();
        String snapshot = soaVersionRepository.findBySoaNoAndVersionNumber(before.getSoaNo(), 1).orElseThrow().getPrintableData();
        request.setDeductionAmount(BigDecimal.ZERO);
        mockMvc.perform(post("/api/v1/soa/generate").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request))).andExpect(status().isOk())
                .andExpect(jsonPath("$.deductionAmount").value(100));
        assertEquals(revision, before.getFinancialRevision());
        assertEquals(0, new BigDecimal("900.00").compareTo(before.getOutstandingBalance()));
        assertEquals(snapshot, soaVersionRepository.findBySoaNoAndVersionNumber(before.getSoaNo(), 1).orElseThrow().getPrintableData());
        assertEquals(1, soaVersionRepository.countBySoaNo(before.getSoaNo()));
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void invalidGenerateNeverWrites() throws Exception {
        LocalDate cycle = LocalDate.now(MANILA_ZONE).with(TemporalAdjusters.previous(DayOfWeek.THURSDAY));
        long statementsBefore = soaRepository.count();
        for (BigDecimal invalid : List.of(new BigDecimal("-1"), new BigDecimal("0.001"))) {
            SaveStatementRequest request = new SaveStatementRequest(testClient.getClientId(), cycle, invalid, "", "");
            mockMvc.perform(post("/api/v1/soa/generate").contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request))).andExpect(status().isBadRequest());
        }
        mockMvc.perform(post("/api/v1/soa/generate").param("clientId", testClient.getClientId()))
                .andExpect(status().isBadRequest());
        assertEquals(statementsBefore, soaRepository.count());
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void requestIdCannotBeReusedForDifferentOperationOrInput() throws Exception {
        LocalDate cycle = LocalDate.now(MANILA_ZONE).with(TemporalAdjusters.previous(DayOfWeek.THURSDAY));
        createTestShipment("SH-RETRY-" + UUID.randomUUID().toString().substring(0, 6),
                cycle.minusDays(1), cycle.minusDays(1).atTime(10, 0), new BigDecimal("1000.00"));
        String requestId = UUID.randomUUID().toString();
        SaveStatementRequest save = new SaveStatementRequest(testClient.getClientId(), cycle, new BigDecimal("10"), "", "");
        save.setRequestId(requestId);
        for (int attempt = 0; attempt < 2; attempt++) {
            mockMvc.perform(post("/api/v1/soa/save").contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(save))).andExpect(status().isOk())
                    .andExpect(jsonPath("$.activeVersion").value(1));
        }
        save.setDeductionAmount(new BigDecimal("20"));
        mockMvc.perform(post("/api/v1/soa/save").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(save))).andExpect(status().isConflict());
        mockMvc.perform(post("/api/v1/soa/ensure-v1").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new EnsureV1Request(testClient.getClientId(), cycle, requestId))))
                .andExpect(status().isConflict());
        Soa soa = soaRepository.findByClient_ClientIdAndStatementDate(testClient.getClientId(), cycle).orElseThrow();
        assertEquals(1, soaVersionRepository.countBySoaNo(soa.getSoaNo()));
        assertEquals(0, new BigDecimal("10").compareTo(soa.getDeductions()));
    }

    @Autowired private com.tnl.logistics.service.SoaService soaService;

    @Test
    void directGenerateValidatesBeforePersistence() {
        long before = soaRepository.count();
        SaveStatementRequest request = new SaveStatementRequest(testClient.getClientId(), LocalDate.now(),
                new BigDecimal("-1"), "", "");
        org.junit.jupiter.api.Assertions.assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> soaService.generateStatement(request, "USR-ADMIN"));
        request.setDeductionAmount(new BigDecimal("0.001"));
        org.junit.jupiter.api.Assertions.assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> soaService.generateStatement(request, "USR-ADMIN"));
        request.setDeductionAmount(BigDecimal.ZERO);
        request.setDeductionNote("x".repeat(256));
        org.junit.jupiter.api.Assertions.assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> soaService.generateStatement(request, "USR-ADMIN"));
        assertEquals(before, soaRepository.count());
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void ensureExistingVersionRetainsOriginalResultAndRejectsOtherSelectors() throws Exception {
        LocalDate cycle = LocalDate.now(MANILA_ZONE).with(TemporalAdjusters.previous(DayOfWeek.THURSDAY));
        createTestShipment("SH-ALIAS-" + UUID.randomUUID().toString().substring(0, 6),
                cycle.minusDays(1), cycle.minusDays(1).atTime(10, 0), new BigDecimal("1000.00"));
        var first = soaService.ensureV1Snapshot(new EnsureV1Request(testClient.getClientId(), cycle, UUID.randomUUID().toString()), "USR-ADMIN");
        EnsureV1Request ensure = new EnsureV1Request(testClient.getClientId(), cycle, UUID.randomUUID().toString());
        soaService.ensureV1Snapshot(ensure, "USR-ADMIN");
        soaService.saveStatementVersion(new SaveStatementVersionRequest(testClient.getClientId(), cycle, new BigDecimal("10"),
                "Changed", "Collector", first.getFinancialRevision(), UUID.randomUUID().toString()), "USR-ADMIN");
        mockMvc.perform(post("/api/v1/soa/ensure-v1").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(ensure))).andExpect(status().isOk())
                .andExpect(jsonPath("$.activeVersion").value(1));
        ensure.setTargetDate(cycle.minusWeeks(1));
        mockMvc.perform(post("/api/v1/soa/ensure-v1").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(ensure))).andExpect(status().isConflict());
        ensure.setTargetDate(cycle);
        ensure.setClientId("CL-DIFFERENT");
        mockMvc.perform(post("/api/v1/soa/ensure-v1").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(ensure))).andExpect(status().isConflict());
        assertEquals(2, soaVersionRepository.countBySoaNo(first.getSoaNo()));
        Soa soa = soaRepository.findById(first.getSoaNo()).orElseThrow();
        assertEquals(0, new BigDecimal("990").compareTo(soa.getOutstandingBalance()));
    }

    @Test
    void laterUnassignedShipmentCannotChangeFinalizedMembershipOrRevisionTotals() {
        LocalDate cycle = LocalDate.now(MANILA_ZONE).with(TemporalAdjusters.previous(DayOfWeek.THURSDAY));
        createTestShipment("SH-MEMBER-" + UUID.randomUUID().toString().substring(0, 6),
                cycle.minusDays(1), cycle.minusDays(1).atTime(10, 0), new BigDecimal("1000.00"));
        var first = soaService.ensureV1Snapshot(new EnsureV1Request(testClient.getClientId(), cycle, UUID.randomUUID().toString()), "USR-ADMIN");
        Shipment late = createTestShipment("SH-LATE-" + UUID.randomUUID().toString().substring(0, 6),
                cycle.minusDays(1), cycle.minusDays(1).atTime(11, 0), new BigDecimal("2000.00"));
        var live = soaService.getStatementPreview(testClient.getClientId(), cycle);
        assertEquals(1, live.getItems().size());
        var revised = soaService.saveStatementVersion(new SaveStatementVersionRequest(testClient.getClientId(), cycle,
                new BigDecimal("10"), "Adjusted", "Collector", live.getFinancialRevision(), UUID.randomUUID().toString()), "USR-ADMIN");
        assertEquals(1, revised.getItems().size());
        assertEquals(0, new BigDecimal("990").compareTo(revised.getAmountDue()));
        assertEquals(0, revised.getAmountDue().compareTo(soaRepository.findById(first.getSoaNo()).orElseThrow().getOutstandingBalance()));
        assertEquals(null, shipmentRepository.findById(late.getShipmentId()).orElseThrow().getStatementId());
    }

    @Autowired private jakarta.persistence.EntityManager entityManager;

    @Test
    void existingSnapshotContentCannotBeUpdatedByThePersistenceModel() {
        LocalDate cycle = LocalDate.now(MANILA_ZONE).with(TemporalAdjusters.previous(DayOfWeek.THURSDAY));
        var captured = soaService.ensureV1Snapshot(new EnsureV1Request(testClient.getClientId(), cycle, UUID.randomUUID().toString()), "USR-ADMIN");
        entityManager.clear();
        SoaVersion version = soaVersionRepository.findBySoaNoAndVersionNumber(captured.getSoaNo(), 1).orElseThrow();
        String original = version.getPrintableData();
        org.springframework.test.util.ReflectionTestUtils.setField(version, "printableData", "{}");
        entityManager.flush();
        entityManager.clear();
        assertEquals(original, soaVersionRepository.findBySoaNoAndVersionNumber(captured.getSoaNo(), 1).orElseThrow().getPrintableData());
    }
}
