package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
    private final List<String> createdTrackingIds = new ArrayList<>();
    private final List<String> createdShipmentIds = new ArrayList<>();
    private final List<String> createdEventIds = new ArrayList<>();

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
        if (!vehicleRepository.existsById("VH-777")) vehicleRepository.save(new Vehicle("VH-777", "OFF-777", "Offline Van"));
        fieldToken = "Bearer " + JwtTokenProvider.generateToken("USR-OFFLINE-FIELD", "FIELD_STAFF");
        secondFieldToken = "Bearer " + JwtTokenProvider.generateToken("USR-OFFLINE-FIELD-2", "FIELD_STAFF");
        officeToken = "Bearer " + JwtTokenProvider.generateToken("USR-OFFLINE-OFFICE", "OFFICE_STAFF");
    }

    @AfterEach
    void tearDown() {
        for (String eventId : createdEventIds) receiptRepository.deleteById(eventId);
        for (String trackingId : createdTrackingIds) {
            eventRepository.deleteAll(eventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(trackingId));
            parcelRepository.deleteById(trackingId);
        }
        for (String shipmentId : createdShipmentIds) shipmentRepository.deleteById(shipmentId);
        createdEventIds.clear(); createdTrackingIds.clear(); createdShipmentIds.clear();
    }

    @Test
    void appliesOnceAndReplaysTheDurableReceipt() throws Exception {
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
    void rejectsOtherRolesAndChangedIdempotencyPayloads() throws Exception {
        String trackingId = createShipment();
        String eventId = UUID.randomUUID().toString();
        createdEventIds.add(eventId);
        String request = request(eventId, trackingId, Instant.now().minusSeconds(30).toString());
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", officeToken).contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", fieldToken).contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/tracking-events/offline-sync").header("Authorization", fieldToken).contentType(MediaType.APPLICATION_JSON).content(request(eventId, trackingId, Instant.now().minusSeconds(90).toString())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.results[0].code").value("IDEMPOTENCY_KEY_REUSED"));
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
        return objectMapper.writeValueAsString(java.util.Map.of("items", List.of(java.util.Map.of("clientEventId", eventId, "trackingId", trackingId,
                "targetStatus", "LOADED_ON_TRUCK", "vehicleId", "VH-777", "capturedAt", capturedAt, "clientSequence", 1))));
    }
}
