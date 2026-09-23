package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.dto.ParcelUnitRequest;
import com.tnl.logistics.dto.ShipmentRegistrationRequest;
import com.tnl.logistics.dto.ShipmentResponse;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.ChargeModel;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.RegisteredVia;
import com.tnl.logistics.model.StaffType;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.model.Vehicle;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.ClientRepository;
import com.tnl.logistics.repository.OfflineScanReceiptRepository;
import com.tnl.logistics.repository.ParcelUnitRepository;
import com.tnl.logistics.repository.ShipmentRepository;
import com.tnl.logistics.repository.TrackingEventRepository;
import com.tnl.logistics.repository.VehicleRepository;
import com.tnl.logistics.service.ShipmentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OfflineTrackingSyncIntegrationTest {
    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private ShipmentService shipmentService;
    @Autowired private AppUserRepository userRepository;
    @Autowired private ClientRepository clientRepository;
    @Autowired private VehicleRepository vehicleRepository;
    @Autowired private TrackingEventRepository eventRepository;
    @Autowired private OfflineScanReceiptRepository receiptRepository;
    @Autowired private ParcelUnitRepository parcelRepository;
    @Autowired private ShipmentRepository shipmentRepository;
    @Autowired private BCryptPasswordEncoder passwordEncoder;

    private String fieldToken;
    private String secondFieldToken;
    private String officeToken;
    private String adminToken;
    private final List<String> createdTrackingIds = new ArrayList<>();
    private final List<String> createdShipmentIds = new ArrayList<>();
    private final List<String> createdEventIds = new ArrayList<>();
    private final List<String> createdVehicleIds = new ArrayList<>();
    private final List<String> createdUserIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        clientRepository.findById("CL-OFFLINE").orElseGet(() -> clientRepository.save(new Client("CL-OFFLINE", "Offline Client", "Manila", "09170000000", "offline@example.com", ChargeModel.FLAT, true)));
        AppUser fieldUser = userRepository.findById("USR-OFFLINE-FIELD").orElseGet(() -> {
            AppUser user = new AppUser("USR-OFFLINE-FIELD", "offline_field", passwordEncoder.encode("field123"), "Offline Field", UserRole.FIELD_STAFF);
            user.setStaffType(StaffType.INTERNAL_TRUCK); user.setMustChangePassword(false); return userRepository.save(user);
        });
        fieldUser.setMustChangePassword(false);
        fieldUser.setActive(true);
        userRepository.save(fieldUser);
        AppUser secondFieldUser = userRepository.findById("USR-OFFLINE-FIELD-2").orElseGet(() -> {
            AppUser user = new AppUser("USR-OFFLINE-FIELD-2", "offline_field_2", passwordEncoder.encode("field123"), "Offline Field Two", UserRole.FIELD_STAFF);
            user.setStaffType(StaffType.INTERNAL_TRUCK); user.setMustChangePassword(false); return userRepository.save(user);
        });
        secondFieldUser.setMustChangePassword(false);
        secondFieldUser.setActive(true);
        userRepository.save(secondFieldUser);
        userRepository.findById("USR-OFFLINE-OFFICE").orElseGet(() -> userRepository.save(new AppUser("USR-OFFLINE-OFFICE", "offline_office", passwordEncoder.encode("office123"), "Offline Office", UserRole.OFFICE_STAFF)));
        userRepository.findById("USR-OFFLINE-ADMIN").orElseGet(() -> userRepository.save(new AppUser("USR-OFFLINE-ADMIN", "offline_admin", passwordEncoder.encode("admin123"), "Offline Admin", UserRole.ADMIN)));
        if (!vehicleRepository.existsById("VH-777")) vehicleRepository.save(new Vehicle("VH-777", "OFF-777", "Offline Van"));
        fieldToken = "Bearer " + JwtTokenProvider.generateToken("USR-OFFLINE-FIELD", "FIELD_STAFF");
        secondFieldToken = "Bearer " + JwtTokenProvider.generateToken("USR-OFFLINE-FIELD-2", "FIELD_STAFF");
        officeToken = "Bearer " + JwtTokenProvider.generateToken("USR-OFFLINE-OFFICE", "OFFICE_STAFF");
        adminToken = "Bearer " + JwtTokenProvider.generateToken("USR-OFFLINE-ADMIN", "ADMIN");
    }

    @AfterEach
    void tearDown() {
        for (String eventId : createdEventIds) receiptRepository.deleteById(eventId);
        for (String trackingId : createdTrackingIds) {
            eventRepository.deleteAll(eventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(trackingId));
            parcelRepository.deleteById(trackingId);
        }
        for (String shipmentId : createdShipmentIds) shipmentRepository.deleteById(shipmentId);
        for (String vehicleId : createdVehicleIds) vehicleRepository.deleteById(vehicleId);
        for (String userId : createdUserIds) userRepository.deleteById(userId);
        createdEventIds.clear(); createdTrackingIds.clear(); createdShipmentIds.clear(); createdVehicleIds.clear(); createdUserIds.clear();
    }

    @Test
    void ac15AppliesOnceAndReplaysTheDurableReceiptAfterAClientLostResponse() throws Exception {
        String trackingId = createShipment();
        String eventId = UUID.randomUUID().toString();
        createdEventIds.add(eventId);
        String request = request(eventId, trackingId, Instant.now().minusSeconds(30).toString());
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", fieldToken).contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isOk()).andExpect(jsonPath("$.applied").value(1)).andExpect(jsonPath("$.results[0].outcome").value("APPLIED"));
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", fieldToken).contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isOk()).andExpect(jsonPath("$.alreadyApplied").value(0)).andExpect(jsonPath("$.results[0].replayed").value(true));
    }

    @Test
    void ac04RejectsMalformedBatchesBeforeAnyItemIsProcessed() throws Exception {
        String trackingId = createShipment();
        String token = createFreshFieldToken();
        String eventId = UUID.randomUUID().toString();
        String valid = request(eventId, trackingId, Instant.now().minusSeconds(30).toString());
        ObjectNode validItem = (ObjectNode) objectMapper.readTree(valid).get("items").get(0);
        ArrayNode duplicateItems = objectMapper.createArrayNode().add(validItem).add(validItem);
        ArrayNode tooManyItems = objectMapper.createArrayNode();
        for (int index = 0; index < 101; index++) {
            ObjectNode item = validItem.deepCopy();
            item.put("clientEventId", UUID.randomUUID().toString());
            tooManyItems.add(item);
        }
        ObjectNode missingVehicle = validItem.deepCopy();
        missingVehicle.remove("vehicleId");
        ObjectNode wrongVehicle = validItem.deepCopy();
        wrongVehicle.put("targetStatus", "ARRIVED_AT_TNL");
        ArrayNode mixedItems = objectMapper.createArrayNode().add(validItem).add(wrongVehicle);
        String[] invalidBodies = {
                "{\"items\":[]}",
                objectMapper.writeValueAsString(Map.of("items", tooManyItems)),
                objectMapper.writeValueAsString(Map.of("items", duplicateItems)),
                valid.replace(eventId, "bad-uuid"),
                valid.replace(trackingId, "TRK-2026-000001-EXTRA"),
                valid.replace("LOADED_ON_TRUCK", "COMPLETED"),
                objectMapper.writeValueAsString(Map.of("items", List.of(missingVehicle))),
                objectMapper.writeValueAsString(Map.of("items", List.of(wrongVehicle))),
                objectMapper.writeValueAsString(Map.of("items", mixedItems))
        };
        for (String body : invalidBodies) {
            mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        assertEquals(false, receiptRepository.existsById(eventId));
        assertEquals(2, eventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(trackingId).size());
    }

    @Test
    void ac12RejectsOutOfRangeCaptureTimesWithoutChangingServerState() throws Exception {
        String trackingId = createShipment();
        String token = createFreshFieldToken();
        for (String captureTime : List.of("1999-12-31T23:59:59Z", Instant.now().plusSeconds(86_500).toString())) {
            String eventId = UUID.randomUUID().toString();
            mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON).content(request(eventId, trackingId, captureTime)))
                    .andExpect(status().isBadRequest());
            assertEquals(false, receiptRepository.existsById(eventId));
        }
        assertEquals(2, eventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(trackingId).size());
    }

    @Test
    void rejectsOtherRolesAndChangedIdempotencyPayloads() throws Exception {
        String trackingId = createShipment();
        String eventId = UUID.randomUUID().toString();
        createdEventIds.add(eventId);
        String request = request(eventId, trackingId, Instant.now().minusSeconds(30).toString());
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", officeToken).contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", adminToken).contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", fieldToken).contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", fieldToken).contentType(MediaType.APPLICATION_JSON).content(request(eventId, trackingId, Instant.now().minusSeconds(90).toString())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.results[0].code").value("IDEMPOTENCY_KEY_REUSED"));
    }

    @Test
    void ac01RejectsAnonymousExpiredInactiveAndRevokedCallersWithoutWrites() throws Exception {
        String trackingId = createShipment();
        String eventId = UUID.randomUUID().toString();
        String body = request(eventId, trackingId, Instant.now().minusSeconds(30).toString());
        String expired = "Bearer " + JwtTokenProvider.generateToken("USR-OFFLINE-FIELD", "FIELD_STAFF", 1,
                Instant.now().minusSeconds(120).getEpochSecond(), Instant.now().minusSeconds(60).getEpochSecond());
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", expired)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
        AppUser fieldUser = userRepository.findById("USR-OFFLINE-FIELD").orElseThrow();
        try {
            fieldUser.setActive(false);
            userRepository.saveAndFlush(fieldUser);
            mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", fieldToken)
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
            fieldUser.setActive(true);
            fieldUser.incrementTokenVersion();
            userRepository.saveAndFlush(fieldUser);
            mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", fieldToken)
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
        } finally {
            fieldUser.setActive(true);
            fieldUser.setTokenVersion(1);
            userRepository.saveAndFlush(fieldUser);
        }
        assertEquals(false, receiptRepository.existsById(eventId));
        assertEquals(2, eventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(trackingId).size());
    }

    @Test
    void ac08AndAc09UseOneEventForSameVehicleAndRejectASecondVehicle() throws Exception {
        String trackingId = createShipment();
        String firstId = UUID.randomUUID().toString();
        String secondId = UUID.randomUUID().toString();
        String thirdId = UUID.randomUUID().toString();
        createdEventIds.addAll(List.of(firstId, secondId, thirdId));
        Vehicle secondVehicle = new Vehicle("VH-778", "OFF-778", "Second Offline Van");
        vehicleRepository.save(secondVehicle);
        createdVehicleIds.add(secondVehicle.getVehicleId());
        String capturedAt = Instant.now().minusSeconds(30).toString();
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", fieldToken)
                .contentType(MediaType.APPLICATION_JSON).content(requestFor(firstId, trackingId, "LOADED_ON_TRUCK", "VH-777", capturedAt, 1)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.results[0].outcome").value("APPLIED"));
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", secondFieldToken)
                .contentType(MediaType.APPLICATION_JSON).content(requestFor(secondId, trackingId, "LOADED_ON_TRUCK", "VH-777", capturedAt, 1)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.results[0].outcome").value("ALREADY_APPLIED"));
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", secondFieldToken)
                .contentType(MediaType.APPLICATION_JSON).content(requestFor(thirdId, trackingId, "LOADED_ON_TRUCK", "VH-778", capturedAt, 2)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.results[0].code").value("VEHICLE_MISMATCH"));
        assertEquals(3, eventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(trackingId).size());
    }

    @Test
    void ac10AndAc11RejectSkippedStaleAndInvalidVehicleCommands() throws Exception {
        String trackingId = createShipment();
        String capturedAt = Instant.now().minusSeconds(30).toString();
        for (String vehicleId : List.of("VH-999", "VH-888")) {
            if (vehicleId.equals("VH-888")) {
                Vehicle inactive = new Vehicle("VH-888", "OFF-888", "Inactive Van");
                inactive.setActive(false);
                vehicleRepository.save(inactive);
                createdVehicleIds.add(inactive.getVehicleId());
            }
            String eventId = UUID.randomUUID().toString();
            createdEventIds.add(eventId);
            mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", fieldToken)
                    .contentType(MediaType.APPLICATION_JSON).content(requestFor(eventId, trackingId, "LOADED_ON_TRUCK", vehicleId, capturedAt, 1)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.results[0].code")
                            .value(vehicleId.equals("VH-999") ? "VEHICLE_NOT_FOUND" : "VEHICLE_INACTIVE"));
        }
        String skippedId = UUID.randomUUID().toString();
        createdEventIds.add(skippedId);
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", fieldToken)
                .contentType(MediaType.APPLICATION_JSON).content(requestFor(skippedId, trackingId, "ARRIVED_AT_TNL", null, capturedAt, 1)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.results[0].code").value("INVALID_TRANSITION"));
        assertEquals(2, eventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(trackingId).size());
    }

    @Test
    void ac03RejectsUnknownTopLevelAndNestedActorFieldsBeforeProcessing() throws Exception {
        String trackingId = createShipment();
        String eventId = UUID.randomUUID().toString();
        String request = request(eventId, trackingId, Instant.now().minusSeconds(30).toString());
        String topLevel = request.replace("{\"items\":", "{\"ownerUserId\":\"USR-OFFLINE-OFFICE\",\"items\":");
        String nested = request.replace("\"clientSequence\":1", "\"clientSequence\":1,\"staffUserId\":\"USR-OFFLINE-OFFICE\"");
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", fieldToken)
                .contentType(MediaType.APPLICATION_JSON).content(topLevel)).andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", fieldToken)
                .contentType(MediaType.APPLICATION_JSON).content(nested)).andExpect(status().isBadRequest());
        assertEquals(false, receiptRepository.existsById(eventId));
        assertEquals(2, eventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(trackingId).size());
    }

    @Test
    void ac04RejectsVehicleIdLongerThanItsDatabaseColumn() throws Exception {
        String trackingId = createShipment();
        String eventId = UUID.randomUUID().toString();
        String request = request(eventId, trackingId, Instant.now().minusSeconds(30).toString())
                .replace("VH-777", "VH-" + "7".repeat(18));
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", fieldToken)
                .contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isBadRequest());
        assertEquals(false, receiptRepository.existsById(eventId));
    }

    @Test
    void resolvesConcurrentDuplicateIdsToTheStoredReceiptAndDoesNotDiscloseOtherParcelIds() throws Exception {
        String firstTrackingId = createShipment();
        String secondTrackingId = createShipment();
        String eventId = UUID.randomUUID().toString();
        createdEventIds.add(eventId);
        String request = request(eventId, firstTrackingId, Instant.now().minusSeconds(30).toString());
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<String> first = executor.submit(() -> performWhenStarted(start, fieldToken, request));
            Future<String> second = executor.submit(() -> performWhenStarted(start, fieldToken, request));
            start.countDown();
            assertSingleAppliedEvent(first.get(), second.get(), firstTrackingId);
        } finally {
            executor.shutdownNow();
        }

        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", secondFieldToken)
                        .contentType(MediaType.APPLICATION_JSON).content(request(eventId, secondTrackingId, Instant.now().minusSeconds(30).toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].code").value("IDEMPOTENCY_KEY_REUSED"))
                .andExpect(jsonPath("$.results[0].trackingId").value(secondTrackingId));
    }

    private String performWhenStarted(CountDownLatch start, String token, String body) throws Exception {
        start.await();
        return mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    private void assertSingleAppliedEvent(String firstResponse, String secondResponse, String trackingId) throws Exception {
        var first = objectMapper.readTree(firstResponse);
        var second = objectMapper.readTree(secondResponse);
        org.junit.jupiter.api.Assertions.assertNotEquals("RETRYABLE_ERROR", first.at("/results/0/outcome").asText());
        org.junit.jupiter.api.Assertions.assertNotEquals("RETRYABLE_ERROR", second.at("/results/0/outcome").asText());
        long appliedEvents = eventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(trackingId).stream()
                .filter(event -> event.getStatus().name().equals("LOADED_ON_TRUCK")).count();
        org.junit.jupiter.api.Assertions.assertEquals(1, appliedEvents);
    }

    private String createShipment() {
        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-OFFLINE"); request.setRecipientName("Offline Recipient"); request.setRecipientAddress("Quezon City"); request.setRecipientContact("09181234567");
        request.setQuantity(1); request.setChargeModel(ChargeModel.FLAT); request.setShippingFee(new BigDecimal("100")); request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("1"), new BigDecimal("1"), new BigDecimal("1"), new BigDecimal("1"))));
        ShipmentResponse response = shipmentService.registerShipment(request, "USR-OFFLINE-OFFICE");
        createdShipmentIds.add(response.getShipmentId());
        createdTrackingIds.add(response.getTrackingIds().get(0));
        return response.getTrackingIds().get(0);
    }

    private String request(String eventId, String trackingId, String capturedAt) throws Exception {
        return requestFor(eventId, trackingId, "LOADED_ON_TRUCK", "VH-777", capturedAt, 1);
    }

    private String requestFor(String eventId, String trackingId, String targetStatus, String vehicleId,
                              String capturedAt, long clientSequence) throws Exception {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("clientEventId", eventId);
        item.put("trackingId", trackingId);
        item.put("targetStatus", targetStatus);
        if (vehicleId != null) item.put("vehicleId", vehicleId);
        item.put("capturedAt", capturedAt);
        item.put("clientSequence", clientSequence);
        return objectMapper.writeValueAsString(Map.of("items", List.of(item)));
    }

    private String createFreshFieldToken() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String userId = "USR-OF-" + suffix;
        AppUser user = new AppUser(userId, "offline_" + suffix, passwordEncoder.encode("field123"), "Offline Field", UserRole.FIELD_STAFF);
        user.setMustChangePassword(false);
        user.setStaffType(StaffType.INTERNAL_TRUCK);
        userRepository.saveAndFlush(user);
        createdUserIds.add(userId);
        return "Bearer " + JwtTokenProvider.generateToken(userId, "FIELD_STAFF");
    }
}
