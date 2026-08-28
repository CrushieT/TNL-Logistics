package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.ShipmentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Transactional
public class TrackingAndVehicleIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ShipmentService shipmentService;

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

    private String officeToken;
    private String fieldToken;

    @BeforeEach
    public void setup() {
        trackingEventRepository.deleteAll();
        parcelUnitRepository.deleteAll();
        paymentRepository.deleteAll();
        shipmentRepository.deleteAll();
        vehicleRepository.deleteAll();

        officeToken = "Bearer " + JwtTokenProvider.generateToken("office", "OFFICE_STAFF");
        fieldToken = "Bearer " + JwtTokenProvider.generateToken("field", "FIELD_STAFF");

        Client client = clientRepository.findById("CL-001").orElse(null);
        if (client == null) {
            clientRepository.save(new Client("CL-001", "Acme Logistics Client", "Manila", "09170000000", "client@acme.com", ChargeModel.FLAT, true));
        } else if (!Boolean.TRUE.equals(client.getActive())) {
            client.setActive(true);
            clientRepository.save(client);
        }
    }

    @Test
    public void testVehicleCrudAndSequentialIdGeneration() throws Exception {
        // 1. Create first vehicle (VH-001)
        VehicleRequest req1 = new VehicleRequest("NBD-1234", "Isuzu 6-Wheeler Forward Truck", true);
        MvcResult res1 = mockMvc.perform(post("/api/v1/vehicles")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isCreated())
                .andReturn();

        VehicleResponse v1 = objectMapper.readValue(res1.getResponse().getContentAsString(), VehicleResponse.class);
        assertEquals("VH-001", v1.getVehicleId());
        assertEquals("NBD-1234", v1.getPlateNumber());
        assertTrue(v1.getActive());

        // 2. Create second vehicle (VH-002)
        VehicleRequest req2 = new VehicleRequest("XYZ-9876", "Mitsubishi L300 Van", true);
        MvcResult res2 = mockMvc.perform(post("/api/v1/vehicles")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isCreated())
                .andReturn();

        VehicleResponse v2 = objectMapper.readValue(res2.getResponse().getContentAsString(), VehicleResponse.class);
        assertEquals("VH-002", v2.getVehicleId());

        // 3. List active vehicles
        MvcResult listRes = mockMvc.perform(get("/api/v1/vehicles")
                        .header("Authorization", fieldToken))
                .andExpect(status().isOk())
                .andReturn();

        List<VehicleResponse> list = objectMapper.readValue(listRes.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, VehicleResponse.class));
        assertEquals(2, list.size());

        // 4. Update vehicle description
        req1.setDescription("Updated Isuzu 6-Wheeler");
        mockMvc.perform(put("/api/v1/vehicles/VH-001")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isOk());

        Vehicle updated = vehicleRepository.findById("VH-001").orElseThrow();
        assertEquals("Updated Isuzu 6-Wheeler", updated.getDescription());

        // 5. Smart Delete: Hard deletes vehicle when 0 events exist
        mockMvc.perform(delete("/api/v1/vehicles/VH-001")
                        .header("Authorization", officeToken))
                .andExpect(status().isNoContent());

        assertTrue(vehicleRepository.findById("VH-001").isEmpty());
    }

    @Test
    public void testSequential5StateStatusFlowAndVehicleAssignment() throws Exception {
        // 1. Create a vehicle
        vehicleRepository.saveAndFlush(new Vehicle("VH-001", "ABC-1234", "TNL Truck 1"));

        // 2. Register a shipment
        ShipmentRegistrationRequest regReq = new ShipmentRegistrationRequest();
        regReq.setClientId("CL-001");
        regReq.setRecipientName("Juan Dela Cruz");
        regReq.setRecipientAddress("Baguio City");
        regReq.setRecipientContact("09181234567");
        regReq.setQuantity(1);
        regReq.setChargeModel(ChargeModel.FLAT);
        regReq.setShippingFee(new BigDecimal("350.00"));
        regReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        regReq.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("2.5"), new BigDecimal("20"), new BigDecimal("15"), new BigDecimal("10"))));

        ShipmentResponse shipResp = shipmentService.registerShipment(regReq, "office");
        String trackingId = shipResp.getTrackingIds().get(0);

        // 3. Scan: QR_GENERATED -> LOADED_ON_TRUCK (Valid with active vehicle)
        TrackingScanRequest scan1 = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "Loaded at Manila Depot");
        MvcResult res1 = mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(scan1)))
                .andExpect(status().isOk())
                .andReturn();

        TrackingScanResponse scanResp1 = objectMapper.readValue(res1.getResponse().getContentAsString(), TrackingScanResponse.class);
        assertEquals("Loaded on Truck", scanResp1.getNewStatus());
        assertEquals("VH-001", scanResp1.getVehicleId());
        assertEquals("ABC-1234", scanResp1.getVehiclePlateNumber());
        assertEquals("1 / 1 Loaded on Truck", scanResp1.getStatusRollup());

        ParcelUnit unitAfterScan1 = parcelUnitRepository.findById(trackingId).orElseThrow();
        assertEquals(ParcelStatus.LOADED_ON_TRUCK, unitAfterScan1.getCurrentStatus());
        assertNotNull(unitAfterScan1.getCurrentVehicle());
        assertEquals("VH-001", unitAfterScan1.getCurrentVehicle().getVehicleId());

        // 4. Scan: LOADED_ON_TRUCK -> ARRIVED_AT_TNL (Clears vehicle assignment)
        TrackingScanRequest scan2 = new TrackingScanRequest(trackingId, ParcelStatus.ARRIVED_AT_TNL, null, "Unloaded at Baguio Hub");
        MvcResult res2 = mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(scan2)))
                .andExpect(status().isOk())
                .andReturn();

        TrackingScanResponse scanResp2 = objectMapper.readValue(res2.getResponse().getContentAsString(), TrackingScanResponse.class);
        assertEquals("Arrived at TNL", scanResp2.getNewStatus());
        assertNull(scanResp2.getVehicleId());
        assertEquals("1 / 1 Arrived at TNL", scanResp2.getStatusRollup());

        ParcelUnit unitAfterScan2 = parcelUnitRepository.findById(trackingId).orElseThrow();
        assertEquals(ParcelStatus.ARRIVED_AT_TNL, unitAfterScan2.getCurrentStatus());
        assertNull(unitAfterScan2.getCurrentVehicle());

        // 5. Scan: ARRIVED_AT_TNL -> LOADED_TO_HAULER (Final terminal dispatch)
        TrackingScanRequest scan3 = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_TO_HAULER, null, "Dispatched to 3rd party hauler");
        MvcResult res3 = mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(scan3)))
                .andExpect(status().isOk())
                .andReturn();

        TrackingScanResponse scanResp3 = objectMapper.readValue(res3.getResponse().getContentAsString(), TrackingScanResponse.class);
        assertEquals("Loaded to Hauler", scanResp3.getNewStatus());
        assertEquals("1 / 1 Loaded to Hauler", scanResp3.getStatusRollup());

        // 6. Verify audit event log entries
        List<TrackingEvent> events = trackingEventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(trackingId);
        assertEquals(5, events.size());
    }

    @Test
    public void testRejectInvalidStateTransitionsAndMissingVehicle() throws Exception {
        // 1. Register a shipment
        ShipmentRegistrationRequest regReq = new ShipmentRegistrationRequest();
        regReq.setClientId("CL-001");
        regReq.setRecipientName("Illegal Transition Test");
        regReq.setRecipientAddress("Cebu");
        regReq.setRecipientContact("09190000000");
        regReq.setQuantity(1);
        regReq.setChargeModel(ChargeModel.FLAT);
        regReq.setShippingFee(new BigDecimal("200.00"));
        regReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        regReq.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("1"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"))));

        ShipmentResponse shipResp = shipmentService.registerShipment(regReq, "office");
        String trackingId = shipResp.getTrackingIds().get(0);

        // 2. Attempt skipping from QR_GENERATED straight to LOADED_TO_HAULER (Should fail)
        TrackingScanRequest invalidSkip = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_TO_HAULER, null, "Invalid skip");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidSkip)))
                .andExpect(status().isBadRequest());

        // 3. Attempt LOADED_ON_TRUCK without vehicleId (Should fail)
        TrackingScanRequest missingVehicle = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, null, "Missing vehicle");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(missingVehicle)))
                .andExpect(status().isBadRequest());
    }

    @Test
    public void testVehicleCustomTypeRemarksAndOnTruckCount() throws Exception {
        // 1. Create vehicle with custom type and remarks
        VehicleRequest req = new VehicleRequest("TRK-999", "Refrigerated Wing Van", "Cold storage transport", "Active", "Brake service due soon", true);
        MvcResult res = mockMvc.perform(post("/api/v1/vehicles")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn();

        VehicleResponse v = objectMapper.readValue(res.getResponse().getContentAsString(), VehicleResponse.class);
        assertEquals("TRK-999", v.getPlateNumber());
        assertEquals("Refrigerated Wing Van", v.getVehicleType());
        assertEquals("Brake service due soon", v.getRemarks());
        assertEquals(0L, v.getOnTruckCount());

        // 2. Register a shipment with 2 parcels
        ShipmentRegistrationRequest regReq = new ShipmentRegistrationRequest();
        regReq.setClientId("CL-001");
        regReq.setRecipientName("Frozen Goods Mart");
        regReq.setRecipientAddress("Baguio City");
        regReq.setRecipientContact("09189998888");
        regReq.setQuantity(2);
        regReq.setChargeModel(ChargeModel.FLAT);
        regReq.setShippingFee(new BigDecimal("500.00"));
        regReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        regReq.setParcels(List.of(
                new ParcelUnitRequest(1, new BigDecimal("5"), new BigDecimal("30"), new BigDecimal("30"), new BigDecimal("30")),
                new ParcelUnitRequest(2, new BigDecimal("5"), new BigDecimal("30"), new BigDecimal("30"), new BigDecimal("30"))
        ));

        ShipmentResponse shipResp = shipmentService.registerShipment(regReq, "office");
        String t1 = shipResp.getTrackingIds().get(0);
        String t2 = shipResp.getTrackingIds().get(1);

        // 3. Scan first parcel to LOADED_ON_TRUCK with this vehicle
        TrackingScanRequest scan1 = new TrackingScanRequest(t1, ParcelStatus.LOADED_ON_TRUCK, v.getVehicleId(), "Loaded on cold van");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(scan1)))
                .andExpect(status().isOk());

        // 4. Verify onTruckCount is now 1
        MvcResult getRes1 = mockMvc.perform(get("/api/v1/vehicles/" + v.getVehicleId())
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        VehicleResponse vAfter1 = objectMapper.readValue(getRes1.getResponse().getContentAsString(), VehicleResponse.class);
        assertEquals(1L, vAfter1.getOnTruckCount());

        // 5. Scan second parcel to LOADED_ON_TRUCK with same vehicle
        TrackingScanRequest scan2 = new TrackingScanRequest(t2, ParcelStatus.LOADED_ON_TRUCK, v.getVehicleId(), "Loaded second cold box");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(scan2)))
                .andExpect(status().isOk());

        // 6. Verify onTruckCount is now 2
        MvcResult getRes2 = mockMvc.perform(get("/api/v1/vehicles/" + v.getVehicleId())
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        VehicleResponse vAfter2 = objectMapper.readValue(getRes2.getResponse().getContentAsString(), VehicleResponse.class);
        assertEquals(2L, vAfter2.getOnTruckCount());

        // 7. Scan first parcel to ARRIVED_AT_TNL (unloaded from truck)
        TrackingScanRequest scan3 = new TrackingScanRequest(t1, ParcelStatus.ARRIVED_AT_TNL, null, "Unloaded box 1");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(scan3)))
                .andExpect(status().isOk());

        // 8. Verify onTruckCount decremented to 1
        MvcResult getRes3 = mockMvc.perform(get("/api/v1/vehicles/" + v.getVehicleId())
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        VehicleResponse vAfter3 = objectMapper.readValue(getRes3.getResponse().getContentAsString(), VehicleResponse.class);
        assertEquals(1L, vAfter3.getOnTruckCount());

        // 9. Smart Delete: Soft-deactivates when vehicle has past tracking history
        mockMvc.perform(delete("/api/v1/vehicles/" + v.getVehicleId())
                        .header("Authorization", officeToken))
                .andExpect(status().isNoContent());

        Vehicle softDeleted = vehicleRepository.findById(v.getVehicleId()).orElseThrow();
        assertFalse(softDeleted.getActive());
        assertEquals("Inactive", softDeleted.getStatus());
    }
}
