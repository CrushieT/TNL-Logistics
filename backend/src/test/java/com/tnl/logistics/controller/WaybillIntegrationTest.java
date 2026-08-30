package com.tnl.logistics.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.ChargeModel;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.RegisteredVia;
import com.tnl.logistics.repository.ClientRepository;
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
    @WithMockUser(username = "admin", roles = {"ADMIN"})
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

        // 7. Complete delivery with Client Signature
        WaybillStatusUpdateRequest completeReq = new WaybillStatusUpdateRequest(
                null,
                "Delacruz General Merchandise",
                null,
                "Received in good condition"
        );

        mockMvc.perform(post("/api/v1/waybills/complete/" + shipmentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(completeReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SIGNED_COMPLETED"))
                .andExpect(jsonPath("$.statusLabel").value("Signed / Completed"))
                .andExpect(jsonPath("$.signedBy").value("Delacruz General Merchandise"));

        // 8. Verify shipment detail view now shows "Waybill: Signed / Completed" and status "Completed"
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
    }
}
