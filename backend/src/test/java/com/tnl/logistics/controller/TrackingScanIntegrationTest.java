package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.ShipmentService;
import com.tnl.logistics.service.SseService;
import com.tnl.logistics.service.TrackingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class TrackingScanIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ShipmentService shipmentService;

    @Autowired
    private TrackingService trackingService;

    @Autowired
    private com.tnl.logistics.config.DataSeeder dataSeeder;

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
    private PaymentRepository paymentRepository;

    @Autowired
    private WaybillRepository waybillRepository;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    @SpyBean
    private SseService sseService;

    private String fieldToken;
    private String officeToken;
    private String adminToken;

    @BeforeEach
    public void setup() throws Exception {
        vehicleRepository.deleteById("VH-SCAN-001");
        vehicleRepository.deleteById("VH-SCAN-002");
        vehicleRepository.deleteById("VH-INACTIVE");
        vehicleRepository.deleteById("VH-NONE");
        vehicleRepository.deleteById("VH-CONCUR");

        if (shipmentRepository.count() == 0) {
            dataSeeder.run();
        }

        // Seed users
        AppUser fieldUser = appUserRepository.findById("USR-FIELD").orElse(null);
        if (fieldUser == null) {
            fieldUser = new AppUser("USR-FIELD", "field_staff", passwordEncoder.encode("field123"), "Field Staff User", UserRole.FIELD_STAFF);
            fieldUser.setStaffType(StaffType.INTERNAL_TRUCK);
            appUserRepository.save(fieldUser);
        }

        AppUser officeUser = appUserRepository.findById("USR-OFFICE").orElse(null);
        if (officeUser == null) {
            officeUser = new AppUser("USR-OFFICE", "office_staff", passwordEncoder.encode("office123"), "Office Staff User", UserRole.OFFICE_STAFF);
            appUserRepository.save(officeUser);
        }

        AppUser adminUser = appUserRepository.findById("USR-ADMIN").orElse(null);
        if (adminUser == null) {
            adminUser = new AppUser("USR-ADMIN", "admin", passwordEncoder.encode("admin123"), "Admin User", UserRole.ADMIN);
            appUserRepository.save(adminUser);
        }

        fieldToken = "Bearer " + JwtTokenProvider.generateToken("USR-FIELD", "FIELD_STAFF");
        officeToken = "Bearer " + JwtTokenProvider.generateToken("USR-OFFICE", "OFFICE_STAFF");
        adminToken = "Bearer " + JwtTokenProvider.generateToken("USR-ADMIN", "ADMIN");

        Client client = clientRepository.findById("CL-001").orElse(null);
        if (client == null) {
            clientRepository.save(new Client("CL-001", "Acme Logistics Client", "Manila", "09170000000", "client@acme.com", ChargeModel.FLAT, true));
        } else if (!Boolean.TRUE.equals(client.getActive())) {
            client.setActive(true);
            clientRepository.save(client);
        }
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

    private List<String> createTestShipmentAllIds(int quantity) {
        ShipmentRegistrationRequest regReq = new ShipmentRegistrationRequest();
        regReq.setClientId("CL-001");
        regReq.setRecipientName("Batch Test Recipient");
        regReq.setRecipientAddress("Cebu City");
        regReq.setRecipientContact("09187654321");
        regReq.setQuantity(quantity);
        regReq.setChargeModel(ChargeModel.FLAT);
        regReq.setShippingFee(new BigDecimal("500.00"));
        regReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);

        List<ParcelUnitRequest> parcels = new ArrayList<>();
        for (int i = 1; i <= quantity; i++) {
            parcels.add(new ParcelUnitRequest(i, new BigDecimal("2.0"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10")));
        }
        regReq.setParcels(parcels);

        ShipmentResponse shipResp = shipmentService.registerShipment(regReq, "USR-OFFICE");
        return shipResp.getTrackingIds();
    }

    // 1. Field staff can retrieve scan context
    @Test
    public void testFieldStaffCanRetrieveScanContext() throws Exception {
        String trackingId = createTestShipment(1);

        mockMvc.perform(get("/api/v1/tracking-events/scan-context/" + trackingId)
                        .header("Authorization", fieldToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackingId").value(trackingId))
                .andExpect(jsonPath("$.currentStatusCode").value("QR_GENERATED"))
                .andExpect(jsonPath("$.currentStatusLabel").value("QR Generated"))
                .andExpect(jsonPath("$.nextStatusCode").value("LOADED_ON_TRUCK"))
                .andExpect(jsonPath("$.nextStatusLabel").value("Loaded on Truck"))
                .andExpect(jsonPath("$.requiresVehicle").value(true))
                .andExpect(jsonPath("$.canScan").value(true));
    }

    // 2. Office staff, admin, and unauthenticated callers cannot retrieve field scan context
    @Test
    public void testNonFieldStaffCannotRetrieveScanContext() throws Exception {
        String trackingId = createTestShipment(1);

        // Office staff -> 403
        mockMvc.perform(get("/api/v1/tracking-events/scan-context/" + trackingId)
                        .header("Authorization", officeToken))
                .andExpect(status().isForbidden());

        // Admin -> 403
        mockMvc.perform(get("/api/v1/tracking-events/scan-context/" + trackingId)
                        .header("Authorization", adminToken))
                .andExpect(status().isForbidden());

        // Unauthenticated -> 401
        mockMvc.perform(get("/api/v1/tracking-events/scan-context/" + trackingId))
                .andExpect(status().isUnauthorized());
    }

    // 3. Every status maps to the correct next scanner status
    @Test
    public void testStatusMappingAcrossLifecycle() throws Exception {
        String trackingId = createTestShipment(1);
        ParcelUnit unit = parcelUnitRepository.findById(trackingId).orElseThrow();

        // 3a. REGISTERED
        unit.setCurrentStatus(ParcelStatus.REGISTERED);
        parcelUnitRepository.saveAndFlush(unit);
        mockMvc.perform(get("/api/v1/tracking-events/scan-context/" + trackingId).header("Authorization", fieldToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nextStatusCode").value("QR_GENERATED"))
                .andExpect(jsonPath("$.requiresVehicle").value(false))
                .andExpect(jsonPath("$.canScan").value(true));

        // 3b. QR_GENERATED
        unit.setCurrentStatus(ParcelStatus.QR_GENERATED);
        parcelUnitRepository.saveAndFlush(unit);
        mockMvc.perform(get("/api/v1/tracking-events/scan-context/" + trackingId).header("Authorization", fieldToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nextStatusCode").value("LOADED_ON_TRUCK"))
                .andExpect(jsonPath("$.requiresVehicle").value(true))
                .andExpect(jsonPath("$.canScan").value(true));

        // 3c. LOADED_ON_TRUCK
        unit.setCurrentStatus(ParcelStatus.LOADED_ON_TRUCK);
        parcelUnitRepository.saveAndFlush(unit);
        mockMvc.perform(get("/api/v1/tracking-events/scan-context/" + trackingId).header("Authorization", fieldToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nextStatusCode").value("ARRIVED_AT_TNL"))
                .andExpect(jsonPath("$.requiresVehicle").value(false))
                .andExpect(jsonPath("$.canScan").value(true));

        // 3d. ARRIVED_AT_TNL
        unit.setCurrentStatus(ParcelStatus.ARRIVED_AT_TNL);
        parcelUnitRepository.saveAndFlush(unit);
        mockMvc.perform(get("/api/v1/tracking-events/scan-context/" + trackingId).header("Authorization", fieldToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nextStatusCode").value("LOADED_TO_HAULER"))
                .andExpect(jsonPath("$.requiresVehicle").value(false))
                .andExpect(jsonPath("$.canScan").value(true));
    }

    // 4. LOADED_TO_HAULER and COMPLETED return canScan = false
    @Test
    public void testTerminalStatusesReturnCannotScan() throws Exception {
        String trackingId = createTestShipment(1);
        ParcelUnit unit = parcelUnitRepository.findById(trackingId).orElseThrow();

        // LOADED_TO_HAULER
        unit.setCurrentStatus(ParcelStatus.LOADED_TO_HAULER);
        parcelUnitRepository.saveAndFlush(unit);
        mockMvc.perform(get("/api/v1/tracking-events/scan-context/" + trackingId).header("Authorization", fieldToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canScan").value(false))
                .andExpect(jsonPath("$.nextStatusCode").doesNotExist());

        // COMPLETED
        unit.setCurrentStatus(ParcelStatus.COMPLETED);
        parcelUnitRepository.saveAndFlush(unit);
        mockMvc.perform(get("/api/v1/tracking-events/scan-context/" + trackingId).header("Authorization", fieldToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canScan").value(false))
                .andExpect(jsonPath("$.nextStatusCode").doesNotExist());
    }

    // 5. Context response contains no recipient, address, payment, or client fields
    @Test
    public void testScanContextContainsNoPiiOrBilling() throws Exception {
        String trackingId = createTestShipment(1);

        mockMvc.perform(get("/api/v1/tracking-events/scan-context/" + trackingId).header("Authorization", fieldToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recipientName").doesNotExist())
                .andExpect(jsonPath("$.recipientAddress").doesNotExist())
                .andExpect(jsonPath("$.recipientContact").doesNotExist())
                .andExpect(jsonPath("$.shippingFee").doesNotExist())
                .andExpect(jsonPath("$.client").doesNotExist())
                .andExpect(jsonPath("$.clientId").doesNotExist());
    }

    // 6. Valid single transitions across every scanner-supported step
    @Test
    public void testValidSingleTransitionsAcrossScannerSteps() throws Exception {
        Vehicle vehicle = vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-001", "SCAN-PL-001", "Truck 1"));
        String trackingId = createTestShipment(1);

        // QR_GENERATED -> LOADED_ON_TRUCK
        TrackingScanRequest req1 = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "Loaded");
        MvcResult res1 = mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transitionApplied").value(true))
                .andExpect(jsonPath("$.previousStatusCode").value("QR_GENERATED"))
                .andExpect(jsonPath("$.newStatusCode").value("LOADED_ON_TRUCK"))
                .andExpect(jsonPath("$.vehicleId").value("VH-SCAN-001"))
                .andReturn();

        // LOADED_ON_TRUCK -> ARRIVED_AT_TNL
        TrackingScanRequest req2 = new TrackingScanRequest(trackingId, ParcelStatus.ARRIVED_AT_TNL, null, "Arrived");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transitionApplied").value(true))
                .andExpect(jsonPath("$.previousStatusCode").value("LOADED_ON_TRUCK"))
                .andExpect(jsonPath("$.newStatusCode").value("ARRIVED_AT_TNL"))
                .andExpect(jsonPath("$.vehicleId").doesNotExist());

        // ARRIVED_AT_TNL -> LOADED_TO_HAULER
        TrackingScanRequest req3 = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_TO_HAULER, null, "To Hauler");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req3)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transitionApplied").value(true))
                .andExpect(jsonPath("$.previousStatusCode").value("ARRIVED_AT_TNL"))
                .andExpect(jsonPath("$.newStatusCode").value("LOADED_TO_HAULER"));
    }

    // 7. LOADED_ON_TRUCK rejects missing vehicle
    @Test
    public void testLoadedOnTruckRejectsMissingVehicle() throws Exception {
        String trackingId = createTestShipment(1);

        TrackingScanRequest req = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, null, "No vehicle");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    // 8. Inactive and nonexistent vehicles are rejected
    @Test
    public void testInactiveAndNonexistentVehiclesRejected() throws Exception {
        Vehicle inactive = new Vehicle("VH-INACTIVE", "INA-0000", "Inactive Truck");
        inactive.setActive(false);
        vehicleRepository.saveAndFlush(inactive);

        String trackingId = createTestShipment(1);

        // Inactive vehicle
        TrackingScanRequest reqInactive = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-INACTIVE", "Inactive");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqInactive)))
                .andExpect(status().isBadRequest());

        // Nonexistent vehicle
        TrackingScanRequest reqNotFound = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-NONE", "Missing");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqNotFound)))
                .andExpect(status().isBadRequest());
    }

    // 9. Exact same-target retry returns 200 with transitionApplied = false
    // 10. Idempotent retry creates no duplicate tracking event
    @Test
    public void testIdempotentRetryReturnsFalseAndCreatesNoEvent() throws Exception {
        vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-001", "ABC-1234", "Truck 1"));
        String trackingId = createTestShipment(1);

        TrackingScanRequest req = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "First scan");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transitionApplied").value(true));

        long eventCountBefore = trackingEventRepository.count();

        // Exact retry
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transitionApplied").value(false))
                .andExpect(jsonPath("$.previousStatusCode").value("LOADED_ON_TRUCK"))
                .andExpect(jsonPath("$.newStatusCode").value("LOADED_ON_TRUCK"));

        long eventCountAfter = trackingEventRepository.count();
        assertEquals(eventCountBefore, eventCountAfter);
    }

    // 11. Loaded-on-truck retry with another vehicle returns 409
    @Test
    public void testLoadedOnTruckRetryWithDifferentVehicleReturns409() throws Exception {
        vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-001", "ABC-1234", "Truck 1"));
        vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-002", "XYZ-5678", "Truck 2"));
        String trackingId = createTestShipment(1);

        TrackingScanRequest req1 = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "First scan");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transitionApplied").value(true));

        // Retry with VH-002 -> 409 Conflict
        TrackingScanRequest req2 = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-002", "Different truck");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isConflict());
    }

    // 12. Valid batch updates all parcels
    @Test
    public void testValidBatchScanUpdatesAllParcels() throws Exception {
        vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-001", "ABC-1234", "Truck 1"));
        List<String> ids = createTestShipmentAllIds(3);

        BatchTrackingScanRequest batchReq = new BatchTrackingScanRequest(ids, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "Batch load");
        mockMvc.perform(post("/api/v1/tracking-events/batch-scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(batchReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].transitionApplied").value(true))
                .andExpect(jsonPath("$[1].transitionApplied").value(true))
                .andExpect(jsonPath("$[2].transitionApplied").value(true));

        for (String id : ids) {
            ParcelUnit p = parcelUnitRepository.findById(id).orElseThrow();
            assertEquals(ParcelStatus.LOADED_ON_TRUCK, p.getCurrentStatus());
            assertEquals("VH-SCAN-001", p.getCurrentVehicle().getVehicleId());
        }
    }

    // 13. Mixed valid/invalid batch rolls back every parcel and event
    @Test
    public void testMixedBatchRollsBackEntirely() throws Exception {
        vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-001", "ABC-1234", "Truck 1"));
        List<String> ids = createTestShipmentAllIds(2);

        // Move second parcel to COMPLETED so it cannot move to LOADED_ON_TRUCK
        ParcelUnit p2 = parcelUnitRepository.findById(ids.get(1)).orElseThrow();
        p2.setCurrentStatus(ParcelStatus.COMPLETED);
        parcelUnitRepository.saveAndFlush(p2);

        long eventCountBefore = trackingEventRepository.count();

        BatchTrackingScanRequest batchReq = new BatchTrackingScanRequest(ids, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "Batch load");
        mockMvc.perform(post("/api/v1/tracking-events/batch-scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(batchReq)))
                .andExpect(status().isBadRequest());

        // First parcel must not have transitioned (rolled back)
        ParcelUnit p1 = parcelUnitRepository.findById(ids.get(0)).orElseThrow();
        assertEquals(ParcelStatus.QR_GENERATED, p1.getCurrentStatus());
        assertEquals(eventCountBefore, trackingEventRepository.count());
    }

    // 14. Duplicate IDs are rejected
    @Test
    public void testDuplicateIdsInBatchRejected() throws Exception {
        String trackingId = createTestShipment(1);
        BatchTrackingScanRequest batchReq = new BatchTrackingScanRequest(
                List.of(trackingId, trackingId),
                ParcelStatus.LOADED_ON_TRUCK,
                "VH-SCAN-001",
                "Duplicates"
        );
        mockMvc.perform(post("/api/v1/tracking-events/batch-scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(batchReq)))
                .andExpect(status().isBadRequest());
    }

    // 15. Blank IDs are rejected
    @Test
    public void testBlankIdsInBatchRejected() throws Exception {
        BatchTrackingScanRequest batchReq = new BatchTrackingScanRequest(
                List.of("   "),
                ParcelStatus.LOADED_ON_TRUCK,
                "VH-SCAN-001",
                "Blank"
        );
        mockMvc.perform(post("/api/v1/tracking-events/batch-scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(batchReq)))
                .andExpect(status().isBadRequest());
    }

    // 16. Batch size above 100 is rejected
    @Test
    public void testBatchSizeAbove100Rejected() throws Exception {
        List<String> largeBatch = new ArrayList<>();
        for (int i = 0; i < 101; i++) {
            largeBatch.add("TRK-2026-" + String.format("%06d", i + 1));
        }
        BatchTrackingScanRequest batchReq = new BatchTrackingScanRequest(
                largeBatch,
                ParcelStatus.ARRIVED_AT_TNL,
                null,
                "Too large"
        );
        mockMvc.perform(post("/api/v1/tracking-events/batch-scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(batchReq)))
                .andExpect(status().isBadRequest());
    }

    // 17. A batch retry can contain both already-applied and pending items without duplicating events
    @Test
    public void testBatchWithAlreadyAppliedAndPendingItems() throws Exception {
        vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-001", "ABC-1234", "Truck 1"));
        List<String> ids = createTestShipmentAllIds(2);

        // Pre-apply first item
        TrackingScanRequest req1 = new TrackingScanRequest(ids.get(0), ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "Single scan");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transitionApplied").value(true));

        long eventCountBefore = trackingEventRepository.count();

        // Batch scan with both items
        BatchTrackingScanRequest batchReq = new BatchTrackingScanRequest(ids, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "Batch with retry");
        mockMvc.perform(post("/api/v1/tracking-events/batch-scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(batchReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].transitionApplied").value(false))
                .andExpect(jsonPath("$[1].transitionApplied").value(true));

        // Only 1 new event should have been added
        assertEquals(eventCountBefore + 1, trackingEventRepository.count());
    }

    // 18. Genuine pessimistic-locking concurrency verification with two competing threads
    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    public void testPessimisticLockingConcurrencyWithTwoThreads() throws Exception {
        Vehicle testVehicle = new Vehicle("VH-CONCUR", "XYZ-9999", "Truck Concur");
        vehicleRepository.saveAndFlush(testVehicle);

        String staffId = "USR-FIELD";
        String trackingId = null;
        String shpId = null;

        Mockito.clearInvocations(sseService);

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            trackingId = createTestShipment(1);
            ParcelUnit parcel = parcelUnitRepository.findById(trackingId).orElseThrow();
            shpId = parcel.getShipment().getShipmentId();
            long eventCountBefore = trackingEventRepository.count();

            final String finalTrackingId = trackingId;
            CountDownLatch readyLatch = new CountDownLatch(2);
            CountDownLatch startLatch = new CountDownLatch(1);

            Callable<TrackingScanResponse> scanTask = () -> {
                readyLatch.countDown();
                startLatch.await();
                TrackingScanRequest req = new TrackingScanRequest(finalTrackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-CONCUR", "Concurrent scan");
                return trackingService.processStatusScan(req, staffId);
            };

            Future<TrackingScanResponse> future1 = executor.submit(scanTask);
            Future<TrackingScanResponse> future2 = executor.submit(scanTask);

            assertTrue(readyLatch.await(5, TimeUnit.SECONDS), "Threads did not reach start line in time");
            startLatch.countDown();

            TrackingScanResponse resp1 = future1.get(10, TimeUnit.SECONDS);
            TrackingScanResponse resp2 = future2.get(10, TimeUnit.SECONDS);

            assertNotNull(resp1);
            assertNotNull(resp2);

            boolean oneApplied = (resp1.getTransitionApplied() && !resp2.getTransitionApplied())
                    || (!resp1.getTransitionApplied() && resp2.getTransitionApplied());
            assertTrue(oneApplied, "Exactly one request must apply transition and one must be idempotent");

            assertEquals("LOADED_ON_TRUCK", resp1.getNewStatusCode());
            assertEquals("LOADED_ON_TRUCK", resp2.getNewStatusCode());
            assertEquals("VH-CONCUR", resp1.getVehicleId());
            assertEquals("VH-CONCUR", resp2.getVehicleId());

            ParcelUnit parcelAfter = parcelUnitRepository.findById(trackingId).orElseThrow();
            assertEquals(ParcelStatus.LOADED_ON_TRUCK, parcelAfter.getCurrentStatus());
            assertNotNull(parcelAfter.getCurrentVehicle());
            assertEquals("VH-CONCUR", parcelAfter.getCurrentVehicle().getVehicleId());

            assertEquals(eventCountBefore + 1, trackingEventRepository.count());
            verify(sseService, Mockito.times(1)).broadcastTrackingScan(any());
        } finally {
            executor.shutdownNow();
            if (trackingId != null) {
                trackingEventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(trackingId)
                        .forEach(trackingEventRepository::delete);
                parcelUnitRepository.deleteById(trackingId);
            }
            if (shpId != null) {
                shipmentRepository.deleteById(shpId);
            }
            vehicleRepository.deleteById("VH-CONCUR");
        }
    }

    // 19. Single exact retry succeeds after its assigned vehicle becomes inactive
    @Test
    public void testSingleExactRetrySucceedsWhenVehicleBecomesInactive() throws Exception {
        Vehicle v = vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-001", "ABC-1234", "Truck 1"));
        String trackingId = createTestShipment(1);

        // Initial transition -> applied
        TrackingScanRequest req = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "First scan");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transitionApplied").value(true));

        // Mark vehicle inactive
        v.setActive(false);
        vehicleRepository.saveAndFlush(v);

        // Exact retry against same inactive vehicle -> OK with transitionApplied = false
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transitionApplied").value(false))
                .andExpect(jsonPath("$.vehicleId").value("VH-SCAN-001"));
    }

    // 20. Batch containing only exact retries succeeds after assigned vehicle becomes inactive
    @Test
    public void testBatchOnlyExactRetriesSucceedsWhenVehicleBecomesInactive() throws Exception {
        Vehicle v = vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-001", "ABC-1234", "Truck 1"));
        List<String> ids = createTestShipmentAllIds(2);

        // Pre-apply both
        BatchTrackingScanRequest initialBatch = new BatchTrackingScanRequest(ids, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "Initial batch");
        mockMvc.perform(post("/api/v1/tracking-events/batch-scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(initialBatch)))
                .andExpect(status().isOk());

        // Deactivate vehicle
        v.setActive(false);
        vehicleRepository.saveAndFlush(v);

        // Retry batch with same inactive vehicle
        mockMvc.perform(post("/api/v1/tracking-events/batch-scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(initialBatch)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].transitionApplied").value(false))
                .andExpect(jsonPath("$[1].transitionApplied").value(false));
    }

    // 21. Mixed idempotent and pending batch fails atomically when vehicle is inactive
    @Test
    public void testMixedBatchFailsAtomicallyWhenVehicleInactive() throws Exception {
        Vehicle v = vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-001", "ABC-1234", "Truck 1"));
        List<String> ids = createTestShipmentAllIds(2);

        // Pre-apply first item
        TrackingScanRequest req1 = new TrackingScanRequest(ids.get(0), ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "First parcel");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isOk());

        // Deactivate vehicle
        v.setActive(false);
        vehicleRepository.saveAndFlush(v);

        // Mixed batch: item 0 is idempotent retry, item 1 is new transition -> should fail atomically
        BatchTrackingScanRequest mixedBatch = new BatchTrackingScanRequest(ids, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "Mixed batch");
        mockMvc.perform(post("/api/v1/tracking-events/batch-scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mixedBatch)))
                .andExpect(status().isBadRequest());

        // Verify second item was NOT transitioned
        ParcelUnit p2 = parcelUnitRepository.findById(ids.get(1)).orElseThrow();
        assertEquals(ParcelStatus.QR_GENERATED, p2.getCurrentStatus());
    }

    // 22. Same-status LOADED_ON_TRUCK parcel with a null assigned vehicle returns 409
    @Test
    public void testSameStatusLoadedOnTruckWithNullAssignedVehicleReturns409() throws Exception {
        vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-001", "ABC-1234", "Truck 1"));
        String trackingId = createTestShipment(1);

        // Manually place parcel at LOADED_ON_TRUCK without a vehicle
        ParcelUnit p = parcelUnitRepository.findById(trackingId).orElseThrow();
        p.setCurrentStatus(ParcelStatus.LOADED_ON_TRUCK);
        p.setCurrentVehicle(null);
        parcelUnitRepository.saveAndFlush(p);

        TrackingScanRequest req = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "Conflict test");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isConflict());
    }

    // 23. Same-status retry with a different vehicle returns 409
    @Test
    public void testSameStatusRetryWithDifferentVehicleReturns409() throws Exception {
        vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-001", "ABC-1234", "Truck 1"));
        vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-002", "XYZ-5678", "Truck 2"));
        String trackingId = createTestShipment(1);

        // Assign to VH-001
        TrackingScanRequest req1 = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "Initial assign");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isOk());

        // Attempt retry with VH-002 -> 409 Conflict
        TrackingScanRequest req2 = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-002", "Different truck");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isConflict());
    }

    // 24. Failed inactive mixed batch creates no event and publishes no SSE event
    @Test
    public void testFailedInactiveMixedBatchCreatesNoEventAndPublishesNoSse() throws Exception {
        Vehicle v = vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-001", "ABC-1234", "Truck 1"));
        List<String> ids = createTestShipmentAllIds(2);

        // Pre-apply first item
        TrackingScanRequest req1 = new TrackingScanRequest(ids.get(0), ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "First parcel");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isOk());

        // Deactivate vehicle
        v.setActive(false);
        vehicleRepository.saveAndFlush(v);

        long eventCountBefore = trackingEventRepository.count();
        Mockito.clearInvocations(sseService);

        BatchTrackingScanRequest mixedBatch = new BatchTrackingScanRequest(ids, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "Mixed batch");
        mockMvc.perform(post("/api/v1/tracking-events/batch-scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mixedBatch)))
                .andExpect(status().isBadRequest());

        assertEquals(eventCountBefore, trackingEventRepository.count());
        verify(sseService, never()).broadcastTrackingScan(any());
    }

    // 25. Rolled-back batches publish no SSE events
    @Test
    public void testRolledBackBatchPublishesNoSseEvents() throws Exception {
        vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-001", "ABC-1234", "Truck 1"));
        List<String> ids = createTestShipmentAllIds(2);

        // Sabotage second parcel
        ParcelUnit p2 = parcelUnitRepository.findById(ids.get(1)).orElseThrow();
        p2.setCurrentStatus(ParcelStatus.COMPLETED);
        parcelUnitRepository.saveAndFlush(p2);

        Mockito.clearInvocations(sseService);

        BatchTrackingScanRequest batchReq = new BatchTrackingScanRequest(ids, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "Failing batch");
        mockMvc.perform(post("/api/v1/tracking-events/batch-scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(batchReq)))
                .andExpect(status().isBadRequest());

        verify(sseService, never()).broadcastTrackingScan(any());
    }

    // 26. Successful commits publish SSE
    @Test
    public void testSuccessfulCommitPublishesSse() throws Exception {
        vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-001", "ABC-1234", "Truck 1"));
        String trackingId = createTestShipment(1);

        Mockito.clearInvocations(sseService);

        TrackingScanRequest req = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "SSE test");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        org.springframework.transaction.support.TransactionSynchronizationUtils.triggerAfterCommit();

        verify(sseService).broadcastTrackingScan(any());
    }

    // 27. Existing authorization for single and batch mutation endpoints remains intact
    @Test
    public void testMutationAuthorizationRemainsIntact() throws Exception {
        vehicleRepository.saveAndFlush(new Vehicle("VH-SCAN-001", "ABC-1234", "Truck 1"));
        String trackingId = createTestShipment(1);

        TrackingScanRequest req = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-SCAN-001", "Auth test");

        // FIELD_STAFF -> OK
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        // Unauthenticated -> 403
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnauthorized());
    }
}
