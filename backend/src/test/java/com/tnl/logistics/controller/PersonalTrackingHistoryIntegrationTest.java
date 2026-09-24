package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.config.DataSeeder;
import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.dto.ParcelUnitRequest;
import com.tnl.logistics.dto.ShipmentRegistrationRequest;
import com.tnl.logistics.dto.ShipmentResponse;
import com.tnl.logistics.dto.TrackingScanRequest;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.ShipmentService;
import com.tnl.logistics.service.TrackingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class PersonalTrackingHistoryIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ShipmentService shipmentService;

    @Autowired
    private TrackingService trackingService;

    @Autowired
    private DataSeeder dataSeeder;

    @Autowired
    private ShipmentRepository shipmentRepository;

    @Autowired
    private ParcelUnitRepository parcelUnitRepository;

    @Autowired
    private TrackingEventRepository trackingEventRepository;

    @Autowired
    private VehicleRepository vehicleRepository;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    @Autowired
    private jakarta.persistence.EntityManager entityManager;

    private String field1Token;
    private String field2Token;
    private String officeToken;
    private String adminToken;

    private AppUser fieldUser1;
    private AppUser fieldUser2;

    @BeforeEach
    public void setup() throws Exception {
        if (shipmentRepository.count() == 0) {
            dataSeeder.run();
        }

        fieldUser1 = appUserRepository.findById("USR-FIELD-1").orElseGet(() -> {
            AppUser u = new AppUser("USR-FIELD-1", "field_staff_1", passwordEncoder.encode("field123"), "Field Staff One", UserRole.FIELD_STAFF);
            u.setStaffType(StaffType.INTERNAL_TRUCK);
            return appUserRepository.save(u);
        });
        fieldUser1.setMustChangePassword(false);
        fieldUser1.setTokenVersion(1);
        appUserRepository.save(fieldUser1);

        fieldUser2 = appUserRepository.findById("USR-FIELD-2").orElseGet(() -> {
            AppUser u = new AppUser("USR-FIELD-2", "field_staff_2", passwordEncoder.encode("field123"), "Field Staff Two", UserRole.FIELD_STAFF);
            u.setStaffType(StaffType.INTERNAL_TRUCK);
            return appUserRepository.save(u);
        });
        fieldUser2.setMustChangePassword(false);
        fieldUser2.setTokenVersion(1);
        appUserRepository.save(fieldUser2);

        AppUser officeUser = appUserRepository.findById("USR-OFFICE").orElseGet(() -> {
            AppUser u = new AppUser("USR-OFFICE", "office_staff", passwordEncoder.encode("office123"), "Office Staff User", UserRole.OFFICE_STAFF);
            return appUserRepository.save(u);
        });
        officeUser.setMustChangePassword(false);
        officeUser.setTokenVersion(1);
        appUserRepository.save(officeUser);

        AppUser adminUser = appUserRepository.findById("USR-ADMIN").orElseGet(() -> {
            AppUser u = new AppUser("USR-ADMIN", "admin", passwordEncoder.encode("admin123"), "Admin User", UserRole.ADMIN);
            return appUserRepository.save(u);
        });
        adminUser.setMustChangePassword(false);
        adminUser.setTokenVersion(1);
        appUserRepository.save(adminUser);

        field1Token = "Bearer " + JwtTokenProvider.generateToken("USR-FIELD-1", "FIELD_STAFF");
        field2Token = "Bearer " + JwtTokenProvider.generateToken("USR-FIELD-2", "FIELD_STAFF");
        officeToken = "Bearer " + JwtTokenProvider.generateToken("USR-OFFICE", "OFFICE_STAFF");
        adminToken = "Bearer " + JwtTokenProvider.generateToken("USR-ADMIN", "ADMIN");

        if (!clientRepository.existsById("CL-001")) {
            clientRepository.save(new Client("CL-001", "Acme Client", "Manila", "09170000000", "client@acme.com", ChargeModel.FLAT, true));
        }

        vehicleRepository.findById("VH-001").ifPresentOrElse(v -> {
            v.setPlateNumber("ABC-1234");
            vehicleRepository.save(v);
        }, () -> {
            vehicleRepository.save(new Vehicle("VH-001", "ABC-1234", "Truck 1"));
        });
    }

    private String createTestShipment(int quantity) {
        ShipmentRegistrationRequest regReq = new ShipmentRegistrationRequest();
        regReq.setClientId("CL-001");
        regReq.setRecipientName("Juan Dela Cruz");
        regReq.setRecipientAddress("Baguio City");
        regReq.setRecipientContact("09181234567");
        regReq.setQuantity(quantity);
        regReq.setChargeModel(ChargeModel.FLAT);
        regReq.setShippingFee(new BigDecimal("350.00"));
        regReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);

        List<ParcelUnitRequest> parcels = new ArrayList<>();
        for (int i = 1; i <= quantity; i++) {
            parcels.add(new ParcelUnitRequest(i, new BigDecimal("2.5"), new BigDecimal("20"), new BigDecimal("15"), new BigDecimal("10")));
        }
        regReq.setParcels(parcels);

        ShipmentResponse shipResp = shipmentService.registerShipment(regReq, "USR-OFFICE");
        return shipResp.getTrackingIds().get(0);
    }

    // 1. Field staff can retrieve their personal event feed
    @Test
    public void testFieldStaffCanRetrievePersonalEventFeed() throws Exception {
        String trackingId = createTestShipment(1);
        trackingService.processStatusScan(new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "Scan 1"), "USR-FIELD-1");

        mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.page.totalElements").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.content[0].syncStatus").value("SYNCED"));
    }

    // 2. Feed events match the authenticated principal's staff_id
    // 3. Another field employee's events are excluded
    @Test
    public void testFeedEventsMatchAuthenticatedPrincipalAndExcludeOtherEmployees() throws Exception {
        String trackingId1 = createTestShipment(1);
        String trackingId2 = createTestShipment(1);

        trackingService.processStatusScan(new TrackingScanRequest(trackingId1, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "By Field 1"), "USR-FIELD-1");
        trackingService.processStatusScan(new TrackingScanRequest(trackingId2, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "By Field 2"), "USR-FIELD-2");

        // Field 1 query should contain trackingId1 and NOT trackingId2
        mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].trackingId", hasItem(trackingId1)))
                .andExpect(jsonPath("$.content[*].trackingId", not(hasItem(trackingId2))));

        // Field 2 query should contain trackingId2 and NOT trackingId1
        mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field2Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].trackingId", hasItem(trackingId2)))
                .andExpect(jsonPath("$.content[*].trackingId", not(hasItem(trackingId1))));
    }

    // 4. Office, admin, and unauthenticated callers cannot use personal endpoints
    @Test
    public void testNonFieldStaffCannotAccessPersonalEndpoints() throws Exception {
        String trackingId = createTestShipment(1);
        trackingService.processStatusScan(new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "By Field 1"), "USR-FIELD-1");

        // Office staff -> 403
        mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", officeToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/tracking-events/mine/metrics")
                        .header("Authorization", officeToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/tracking-events/mine/parcels/" + trackingId)
                        .header("Authorization", officeToken))
                .andExpect(status().isForbidden());

        // Admin -> 403
        mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", adminToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/tracking-events/mine/metrics")
                        .header("Authorization", adminToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/tracking-events/mine/parcels/" + trackingId)
                        .header("Authorization", adminToken))
                .andExpect(status().isForbidden());

        // Unauthenticated -> 401
        mockMvc.perform(get("/api/v1/tracking-events/mine"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/tracking-events/mine/metrics"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/tracking-events/mine/parcels/" + trackingId))
                .andExpect(status().isUnauthorized());
    }

    // 5. Request parameters cannot select another staff member
    @Test
    public void testRequestParametersCannotSelectAnotherStaffMember() throws Exception {
        String trackingId2 = createTestShipment(1);
        trackingService.processStatusScan(new TrackingScanRequest(trackingId2, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "By Field 2"), "USR-FIELD-2");

        // Calling as Field 1 but sending spoofed staffId or username parameters
        mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token)
                        .param("staffId", "USR-FIELD-2")
                        .param("username", "field_staff_2")
                        .param("actingStaffUserId", "USR-FIELD-2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].trackingId", not(hasItem(trackingId2))));
    }

    // 6. Results sort by timestamp descending and event ID descending
    @Test
    public void testResultsSortByTimestampDescendingAndEventIdDescending() throws Exception {
        String trackingId = createTestShipment(1);
        trackingService.processStatusScan(new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "Scan 1"), "USR-FIELD-1");
        trackingService.processStatusScan(new TrackingScanRequest(trackingId, ParcelStatus.ARRIVED_AT_TNL, null, "Scan 2"), "USR-FIELD-1");

        MvcResult result = mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode content = root.get("content");
        assertTrue(content.size() >= 2);

        long id0 = content.get(0).get("eventId").asLong();
        long id1 = content.get(1).get("eventId").asLong();
        assertTrue(id0 > id1, "Newer event must appear first");
        assertEquals("ARRIVED_AT_TNL", content.get(0).get("statusCode").asText());
        assertEquals("LOADED_ON_TRUCK", content.get(1).get("statusCode").asText());
    }

    // 7. Adjacent pages contain no duplicate or missing events
    @Test
    public void testAdjacentPagesContainNoDuplicateOrMissingEvents() throws Exception {
        List<String> trackingIds = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            String id = createTestShipment(1);
            trackingService.processStatusScan(new TrackingScanRequest(id, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "Scan " + i), "USR-FIELD-1");
            trackingIds.add(id);
        }

        MvcResult page0Result = mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token)
                        .param("page", "0")
                        .param("size", "3"))
                .andExpect(status().isOk())
                .andReturn();

        MvcResult page1Result = mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token)
                        .param("page", "1")
                        .param("size", "3"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode p0 = objectMapper.readTree(page0Result.getResponse().getContentAsString()).get("content");
        JsonNode p1 = objectMapper.readTree(page1Result.getResponse().getContentAsString()).get("content");

        List<Long> page0Ids = new ArrayList<>();
        p0.forEach(node -> page0Ids.add(node.get("eventId").asLong()));

        List<Long> page1Ids = new ArrayList<>();
        p1.forEach(node -> page1Ids.add(node.get("eventId").asLong()));

        assertEquals(3, page0Ids.size());
        assertEquals(2, page1Ids.size());

        List<Long> allExpectedIds = new ArrayList<>(page0Ids);
        allExpectedIds.addAll(page1Ids);
        assertEquals(5, allExpectedIds.size(), "Combined pages must contain all 5 created events without omissions");

        for (Long id : page0Ids) {
            assertFalse(page1Ids.contains(id), "Page 1 must not contain IDs from Page 0");
        }
    }

    // 7b. Equal timestamp events sort deterministically by eventId descending
    @Test
    public void testEqualTimestampSortsByEventIdDescending() throws Exception {
        String trackingId = createTestShipment(1);
        ParcelUnit parcel = parcelUnitRepository.findById(trackingId).orElseThrow();

        TrackingEvent eventA = new TrackingEvent(parcel, ParcelStatus.LOADED_ON_TRUCK, fieldUser1, "Event A");
        TrackingEvent eventB = new TrackingEvent(parcel, ParcelStatus.ARRIVED_AT_TNL, fieldUser1, "Event B");
        trackingEventRepository.saveAllAndFlush(List.of(eventA, eventB));

        LocalDateTime fixedTimestamp = LocalDateTime.now().minusHours(2);
        entityManager.createNativeQuery("UPDATE tracking_event SET event_timestamp = :fixedTs WHERE event_id IN (:idA, :idB)")
                .setParameter("fixedTs", fixedTimestamp)
                .setParameter("idA", eventA.getEventId())
                .setParameter("idB", eventB.getEventId())
                .executeUpdate();
        entityManager.clear();

        long higherId = Math.max(eventA.getEventId(), eventB.getEventId());
        long lowerId = Math.min(eventA.getEventId(), eventB.getEventId());

        MvcResult result = mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token)
                        .param("search", trackingId))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode content = objectMapper.readTree(result.getResponse().getContentAsString()).get("content");
        assertTrue(content.size() >= 2);
        assertEquals(higherId, content.get(0).get("eventId").asLong(), "Higher eventId must appear first on equal timestamp");
        assertEquals(lowerId, content.get(1).get("eventId").asLong());
    }

    // 8. Size is clamped to 1–50 and negative pages become page zero
    @Test
    public void testPageAndSizeClamping() throws Exception {
        String trackingId = createTestShipment(1);
        trackingService.processStatusScan(new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "Clamping scan"), "USR-FIELD-1");

        // Negative page clamped to 0
        mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token)
                        .param("page", "-5")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.number").value(0))
                .andExpect(jsonPath("$.page.size").value(10));

        // Size < 1 clamped to 1
        mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token)
                        .param("size", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.size").value(1));

        // Size > 50 clamped to 50
        mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token)
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.size").value(50));
    }

    // 9. Tracking ID search remains personal
    // 10. Shipment ID search remains personal
    @Test
    public void testTrackingAndShipmentSearchRemainPersonal() throws Exception {
        String trackingId1 = createTestShipment(1);
        String trackingId2 = createTestShipment(1);

        ParcelUnit pu1 = parcelUnitRepository.findById(trackingId1).orElseThrow();
        String shipmentId1 = pu1.getShipment().getShipmentId();

        ParcelUnit pu2 = parcelUnitRepository.findById(trackingId2).orElseThrow();
        String shipmentId2 = pu2.getShipment().getShipmentId();

        trackingService.processStatusScan(new TrackingScanRequest(trackingId1, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "Scan 1"), "USR-FIELD-1");
        trackingService.processStatusScan(new TrackingScanRequest(trackingId2, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "Scan 2"), "USR-FIELD-2");

        // Search by tracking ID for own scan
        mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token)
                        .param("search", trackingId1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].trackingId").value(trackingId1));

        // Search by tracking ID for other user's scan returns empty content
        mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token)
                        .param("search", trackingId2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)));

        // Search by shipment ID for own scan
        mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token)
                        .param("search", shipmentId1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].shipmentId").value(shipmentId1));

        // Search by shipment ID for other user's scan returns empty content
        mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token)
                        .param("search", shipmentId2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)));
    }

    // 11. Exact status filtering works for every supported status
    @Test
    public void testStatusFilteringWorksForSupportedStatuses() throws Exception {
        String trackingId = createTestShipment(1);
        ParcelUnit parcel = parcelUnitRepository.findById(trackingId).orElseThrow();

        TrackingEvent regEvent = new TrackingEvent(parcel, ParcelStatus.REGISTERED, fieldUser1, "Reg");
        TrackingEvent qrEvent = new TrackingEvent(parcel, ParcelStatus.QR_GENERATED, fieldUser1, "QR");
        TrackingEvent loadedEvent = new TrackingEvent(parcel, ParcelStatus.LOADED_ON_TRUCK, fieldUser1, "Loaded");
        TrackingEvent arrivedEvent = new TrackingEvent(parcel, ParcelStatus.ARRIVED_AT_TNL, fieldUser1, "Arrived");
        TrackingEvent haulerEvent = new TrackingEvent(parcel, ParcelStatus.LOADED_TO_HAULER, fieldUser1, "Hauler");
        TrackingEvent compEvent = new TrackingEvent(parcel, ParcelStatus.COMPLETED, fieldUser1, "Comp");
        trackingEventRepository.saveAllAndFlush(List.of(regEvent, qrEvent, loadedEvent, arrivedEvent, haulerEvent, compEvent));

        for (ParcelStatus status : List.of(
                ParcelStatus.REGISTERED,
                ParcelStatus.QR_GENERATED,
                ParcelStatus.LOADED_ON_TRUCK,
                ParcelStatus.ARRIVED_AT_TNL,
                ParcelStatus.LOADED_TO_HAULER,
                ParcelStatus.COMPLETED)) {
            mockMvc.perform(get("/api/v1/tracking-events/mine")
                            .header("Authorization", field1Token)
                            .param("status", status.name()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
                    .andExpect(jsonPath("$.content[*].statusCode", everyItem(is(status.name()))));
        }

        // Invalid status returns 400 Bad Request
        mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token)
                        .param("status", "INVALID_STATUS"))
                .andExpect(status().isBadRequest());
    }

    // 12. Metrics count only the authenticated staff member's events
    // 13. Metrics exclude yesterday's events and another employee's events
    // 14. Total metrics include QR-generated events
    // 15. Loaded, arrived, and handed metrics count their exact statuses
    @Test
    public void testPersonalScanMetrics() throws Exception {
        String trackingId1 = createTestShipment(1);
        String trackingId2 = createTestShipment(1);

        // Field 1 scans: LOADED_ON_TRUCK, ARRIVED_AT_TNL
        trackingService.processStatusScan(new TrackingScanRequest(trackingId1, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "Scan 1"), "USR-FIELD-1");
        trackingService.processStatusScan(new TrackingScanRequest(trackingId1, ParcelStatus.ARRIVED_AT_TNL, null, "Scan 2"), "USR-FIELD-1");

        // Field 1 QR_GENERATED event today (counts toward totalScans only)
        ParcelUnit parcel1 = parcelUnitRepository.findById(trackingId1).orElseThrow();
        TrackingEvent qrEvent = new TrackingEvent(parcel1, ParcelStatus.QR_GENERATED, fieldUser1, "Field 1 QR scan");
        trackingEventRepository.saveAndFlush(qrEvent);

        // Field 2 scans: LOADED_ON_TRUCK
        trackingService.processStatusScan(new TrackingScanRequest(trackingId2, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "Scan 3"), "USR-FIELD-2");

        // Create an event manually with yesterday's timestamp for Field 1 to verify date exclusion
        TrackingEvent yesterdayEvent = new TrackingEvent(parcel1, ParcelStatus.LOADED_TO_HAULER, fieldUser1, "Yesterday scan");
        trackingEventRepository.saveAndFlush(yesterdayEvent);
        entityManager.createNativeQuery("UPDATE tracking_event SET event_timestamp = :past WHERE event_id = :id")
                .setParameter("past", LocalDateTime.now().minusDays(1))
                .setParameter("id", yesterdayEvent.getEventId())
                .executeUpdate();
        entityManager.clear();

        MvcResult result = mockMvc.perform(get("/api/v1/tracking-events/mine/metrics")
                        .header("Authorization", field1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").isNotEmpty())
                .andExpect(jsonPath("$.totalScans").value(3))
                .andExpect(jsonPath("$.loadedOnTruck").value(1))
                .andExpect(jsonPath("$.arrivedAtTnl").value(1))
                .andExpect(jsonPath("$.handedToHauler").value(0))
                .andReturn();

        // Field 2 metrics
        mockMvc.perform(get("/api/v1/tracking-events/mine/metrics")
                        .header("Authorization", field2Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalScans").value(1))
                .andExpect(jsonPath("$.loadedOnTruck").value(1))
                .andExpect(jsonPath("$.arrivedAtTnl").value(0))
                .andExpect(jsonPath("$.handedToHauler").value(0));
    }

    // 16. Idempotent requests that create no event do not increase metrics
    @Test
    public void testIdempotentRequestsDoNotIncreaseMetrics() throws Exception {
        String trackingId = createTestShipment(1);

        // First transition creates event
        trackingService.processStatusScan(new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "Scan 1"), "USR-FIELD-1");

        // Idempotent repeat: does NOT create a new TrackingEvent
        trackingService.processStatusScan(new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "Scan 1 duplicate"), "USR-FIELD-1");

        mockMvc.perform(get("/api/v1/tracking-events/mine/metrics")
                        .header("Authorization", field1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalScans").value(1))
                .andExpect(jsonPath("$.loadedOnTruck").value(1));
    }

    // 17. Parcel detail succeeds when the staff member has scanned the parcel
    // 18. Parcel detail returns only that staff member's timeline events
    @Test
    public void testParcelDetailSucceedsAndReturnsOnlyStaffTimelineEvents() throws Exception {
        String trackingId = createTestShipment(1);

        // Field 1 scans LOADED_ON_TRUCK
        trackingService.processStatusScan(new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "By Field 1"), "USR-FIELD-1");

        // Field 2 scans ARRIVED_AT_TNL
        trackingService.processStatusScan(new TrackingScanRequest(trackingId, ParcelStatus.ARRIVED_AT_TNL, null, "By Field 2"), "USR-FIELD-2");

        // Field 1 requests parcel history
        MvcResult result = mockMvc.perform(get("/api/v1/tracking-events/mine/parcels/" + trackingId)
                        .header("Authorization", field1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackingId").value(trackingId))
                .andExpect(jsonPath("$.currentStatusCode").value("ARRIVED_AT_TNL"))
                .andExpect(jsonPath("$.events", hasSize(1)))
                .andExpect(jsonPath("$.events[0].statusCode").value("LOADED_ON_TRUCK"))
                .andReturn();
    }

    // 19. A parcel scanned only by another employee returns 404
    // 20. A nonexistent Tracking ID returns the same 404 response
    @Test
    public void testParcelScannedByAnotherOrNonexistentReturns404() throws Exception {
        String trackingId2 = createTestShipment(1);
        trackingService.processStatusScan(new TrackingScanRequest(trackingId2, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "By Field 2"), "USR-FIELD-2");

        // Field 1 queries parcel scanned only by Field 2 -> 404
        mockMvc.perform(get("/api/v1/tracking-events/mine/parcels/" + trackingId2)
                        .header("Authorization", field1Token))
                .andExpect(status().isNotFound());

        // Field 1 queries nonexistent tracking ID -> 404
        mockMvc.perform(get("/api/v1/tracking-events/mine/parcels/TRK-9999-999999")
                        .header("Authorization", field1Token))
                .andExpect(status().isNotFound());
    }

    // 21. Responses contain no recipient, address, contact, client, billing, payment, remarks, other staff, or print-event fields
    @Test
    public void testResponsesContainNoPiiOrForbiddenFields() throws Exception {
        String trackingId = createTestShipment(1);
        trackingService.processStatusScan(new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "Secret Remarks"), "USR-FIELD-1");

        // Feed response inspection
        MvcResult feedResult = mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode feedNode = objectMapper.readTree(feedResult.getResponse().getContentAsString()).get("content").get(0);
        assertNull(feedNode.get("recipientName"), "No recipient name in feed");
        assertNull(feedNode.get("recipientAddress"), "No recipient address in feed");
        assertNull(feedNode.get("recipientContact"), "No recipient contact in feed");
        assertNull(feedNode.get("client"), "No client in feed");
        assertNull(feedNode.get("billing"), "No billing in feed");
        assertNull(feedNode.get("payment"), "No payment in feed");
        assertNull(feedNode.get("remarks"), "No remarks in feed");
        assertNull(feedNode.get("staffName"), "No staff name in feed");
        assertNull(feedNode.get("printing"), "No printing in feed");

        // Detail response inspection
        MvcResult detailResult = mockMvc.perform(get("/api/v1/tracking-events/mine/parcels/" + trackingId)
                        .header("Authorization", field1Token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode detailNode = objectMapper.readTree(detailResult.getResponse().getContentAsString());
        assertNull(detailNode.get("recipientName"), "No recipient name in detail");
        assertNull(detailNode.get("recipientAddress"), "No recipient address in detail");
        assertNull(detailNode.get("recipientContact"), "No recipient contact in detail");
        assertNull(detailNode.get("client"), "No client in detail");
        assertNull(detailNode.get("billing"), "No billing in detail");
        assertNull(detailNode.get("payment"), "No payment in detail");
        assertNull(detailNode.get("remarks"), "No remarks in detail");
        assertNull(detailNode.get("printing"), "No printing in detail");
    }

    // 22. Vehicle fields are present only when an event or current state has a vehicle
    @Test
    public void testVehicleFieldsPresentOnlyWhenVehicleAssigned() throws Exception {
        String trackingId = createTestShipment(1);

        // 1. Event with vehicle
        trackingService.processStatusScan(new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "With vehicle"), "USR-FIELD-1");

        MvcResult resultWithVeh = mockMvc.perform(get("/api/v1/tracking-events/mine/parcels/" + trackingId)
                        .header("Authorization", field1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentVehicleId").value("VH-001"))
                .andExpect(jsonPath("$.currentVehiclePlateNumber").value("ABC-1234"))
                .andExpect(jsonPath("$.events[0].vehicleId").value("VH-001"))
                .andReturn();

        // 2. Next transition without vehicle
        trackingService.processStatusScan(new TrackingScanRequest(trackingId, ParcelStatus.ARRIVED_AT_TNL, null, "Without vehicle"), "USR-FIELD-1");

        mockMvc.perform(get("/api/v1/tracking-events/mine/parcels/" + trackingId)
                        .header("Authorization", field1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentVehicleId").value(nullValue()))
                .andExpect(jsonPath("$.currentVehiclePlateNumber").value(nullValue()));
    }

    // 23. The generic parcel-detail endpoint rejects FIELD_STAFF and permits authorized office users
    @Test
    public void testGenericParcelDetailRejectsFieldStaffAndPermitsOffice() throws Exception {
        String trackingId = createTestShipment(1);

        // FIELD_STAFF -> 403 Forbidden
        mockMvc.perform(get("/api/v1/parcel-units/" + trackingId)
                        .header("Authorization", field1Token))
                .andExpect(status().isForbidden());

        // OFFICE_STAFF -> 200 OK
        mockMvc.perform(get("/api/v1/parcel-units/" + trackingId)
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackingId").value(trackingId));

        // ADMIN -> 200 OK
        mockMvc.perform(get("/api/v1/parcel-units/" + trackingId)
                        .header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackingId").value(trackingId));
    }

    // 24. DTO mapping completes without lazy-loading errors
    @Test
    public void testDtoMappingCompletesWithoutLazyLoadingErrors() throws Exception {
        String trackingId = createTestShipment(1);
        trackingService.processStatusScan(new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "Lazy check"), "USR-FIELD-1");

        mockMvc.perform(get("/api/v1/tracking-events/mine")
                        .header("Authorization", field1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].packageIndex").value(1))
                .andExpect(jsonPath("$.content[0].packageCount").value(1));

        mockMvc.perform(get("/api/v1/tracking-events/mine/parcels/" + trackingId)
                        .header("Authorization", field1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.packageIndex").value(1))
                .andExpect(jsonPath("$.packageCount").value(1))
                .andExpect(jsonPath("$.events[0].packageIndex").value(1));
    }
}
