package com.tnl.logistics.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.ChargeModel;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.RegisteredVia;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.ClientRepository;
import com.tnl.logistics.repository.ParcelUnitRepository;
import com.tnl.logistics.repository.ShipmentRepository;
import com.tnl.logistics.repository.TrackingEventRepository;
import com.tnl.logistics.repository.WaybillRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class WaybillIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private WaybillRepository waybillRepository;

    @Autowired
    private ShipmentRepository shipmentRepository;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private ParcelUnitRepository parcelUnitRepository;

    @Autowired
    private TrackingEventRepository trackingEventRepository;

    @BeforeEach
    void setup() {
        // Ensure CL-001 is active
        Client client = clientRepository.findById("CL-001").orElse(null);
        if (client != null) {
            client.setActive(true);
            clientRepository.save(client);
        }
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testWaybillEndToEndWorkflow() throws Exception {
        // 1. Check haulers dropdown options
        mockMvc.perform(get("/api/v1/waybills/haulers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        // 2. Register a new shipment
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("2.5"), new BigDecimal("30"), new BigDecimal("20"), new BigDecimal("15"));
        ParcelUnitRequest p2 = new ParcelUnitRequest(2, new BigDecimal("3.0"), new BigDecimal("40"), new BigDecimal("30"), new BigDecimal("20"));

        ShipmentRegistrationRequest regReq = new ShipmentRegistrationRequest();
        regReq.setClientId("CL-001");
        regReq.setRecipientName("Juan Dela Cruz");
        regReq.setRecipientAddress("88 Session Road, Baguio City");
        regReq.setRecipientContact("0917-555-0148");
        regReq.setDescription("General Goods");
        regReq.setRoute("Manila → TNL Baguio Hub");
        regReq.setChargeModel(ChargeModel.FLAT);
        regReq.setShippingFee(new BigDecimal("500.00"));
        regReq.setOtherCharges(BigDecimal.ZERO);
        regReq.setQuantity(2);
        regReq.setPaidAtRegistration(true);
        regReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        regReq.setParcels(List.of(p1, p2));

        MvcResult regResult = mockMvc.perform(post("/api/v1/shipments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(regReq)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse shipResp = objectMapper.readValue(regResult.getResponse().getContentAsString(), ShipmentResponse.class);
        String shipmentId = shipResp.getShipmentId();

        // 3. Verify shipment options list contains this shipment as "Not Generated"
        mockMvc.perform(get("/api/v1/waybills/shipments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.shipmentId == '" + shipmentId + "')].waybillStatus").value("Not Generated"));

        // 4. Check initial manifest preview before generation
        mockMvc.perform(get("/api/v1/waybills/manifest/" + shipmentId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shipmentId").value(shipmentId))
                .andExpect(jsonPath("$.statusLabel").value("Not Generated"))
                .andExpect(jsonPath("$.releasedByAdminName").value("Maria Santos"))
                .andExpect(jsonPath("$.totalQuantity").value(2));

        // 5. Send to Hauler (Dispatch)
        WaybillCreateRequest createReq = new WaybillCreateRequest(
                shipmentId,
                "Rogelio Aquino",
                "Rogelio Aquino",
                "0917-111-2222",
                "NBG-1234",
                "Handle with care"
        );

        mockMvc.perform(post("/api/v1/waybills/send-to-hauler")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shipmentId").value(shipmentId))
                .andExpect(jsonPath("$.status").value("SENT_TO_HAULER"))
                .andExpect(jsonPath("$.statusLabel").value("Sent to Hauler"))
                .andExpect(jsonPath("$.haulerName").value("Rogelio Aquino"));

        // 6. Verify shipment detail view now shows "Waybill: Sent to Hauler"
        mockMvc.perform(get("/api/v1/shipments/" + shipmentId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.waybillStatus").value("Waybill: Sent to Hauler"))
                .andExpect(jsonPath("$.hauler").value("Rogelio Aquino"));

        // 7a. Attempting to complete delivery while parcels are still in REGISTERED status fails with HTTP 400
        WaybillStatusUpdateRequest completeReq = new WaybillStatusUpdateRequest(
                null,
                "Delacruz General Merchandise",
                null,
                "Received in good condition"
        );

        mockMvc.perform(post("/api/v1/waybills/complete/" + shipmentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(completeReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot complete waybill: All shipment parcels must be in LOADED_TO_HAULER status before signing proof of delivery."));

        // 7b. Advance parcels to LOADED_TO_HAULER
        List<com.tnl.logistics.model.ParcelUnit> parcels = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId);
        for (com.tnl.logistics.model.ParcelUnit p : parcels) {
            p.setCurrentStatus(com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER);
            parcelUnitRepository.save(p);
        }

        // 7c. Complete delivery with Client Signature now succeeds
        mockMvc.perform(post("/api/v1/waybills/complete/" + shipmentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(completeReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SIGNED_COMPLETED"))
                .andExpect(jsonPath("$.statusLabel").value("Signed / Completed"))
                .andExpect(jsonPath("$.signedBy").value("Delacruz General Merchandise"));

        // 8. Verify shipment detail view shows "Waybill: Signed / Completed", and shipment status rollup advances to Completed
        mockMvc.perform(get("/api/v1/shipments/" + shipmentId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.waybillStatus").value("Waybill: Signed / Completed"))
                .andExpect(jsonPath("$.signedBy").value("Delacruz General Merchandise"))
                .andExpect(jsonPath("$.status").value("Completed"))
                .andExpect(jsonPath("$.statusRollup").value("2 / 2 Completed"));

        // 9. Verify waybills master directory listing
        mockMvc.perform(get("/api/v1/waybills?status=SIGNED_COMPLETED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.shipmentId == '" + shipmentId + "')].signedBy").value("Delacruz General Merchandise"));

        // 10. Re-dispatch of completed waybill fails with HTTP 400
        mockMvc.perform(post("/api/v1/waybills/send-to-hauler")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot dispatch waybill in status SIGNED_COMPLETED. Expected GENERATED."));

        // 11. Re-completion of already signed waybill fails with HTTP 400
        mockMvc.perform(post("/api/v1/waybills/complete/" + shipmentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(completeReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot complete waybill in status SIGNED_COMPLETED. Expected SENT_TO_HAULER."));
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testReDispatchWhenAlreadySentToHaulerFails() throws Exception {
        // Register a shipment
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("2.5"), new BigDecimal("30"), new BigDecimal("20"), new BigDecimal("15"));
        ShipmentRegistrationRequest regReq = new ShipmentRegistrationRequest();
        regReq.setClientId("CL-001");
        regReq.setRecipientName("Test Consignee");
        regReq.setRecipientAddress("Baguio City");
        regReq.setRecipientContact("0917-000-0000");
        regReq.setChargeModel(ChargeModel.FLAT);
        regReq.setShippingFee(new BigDecimal("300.00"));
        regReq.setQuantity(1);
        regReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        regReq.setParcels(List.of(p1));

        MvcResult regResult = mockMvc.perform(post("/api/v1/shipments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(regReq)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse shipResp = objectMapper.readValue(regResult.getResponse().getContentAsString(), ShipmentResponse.class);
        String shipmentId = shipResp.getShipmentId();

        WaybillCreateRequest createReq = new WaybillCreateRequest(
                shipmentId,
                "Rogelio Aquino",
                "Rogelio Aquino",
                "0917-111-2222",
                "NBG-1234",
                "First dispatch"
        );

        // First dispatch succeeds
        mockMvc.perform(post("/api/v1/waybills/send-to-hauler")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isOk());

        // Second dispatch fails because waybill is already SENT_TO_HAULER
        mockMvc.perform(post("/api/v1/waybills/send-to-hauler")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot dispatch waybill in status SENT_TO_HAULER. Expected GENERATED."));
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testCompleteWaybillFailsWhenWaybillNotYetDispatched() throws Exception {
        // Register a shipment
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("2.5"), new BigDecimal("30"), new BigDecimal("20"), new BigDecimal("15"));
        ShipmentRegistrationRequest regReq = new ShipmentRegistrationRequest();
        regReq.setClientId("CL-001");
        regReq.setRecipientName("Direct Complete Consignee");
        regReq.setRecipientAddress("Baguio City");
        regReq.setRecipientContact("0917-000-0000");
        regReq.setChargeModel(ChargeModel.FLAT);
        regReq.setShippingFee(new BigDecimal("300.00"));
        regReq.setQuantity(1);
        regReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        regReq.setParcels(List.of(p1));

        MvcResult regResult = mockMvc.perform(post("/api/v1/shipments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(regReq)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse shipResp = objectMapper.readValue(regResult.getResponse().getContentAsString(), ShipmentResponse.class);
        String shipmentId = shipResp.getShipmentId();

        // 1. Attempt to complete without waybill generated at all -> returns 400 Bad Request
        WaybillStatusUpdateRequest completeReq = new WaybillStatusUpdateRequest(null, "Consignee", null, "Remarks");
        mockMvc.perform(post("/api/v1/waybills/complete/" + shipmentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(completeReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Waybill has not been generated for shipment: " + shipmentId));

        // 2. Create a waybill in GENERATED status directly
        com.tnl.logistics.model.Shipment shipment = shipmentRepository.findById(shipmentId).orElseThrow();
        com.tnl.logistics.model.AppUser user = appUserRepository.findAll().stream().findFirst().orElseThrow();
        com.tnl.logistics.model.Waybill generatedWaybill = new com.tnl.logistics.model.Waybill(
                "WYB-2026-9999", shipment, user, "Pending Hauler"
        );
        waybillRepository.saveAndFlush(generatedWaybill);

        // 3. Attempt to complete waybill while in GENERATED status -> returns 400 Bad Request
        mockMvc.perform(post("/api/v1/waybills/complete/" + shipmentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(completeReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot complete waybill in status GENERATED. Expected SENT_TO_HAULER."));
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testWaybillCompletionRequiresLoadedToHaulerAndAdvancesShipmentStatus() throws Exception {
        // 1. Register shipment with 2 parcels
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("2.0"), new BigDecimal("20"), new BigDecimal("20"), new BigDecimal("20"));
        ParcelUnitRequest p2 = new ParcelUnitRequest(2, new BigDecimal("3.0"), new BigDecimal("30"), new BigDecimal("30"), new BigDecimal("30"));
        ShipmentRegistrationRequest regReq = new ShipmentRegistrationRequest();
        regReq.setClientId("CL-001");
        regReq.setRecipientName("Strict Consignee");
        regReq.setRecipientAddress("Baguio City");
        regReq.setRecipientContact("0917-000-0000");
        regReq.setChargeModel(ChargeModel.FLAT);
        regReq.setShippingFee(new BigDecimal("300.00"));
        regReq.setQuantity(2);
        regReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        regReq.setParcels(List.of(p1, p2));

        MvcResult regResult = mockMvc.perform(post("/api/v1/shipments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(regReq)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse shipResp = objectMapper.readValue(regResult.getResponse().getContentAsString(), ShipmentResponse.class);
        String shipmentId = shipResp.getShipmentId();

        // 2. Dispatch waybill to hauler
        WaybillCreateRequest createReq = new WaybillCreateRequest(
                shipmentId,
                "Cordillera Freight",
                "Pedro Driver",
                "0918-000-1111",
                "XYZ-9999",
                "Strict test dispatch"
        );
        mockMvc.perform(post("/api/v1/waybills/send-to-hauler")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isOk());

        // 3. Mark waybill signed completed while parcels are still in REGISTERED status fails with HTTP 400
        WaybillStatusUpdateRequest completeReq = new WaybillStatusUpdateRequest(
                null,
                "Strict Consignee Signer",
                null,
                "Signed POD"
        );
        mockMvc.perform(post("/api/v1/waybills/complete/" + shipmentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(completeReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot complete waybill: All shipment parcels must be in LOADED_TO_HAULER status before signing proof of delivery."));

        // 4. Advance only parcel 1 to LOADED_TO_HAULER -> partial readiness is still rejected
        List<com.tnl.logistics.model.ParcelUnit> parcels = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId);
        parcels.get(0).setCurrentStatus(com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER);
        parcelUnitRepository.save(parcels.get(0));

        mockMvc.perform(post("/api/v1/waybills/complete/" + shipmentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(completeReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot complete waybill: All shipment parcels must be in LOADED_TO_HAULER status before signing proof of delivery."));

        // 5. Advance parcel 2 to LOADED_TO_HAULER -> all parcels ready
        parcels.get(1).setCurrentStatus(com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER);
        parcelUnitRepository.save(parcels.get(1));

        // 6. Complete waybill now succeeds
        mockMvc.perform(post("/api/v1/waybills/complete/" + shipmentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(completeReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SIGNED_COMPLETED"))
                .andExpect(jsonPath("$.signedBy").value("Strict Consignee Signer"));

        // 7. Verify all parcels in database transitioned to COMPLETED, vehicle cleared, and tracking events exist
        List<com.tnl.logistics.model.ParcelUnit> updatedParcels = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId);
        org.junit.jupiter.api.Assertions.assertEquals(2, updatedParcels.size());
        for (com.tnl.logistics.model.ParcelUnit parcel : updatedParcels) {
            org.junit.jupiter.api.Assertions.assertEquals(com.tnl.logistics.model.ParcelStatus.COMPLETED, parcel.getCurrentStatus());
            org.junit.jupiter.api.Assertions.assertNull(parcel.getCurrentVehicle());
            List<com.tnl.logistics.model.TrackingEvent> events = trackingEventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(parcel.getTrackingId());
            boolean hasCompletedEvent = events.stream().anyMatch(e -> e.getStatus() == com.tnl.logistics.model.ParcelStatus.COMPLETED);
            org.junit.jupiter.api.Assertions.assertTrue(hasCompletedEvent, "Must contain COMPLETED tracking event");
        }

        // 8. Verify shipment overall status is now Completed
        mockMvc.perform(get("/api/v1/shipments/" + shipmentId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Completed"))
                .andExpect(jsonPath("$.statusRollup").value("2 / 2 Completed"));
    }
}
