package com.tnl.logistics.controller;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.ParcelUnitRequest;
import com.tnl.logistics.dto.ShipmentRegistrationRequest;
import com.tnl.logistics.dto.TrackingScanRequest;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.ShipmentService;
import com.tnl.logistics.service.SystemSettingService;
import com.tnl.logistics.service.TrackingService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;

/**
 * Integration test verifying GET /api/v1/tracking-events audit log feed,
 * ID-first query filtering, metrics summary, and RBAC authorization boundaries.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class TrackingLogIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ShipmentService shipmentService;

    @Autowired
    private TrackingService trackingService;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private VehicleRepository vehicleRepository;

    @Autowired
    private TrackingEventRepository trackingEventRepository;

    @Autowired
    private ParcelUnitRepository parcelUnitRepository;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SystemSettingService systemSettingService;

    @BeforeEach
    void setup() {
        jdbcTemplate.update("UPDATE system_setting SET rate_per_kilo = 100.00 WHERE setting_id = 1");
        systemSettingService.refreshCachedSettings();

        if (!clientRepository.existsById("CL-001")) {
            clientRepository.save(new Client("CL-001", "Acme Logistics Client", "Manila", "09170000000", "client@acme.com", ChargeModel.FLAT, true));
        }

        if (!vehicleRepository.existsById("VH-001")) {
            vehicleRepository.save(new Vehicle("VH-001", "ABC-1234", "TNL Truck 1"));
        }

        if (!appUserRepository.existsById("USR-FIELD")) {
            AppUser courier = new AppUser("USR-FIELD", "carlos_mendoza", passwordEncoder.encode("field123"), "Carlos Mendoza", UserRole.COURIER_STAFF);
            courier.setMustChangePassword(false);
            appUserRepository.save(courier);
        }

        if (!appUserRepository.existsById("USR-DISPATCH")) {
            AppUser dispatch = new AppUser("USR-DISPATCH", "danilo_cruz", passwordEncoder.encode("field123"), "Danilo Cruz", UserRole.DISPATCH_STAFF);
            dispatch.setMustChangePassword(false);
            appUserRepository.save(dispatch);
        }
    }

    private String createShipmentWithScan(String recipient, String vehicleId, String staffId) {
        ShipmentRegistrationRequest regReq = new ShipmentRegistrationRequest();
        regReq.setClientId("CL-001");
        regReq.setRecipientName(recipient);
        regReq.setRecipientAddress("Baguio City");
        regReq.setRecipientContact("09181234567");
        regReq.setQuantity(1);
        regReq.setChargeModel(ChargeModel.FLAT);
        regReq.setShippingFee(new BigDecimal("350.00"));
        regReq.setExpectedRatePerKilo(new BigDecimal("100.00"));
        regReq.setExpectedVolumetricDivisor(5000);
        regReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        regReq.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("2.5"), new BigDecimal("20"), new BigDecimal("15"), new BigDecimal("10"))));

        var shipResp = shipmentService.registerShipment(regReq, "USR-OFFICE");
        String trackingId = shipResp.getTrackingIds().get(0);

        if (staffId != null) {
            trackingService.processStatusScan(
                    new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, vehicleId, "Loaded for dispatch"),
                    staffId
            );
        }
        return trackingId;
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testGetTrackingLogsAsAdminReturns200AndPageStructure() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("page", "0")
                .param("size", "10")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.page.totalElements").isNumber())
                .andExpect(jsonPath("$.page.totalPages").isNumber())
                .andExpect(jsonPath("$.page.size").value(10))
                .andExpect(jsonPath("$.page.number").value(0));
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testGetTrackingLogsAsAdminReturns200() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    @WithMockUser(username = "USR-COURIER", roles = {"COURIER_STAFF"})
    void testGetTrackingLogsAsFieldStaffReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "USR-OFFICE", roles = {"RECEIVING_STAFF"})
    void testGetTrackingLogsAsReceivingStaffReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "USR-DISPATCH", roles = {"DISPATCH_STAFF"})
    void testGetTrackingLogsAsDispatchStaffReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    void testGetTrackingLogsUnauthenticatedReturns401Unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testGetTrackingLogsWithStatusFilterReturns200() throws Exception {
        createShipmentWithScan("Filter Test Recipient", "VH-001", "USR-FIELD");

        mockMvc.perform(get("/api/v1/tracking-events")
                .param("status", "LOADED_ON_TRUCK")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.content[*].statusCode", everyItem(is("LOADED_ON_TRUCK"))));
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testGetTrackingMetricsAsAdminReturns200() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events/metrics")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todayTotalScans").isNumber())
                .andExpect(jsonPath("$.activeCouriersCount").isNumber())
                .andExpect(jsonPath("$.loadedOnTruckToday").isNumber())
                .andExpect(jsonPath("$.handedToHaulerToday").isNumber());
    }

    @Test
    @WithMockUser(username = "USR-COURIER", roles = {"COURIER_STAFF"})
    void testGetTrackingMetricsAsFieldStaffReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events/metrics")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    void testGetTrackingMetricsUnauthenticatedReturns401Unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events/metrics")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testMetricsDistinguishesDeskRegistrationFromCourierScans() throws Exception {
        trackingEventRepository.deleteAll();

        // 1. Initially metrics are all 0
        mockMvc.perform(get("/api/v1/tracking-events/metrics")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todayTotalScans").value(0))
                .andExpect(jsonPath("$.activeCouriersCount").value(0))
                .andExpect(jsonPath("$.loadedOnTruckToday").value(0))
                .andExpect(jsonPath("$.handedToHaulerToday").value(0));

        // 2. Desk registration as office staff
        ShipmentRegistrationRequest regReq = new ShipmentRegistrationRequest();
        regReq.setClientId("CL-001");
        regReq.setRecipientName("Realtime Recipient");
        regReq.setRecipientAddress("Baguio City");
        regReq.setRecipientContact("09181234567");
        regReq.setQuantity(1);
        regReq.setChargeModel(ChargeModel.FLAT);
        regReq.setShippingFee(new BigDecimal("350.00"));
        regReq.setExpectedRatePerKilo(new BigDecimal("100.00"));
        regReq.setExpectedVolumetricDivisor(5000);
        regReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        regReq.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("2.5"), new BigDecimal("20"), new BigDecimal("15"), new BigDecimal("10"))));

        var shipResp = shipmentService.registerShipment(regReq, "USR-OFFICE");
        String trackingId = shipResp.getTrackingIds().get(0);

        // Operational scans and active couriers must remain 0 for desk registrations
        mockMvc.perform(get("/api/v1/tracking-events/metrics")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todayTotalScans").value(0))
                .andExpect(jsonPath("$.activeCouriersCount").value(0))
                .andExpect(jsonPath("$.loadedOnTruckToday").value(0))
                .andExpect(jsonPath("$.handedToHaulerToday").value(0));

        // 3. Field courier performs a status scan (LOADED_ON_TRUCK)
        trackingService.processStatusScan(
                new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "Loaded for delivery"),
                "USR-FIELD"
        );

        // Metrics should now reflect 1 operational scan, 1 active courier, 1 loaded on truck
        mockMvc.perform(get("/api/v1/tracking-events/metrics")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todayTotalScans").value(1))
                .andExpect(jsonPath("$.activeCouriersCount").value(1))
                .andExpect(jsonPath("$.loadedOnTruckToday").value(1))
                .andExpect(jsonPath("$.handedToHaulerToday").value(0));
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testTrackingLogsPaginationClampingAndCsvCapacity() throws Exception {
        createShipmentWithScan("Pagination Test", "VH-001", "USR-FIELD");

        // Negative page clamped to 0
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("page", "-3")
                .param("size", "10")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.number").value(0))
                .andExpect(jsonPath("$.page.size").value(10));

        // Size < 1 clamped to 1
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("page", "0")
                .param("size", "0")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.size").value(1));

        // Size > 500 clamped to 500
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("page", "0")
                .param("size", "999")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.size").value(500));

        // Preserves 500-item CSV request
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("page", "0")
                .param("size", "500")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.size").value(500));
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testExactTotalsBeyondLastPage() throws Exception {
        createShipmentWithScan("Beyond Last Page", "VH-001", "USR-FIELD");

        mockMvc.perform(get("/api/v1/tracking-events")
                .param("page", "9999")
                .param("size", "25")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.page.number").value(9999))
                .andExpect(jsonPath("$.page.totalElements", greaterThan(0)));
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testSearchFilterAcrossAllSupportedFields() throws Exception {
        String trackingId = createShipmentWithScan("Search Target", "VH-001", "USR-FIELD");
        ParcelUnit parcel = parcelUnitRepository.findById(trackingId).orElseThrow();
        String shipmentId = parcel.getShipment().getShipmentId();

        // 1. Search by exact trackingId
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("search", trackingId)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.content[*].trackingId", hasItem(trackingId)));

        // 2. Search by lowercase trackingId substring
        String trackingSub = trackingId.substring(2, 8).toLowerCase();
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("search", trackingSub)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.content[*].trackingId", hasItem(trackingId)));

        // 3. Search by exact shipmentId
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("search", shipmentId)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.content[*].shipmentId", hasItem(shipmentId)));

        // 4. Search by lowercase shipmentId substring
        String shipmentSub = shipmentId.substring(2, 6).toLowerCase();
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("search", shipmentSub)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.content[*].shipmentId", hasItem(shipmentId)));

        // 5. Search by staff full name lowercase substring ("carlos")
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("search", "carlos")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.content[*].staffName", hasItem("Carlos Mendoza")));

        // 6. Search by staff username lowercase substring
        String staffUsername = appUserRepository.findById("USR-FIELD").map(AppUser::getUsername).orElse("field");
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("search", staffUsername.toLowerCase())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.content[*].staffUsername", hasItem(staffUsername)));

        // 7. Search by vehicle ID lowercase ("vh-001")
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("search", "vh-001")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.content[*].vehicleId", hasItem("VH-001")));

        // 8. Search by vehicle plate number lowercase
        String plateNumber = vehicleRepository.findById("VH-001").map(Vehicle::getPlateNumber).orElse("NCP-2401");
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("search", plateNumber.toLowerCase())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.content[*].vehiclePlateNumber", hasItem(plateNumber)));
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testCombinedFiltersSearchStatusAndDate() throws Exception {
        String trackingId = createShipmentWithScan("Combined Filter Target", "VH-001", "USR-FIELD");
        LocalDate today = LocalDate.now();

        // Matching combined search + status + date range
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("search", trackingId)
                .param("status", "LOADED_ON_TRUCK")
                .param("startDate", today.minusDays(1).toString())
                .param("endDate", today.plusDays(1).toString())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].trackingId").value(trackingId))
                .andExpect(jsonPath("$.content[0].status").value("LOADED_ON_TRUCK"));

        // Reversed date range (startDate > endDate) naturally produces empty results
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("search", trackingId)
                .param("status", "LOADED_ON_TRUCK")
                .param("startDate", today.plusDays(1).toString())
                .param("endDate", today.minusDays(1).toString())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.page.totalElements").value(0));
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testWildcardAndEscapeSearchInputs() throws Exception {
        createShipmentWithScan("Wildcard Target", "VH-001", "USR-FIELD");

        // % and _ in search should not crash the query
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("search", "TRK%")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());

        mockMvc.perform(get("/api/v1/tracking-events")
                .param("search", "VH_")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testNoMatchesReturnsEmptyContentAndZeroTotals() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("search", "NONEXISTENT_MATCH_999999")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.page.totalElements").value(0))
                .andExpect(jsonPath("$.page.totalPages").value(0));
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testTiedTimestampsSortDeterministicallyByEventIdDescending() throws Exception {
        String trackingId = createShipmentWithScan("Tie Sort Target", "VH-001", "USR-FIELD");
        ParcelUnit parcel = parcelUnitRepository.findById(trackingId).orElseThrow();
        AppUser courier = appUserRepository.findById("USR-FIELD").orElseThrow();

        TrackingEvent eventA = new TrackingEvent(parcel, ParcelStatus.LOADED_ON_TRUCK, courier, "Tie Event A");
        TrackingEvent eventB = new TrackingEvent(parcel, ParcelStatus.ARRIVED_AT_TNL, courier, "Tie Event B");
        trackingEventRepository.saveAllAndFlush(List.of(eventA, eventB));

        LocalDateTime tieTime = LocalDateTime.now().minusHours(3);
        entityManager.createNativeQuery("UPDATE tracking_event SET event_timestamp = :tie WHERE event_id IN (:idA, :idB)")
                .setParameter("tie", tieTime)
                .setParameter("idA", eventA.getEventId())
                .setParameter("idB", eventB.getEventId())
                .executeUpdate();
        entityManager.clear();

        long higherId = Math.max(eventA.getEventId(), eventB.getEventId());
        long lowerId = Math.min(eventA.getEventId(), eventB.getEventId());

        MvcResult result = mockMvc.perform(get("/api/v1/tracking-events")
                .param("search", trackingId)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode content = objectMapper.readTree(result.getResponse().getContentAsString()).get("content");
        assertTrue(content.size() >= 2);

        // Find the two tie events in the returned content
        long firstFoundId = -1;
        long secondFoundId = -1;
        for (JsonNode item : content) {
            long currentId = item.get("eventId").asLong();
            if (currentId == higherId || currentId == lowerId) {
                if (firstFoundId == -1) {
                    firstFoundId = currentId;
                } else if (secondFoundId == -1) {
                    secondFoundId = currentId;
                    break;
                }
            }
        }

        assertEquals(higherId, firstFoundId, "Higher event ID must appear first on timestamp tie");
        assertEquals(lowerId, secondFoundId, "Lower event ID must appear second on timestamp tie");
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testAdjacentPagesHaveNoDuplicatesOrOmissions() throws Exception {
        List<String> trackingIds = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            trackingIds.add(createShipmentWithScan("Adjacent Page Target " + i, "VH-001", "USR-FIELD"));
        }

        MvcResult page0Result = mockMvc.perform(get("/api/v1/tracking-events")
                .param("page", "0")
                .param("size", "3")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        MvcResult page1Result = mockMvc.perform(get("/api/v1/tracking-events")
                .param("page", "1")
                .param("size", "3")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode p0 = objectMapper.readTree(page0Result.getResponse().getContentAsString()).get("content");
        JsonNode p1 = objectMapper.readTree(page1Result.getResponse().getContentAsString()).get("content");

        assertEquals(3, p0.size(), "Page 0 must have exactly 3 items");
        assertTrue(p1.size() >= 1, "Page 1 must have at least 1 item");

        List<Long> p0Ids = new ArrayList<>();
        p0.forEach(node -> p0Ids.add(node.get("eventId").asLong()));

        List<Long> p1Ids = new ArrayList<>();
        p1.forEach(node -> p1Ids.add(node.get("eventId").asLong()));

        for (Long id : p0Ids) {
            assertFalse(p1Ids.contains(id), "Adjacent pages must not duplicate event IDs: " + id);
        }
        assertTrue(p0Ids.get(p0Ids.size() - 1) > p1Ids.get(0), "Events must follow descending sort across pages");
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testDtoSafetyAndRelationshipHydration() throws Exception {
        String trackingId = createShipmentWithScan("DTO Safety Target", "VH-001", "USR-FIELD");

        MvcResult result = mockMvc.perform(get("/api/v1/tracking-events")
                .param("search", trackingId)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode first = root.get("content").get(0);

        assertTrue(first.get("eventId").isNumber());
        assertEquals(trackingId, first.get("trackingId").asText());
        assertTrue(first.get("shipmentId").asText().startsWith("SHP-"));
        assertEquals("1 of 1", first.get("packageDisplay").asText());
        assertEquals("LOADED_ON_TRUCK", first.get("status").asText());
        assertEquals("Loaded on Truck", first.get("statusDisplay").asText());
        assertEquals("VH-001", first.get("vehicleId").asText());
        String expectedPlate = vehicleRepository.findById("VH-001").map(Vehicle::getPlateNumber).orElse("NCP-2401");
        assertEquals(expectedPlate, first.get("vehiclePlateNumber").asText());
        String expectedUsername = appUserRepository.findById("USR-FIELD").map(AppUser::getUsername).orElse("field");
        assertEquals(expectedUsername, first.get("staffUsername").asText());
        assertEquals("Carlos Mendoza", first.get("staffName").asText());
        assertEquals("COURIER_STAFF", first.get("staffRole").asText());
        assertNotNull(first.get("remarks").asText());
        assertNotNull(first.get("timestamp").asText());
        assertNotNull(first.get("formattedTimestamp").asText());
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testExactSearchIdsAcrossFieldsCaseWildcardsAndBackslashes() throws Exception {
        SearchFixture fixture = createSearchFixture(6);
        for (String search : List.of("SRCH-TRACK_1", "srch-track_1", "SRCH-SHIP", "sRcH pAtH",
                fixture.staff().getUsername(), "SRCH-VEH", fixture.vehicle().getPlateNumber().toLowerCase(Locale.ROOT),
                "SRCH", "  sRcH  ", "%", "_", "SRCH%", "\\%", "\\_", "\\", "\\\\",
                "Path\\\\Staff", "srch\\_\\%\\_user", "NO-SRCH-MATCH", "", "   ")) {
            assertExactSearchPage(search, null, null, null, 0, 25);
        }
        JsonNode response = assertExactSearchPage("SRCH", null, null, null, 0, 25);
        assertEquals(6, response.at("/page/totalElements").asInt());
        assertTrue(response.get("content").findValues("vehicleId").stream().anyMatch(JsonNode::isNull));
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testExactSearchIdsWithStatusDateBoundsAndReversedDates() throws Exception {
        SearchFixture fixture = createSearchFixture(6);
        LocalDate day = LocalDate.of(2036, 1, 10);
        setEventTimestamp(fixture.events().get(0).getEventId(), day.atStartOfDay());
        setEventTimestamp(fixture.events().get(1).getEventId(), day.atTime(23, 59, 59));
        setEventTimestamp(fixture.events().get(2).getEventId(), day.plusDays(1).atStartOfDay());
        entityManager.clear();
        assertExactSearchPage("SRCH", ParcelStatus.LOADED_ON_TRUCK, day, day, 0, 25);
        assertExactSearchPage("SRCH", null, day, null, 0, 25);
        assertExactSearchPage("SRCH", null, null, day, 0, 25);
        JsonNode reversed = assertExactSearchPage("SRCH", null, day.plusDays(1), day.minusDays(1), 0, 25);
        assertEquals(0, reversed.at("/page/totalElements").asInt());
        assertTrue(reversed.get("content").isEmpty());
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testSearchDeduplicationTiedOrderingAdjacentAndBeyondLastPages() throws Exception {
        SearchFixture fixture = createSearchFixture(6);
        List<Long> expectedIds = fixture.events().stream().map(TrackingEvent::getEventId)
                .sorted(java.util.Comparator.reverseOrder()).toList();
        List<Long> actualIds = new ArrayList<>();
        for (int page = 0; page < 3; page++) {
            JsonNode result = assertExactSearchPage("SRCH", null, null, null, page, 2);
            result.get("content").forEach(row -> actualIds.add(row.get("eventId").asLong()));
        }
        assertEquals(expectedIds, actualIds);
        assertEquals(6, new HashSet<>(actualIds).size());
        JsonNode beyond = assertExactSearchPage("SRCH", null, null, null, 9999, 2);
        assertEquals(6, beyond.at("/page/totalElements").asInt());
        assertTrue(beyond.get("content").isEmpty());
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testSearchCsvReturnsExactlyFiveHundredOrderedUniqueRows() throws Exception {
        createSearchFixture(502);
        JsonNode first = assertExactSearchPage("SRCH", null, null, null, 0, 500);
        JsonNode second = assertExactSearchPage("SRCH", null, null, null, 1, 500);
        JsonNode beyond = assertExactSearchPage("SRCH", null, null, null, 2, 500);
        assertEquals(500, first.get("content").size());
        assertEquals(2, second.get("content").size());
        assertEquals(502, beyond.at("/page/totalElements").asInt());
        assertTrue(beyond.get("content").isEmpty());
    }

    @Test
    void testGeneratedSearchSqlPreservesNullRelationshipsInReadOnlyFixture() {
        String fixture = """
                WITH parcel_unit AS (
                    SELECT 'MATCH-P' tracking_id, 'MATCH-S' shipment_id
                    UNION ALL SELECT 'OTHER-P', 'OTHER-S'),
                app_user AS (SELECT 'u1' user_id, 'match_user' username, 'Match Staff' full_name),
                vehicle AS (SELECT 'MATCH-V' vehicle_id, 'MATCH-PLATE' plate_number),
                tracking_event AS (
                    SELECT 1 event_id, 'MATCH-P' tracking_id, 'REGISTERED' status,
                           CAST(NULL AS CHAR(20)) staff_id, CAST(NULL AS CHAR(20)) vehicle_id,
                           TIMESTAMP('2036-01-10 12:00:00') event_timestamp
                    UNION ALL SELECT 2, 'MATCH-P', 'LOADED_ON_TRUCK', 'u1', NULL, TIMESTAMP('2036-01-10 12:00:00')
                    UNION ALL SELECT 3, 'OTHER-P', 'LOADED_ON_TRUCK', NULL, 'MATCH-V', TIMESTAMP('2036-01-10 12:00:00')
                    UNION ALL SELECT 4, 'OTHER-P', 'REGISTERED', NULL, NULL, TIMESTAMP('2036-01-10 12:00:00'))
                """;
        EntityManager queryFactory = org.mockito.Mockito.mock(EntityManager.class);
        jakarta.persistence.Query countQuery = org.mockito.Mockito.mock(jakarta.persistence.Query.class);
        org.mockito.Mockito.when(queryFactory.createNativeQuery(org.mockito.ArgumentMatchers.anyString())).thenReturn(countQuery);
        org.mockito.Mockito.when(countQuery.getSingleResult()).thenReturn(0L);
        AdminTrackingEventRepositoryImpl repository = new AdminTrackingEventRepositoryImpl();
        org.springframework.test.util.ReflectionTestUtils.setField(repository, "entityManager", queryFactory);
        repository.findAdminTrackingEvents("match", null, null, null, org.springframework.data.domain.PageRequest.of(0, 25));
        org.mockito.ArgumentCaptor<String> sql = org.mockito.ArgumentCaptor.forClass(String.class);
        org.mockito.Mockito.verify(queryFactory).createNativeQuery(sql.capture());
        String generatedSql = sql.getValue().replace("SELECT COUNT(*)", "SELECT e.event_id");
        List<Long> actual = readEventIds(fixture + generatedSql + " ORDER BY e.event_id", Map.of("search", "match"));
        List<Long> expected = readEventIds(fixture + "SELECT e.event_id" + existingSearchFromClause()
                + " ORDER BY e.event_id", Map.of("search", "match"));
        assertEquals(List.of(1L, 2L, 3L), actual);
        assertEquals(expected, actual);
    }

    private JsonNode assertExactSearchPage(String search, ParcelStatus statusFilter, LocalDate startDate,
                                          LocalDate endDate, int page, int size) throws Exception {
        entityManager.flush();
        Map<String, Object> parameters = new HashMap<>();
        String cleanSearch = search != null && !search.trim().isEmpty() ? search.trim() : null;
        String fromClause = cleanSearch == null ? " FROM tracking_event e WHERE 1=1" : existingSearchFromClause();
        if (cleanSearch != null) {
            parameters.put("search", cleanSearch);
        }
        if (statusFilter != null) {
            fromClause += " AND e.status = :status";
            parameters.put("status", statusFilter.name());
        }
        if (startDate != null) {
            fromClause += " AND e.event_timestamp >= :startDate";
            parameters.put("startDate", startDate.atStartOfDay());
        }
        if (endDate != null) {
            fromClause += " AND e.event_timestamp <= :endDate";
            parameters.put("endDate", endDate.atTime(23, 59, 59, 999999999));
        }
        List<Long> expectedIds = readEventIds("SELECT e.event_id" + fromClause
                + " ORDER BY e.event_timestamp DESC, e.event_id DESC", parameters);
        var request = get("/api/v1/tracking-events").param("page", Integer.toString(page)).param("size", Integer.toString(size));
        if (search != null) request.param("search", search);
        if (statusFilter != null) request.param("status", statusFilter.name());
        if (startDate != null) request.param("startDate", startDate.toString());
        if (endDate != null) request.param("endDate", endDate.toString());
        JsonNode result = objectMapper.readTree(mockMvc.perform(request).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        List<Long> actualIds = new ArrayList<>();
        result.get("content").forEach(row -> actualIds.add(row.get("eventId").asLong()));
        int offset = (int) Math.min((long) page * size, expectedIds.size());
        assertEquals(expectedIds.size(), result.at("/page/totalElements").asLong(), "Exact total for " + search);
        assertEquals(expectedIds.subList(offset, Math.min(offset + size, expectedIds.size())), actualIds,
                "Exact ordered IDs for " + search);
        assertEquals(actualIds.size(), new HashSet<>(actualIds).size());
        return result;
    }

    private String existingSearchFromClause() {
        return """
                 FROM tracking_event e
                 JOIN parcel_unit pu ON pu.tracking_id=e.tracking_id
                 LEFT JOIN app_user u ON u.user_id=e.staff_id
                 LEFT JOIN vehicle v ON v.vehicle_id=e.vehicle_id
                 WHERE (LOWER(pu.tracking_id) LIKE LOWER(CONCAT('%', :search, '%'))
                    OR LOWER(pu.shipment_id) LIKE LOWER(CONCAT('%', :search, '%'))
                    OR (u.full_name IS NOT NULL AND LOWER(u.full_name) LIKE LOWER(CONCAT('%', :search, '%')))
                    OR (u.username IS NOT NULL AND LOWER(u.username) LIKE LOWER(CONCAT('%', :search, '%')))
                    OR (v.vehicle_id IS NOT NULL AND LOWER(v.vehicle_id) LIKE LOWER(CONCAT('%', :search, '%')))
                    OR (v.plate_number IS NOT NULL AND LOWER(v.plate_number) LIKE LOWER(CONCAT('%', :search, '%'))))
                """;
    }

    private List<Long> readEventIds(String sql, Map<String, Object> parameters) {
        jakarta.persistence.Query query = entityManager.createNativeQuery(sql);
        parameters.forEach(query::setParameter);
        return ((List<?>) query.getResultList()).stream().map(value -> ((Number) value).longValue()).toList();
    }

    private SearchFixture createSearchFixture(int eventCount) {
        Client client = clientRepository.findById("CL-001").orElseThrow();
        Shipment shipment = new Shipment("SRCH-SHIP", client, "Search recipient", "Search address", "09170000000",
                1, ChargeModel.FLAT, new BigDecimal("100"), BigDecimal.ZERO, new BigDecimal("100"),
                false, RegisteredVia.DESKTOP_OFFICE);
        shipment.setDateRegistered(LocalDateTime.of(2036, 1, 10, 12, 0));
        entityManager.persist(shipment);
        ParcelUnit parcel = new ParcelUnit("SRCH-TRACK_1", shipment, 1, BigDecimal.ONE, BigDecimal.ONE,
                BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE);
        parcelUnitRepository.saveAndFlush(parcel);
        AppUser staff = appUserRepository.saveAndFlush(new AppUser("SRCH-USER", "srch_%_user",
                appUserRepository.findById("USR-FIELD").orElseThrow().getPasswordHash(), "Srch Path\\Staff", UserRole.COURIER_STAFF));
        Vehicle vehicle = vehicleRepository.saveAndFlush(new Vehicle("SRCH-VEH", "SRCH%_\\PLATE", "Search vehicle"));
        List<TrackingEvent> events = new ArrayList<>();
        for (int eventIndex = 0; eventIndex < eventCount; eventIndex++) {
            ParcelStatus status = eventIndex % 2 == 0 ? ParcelStatus.LOADED_ON_TRUCK : ParcelStatus.ARRIVED_AT_TNL;
            events.add(new TrackingEvent(parcel, status, eventIndex % 2 == 0 ? vehicle : null, staff, "Search fixture"));
        }
        trackingEventRepository.saveAllAndFlush(events);
        entityManager.createNativeQuery("UPDATE tracking_event SET event_timestamp = :timestamp WHERE event_id IN :ids")
                .setParameter("timestamp", LocalDateTime.of(2036, 1, 10, 12, 0))
                .setParameter("ids", events.stream().map(TrackingEvent::getEventId).toList()).executeUpdate();
        entityManager.clear();
        return new SearchFixture(staff, vehicle, events);
    }

    private void setEventTimestamp(Long eventId, LocalDateTime timestamp) {
        entityManager.createNativeQuery("UPDATE tracking_event SET event_timestamp = :timestamp WHERE event_id = :eventId")
                .setParameter("timestamp", timestamp).setParameter("eventId", eventId).executeUpdate();
    }

    private record SearchFixture(AppUser staff, Vehicle vehicle, List<TrackingEvent> events) {}

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testPopulatedCurrentDayTrackingMetrics() throws Exception {
        trackingEventRepository.deleteAll();

        // 1. Initially 0
        mockMvc.perform(get("/api/v1/tracking-events/metrics")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todayTotalScans").value(0))
                .andExpect(jsonPath("$.activeCouriersCount").value(0))
                .andExpect(jsonPath("$.loadedOnTruckToday").value(0))
                .andExpect(jsonPath("$.handedToHaulerToday").value(0));

        // 2. Courier 1 scans LOADED_ON_TRUCK
        String tracking1 = createShipmentWithScan("Metrics 1", "VH-001", "USR-FIELD");

        mockMvc.perform(get("/api/v1/tracking-events/metrics")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todayTotalScans").value(1))
                .andExpect(jsonPath("$.activeCouriersCount").value(1))
                .andExpect(jsonPath("$.loadedOnTruckToday").value(1))
                .andExpect(jsonPath("$.handedToHaulerToday").value(0));

        // 3. Courier 1 scans ARRIVED_AT_TNL (total operational scans = 2, loaded on truck = 1, active couriers = 1)
        trackingService.processStatusScan(
                new TrackingScanRequest(tracking1, ParcelStatus.ARRIVED_AT_TNL, null, "Arrived"),
                "USR-FIELD"
        );

        mockMvc.perform(get("/api/v1/tracking-events/metrics")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todayTotalScans").value(2))
                .andExpect(jsonPath("$.activeCouriersCount").value(1))
                .andExpect(jsonPath("$.loadedOnTruckToday").value(1))
                .andExpect(jsonPath("$.handedToHaulerToday").value(0));

        // 4. Dispatch staff scans LOADED_TO_HAULER (total operational scans = 3, active staff = 2, handed to hauler = 1)
        trackingService.processStatusScan(
                new TrackingScanRequest(tracking1, ParcelStatus.LOADED_TO_HAULER, null, "Handed to hauler"),
                "USR-DISPATCH"
        );

        mockMvc.perform(get("/api/v1/tracking-events/metrics")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todayTotalScans").value(3))
                .andExpect(jsonPath("$.activeCouriersCount").value(2))
                .andExpect(jsonPath("$.loadedOnTruckToday").value(1))
                .andExpect(jsonPath("$.handedToHaulerToday").value(1));
    }
}
