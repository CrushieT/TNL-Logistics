package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.dto.ClientCreateRequest;
import com.tnl.logistics.dto.ClientDetailResponse;
import com.tnl.logistics.dto.ClientSummaryResponse;
import com.tnl.logistics.dto.ParcelUnitRequest;
import com.tnl.logistics.dto.ShipmentRegistrationRequest;
import com.tnl.logistics.dto.ShipmentResponse;
import com.tnl.logistics.model.ChargeModel;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.RegisteredVia;
import com.tnl.logistics.repository.ClientRepository;
import com.tnl.logistics.repository.ParcelUnitRepository;
import com.tnl.logistics.repository.PaymentRepository;
import com.tnl.logistics.repository.ShipmentRepository;
import com.tnl.logistics.repository.TrackingEventRepository;
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
public class ClientIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private ShipmentRepository shipmentRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private ParcelUnitRepository parcelUnitRepository;

    @Autowired
    private TrackingEventRepository trackingEventRepository;

    @Autowired
    private ShipmentService shipmentService;

    private String officeToken;

    @BeforeEach
    public void setup() {
        trackingEventRepository.deleteAll();
        parcelUnitRepository.deleteAll();
        paymentRepository.deleteAll();
        shipmentRepository.deleteAll();
        clientRepository.deleteAll();

        officeToken = "Bearer " + JwtTokenProvider.generateToken("office", "OFFICE_STAFF");
    }

    @Test
    public void testClientCrudAndSequentialIdGeneration() throws Exception {
        // 1. Register first client (CL-001)
        ClientCreateRequest req1 = new ClientCreateRequest(
                "Northbridge Trading",
                "Unit 402, Trade Tower, Binondo, Manila",
                "0917-555-0148",
                "orders@northbridge.ph",
                "FLAT",
                true
        );

        MvcResult res1 = mockMvc.perform(post("/api/v1/clients")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isOk())
                .andReturn();

        ClientSummaryResponse c1 = objectMapper.readValue(res1.getResponse().getContentAsString(), ClientSummaryResponse.class);
        assertEquals("CL-001", c1.getClientId());
        assertEquals("Northbridge Trading", c1.getName());
        assertEquals(ChargeModel.FLAT, c1.getDefaultRateType());
        assertTrue(c1.getActive());

        // 2. Register second client (CL-002) with PER_PARCEL
        ClientCreateRequest req2 = new ClientCreateRequest(
                "Sunrise Hardware",
                "88 Rizal St., Baguio City",
                "0918-555-0022",
                "acctg@sunrisehw.ph",
                "PER_PARCEL",
                true
        );

        MvcResult res2 = mockMvc.perform(post("/api/v1/clients")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isOk())
                .andReturn();

        ClientSummaryResponse c2 = objectMapper.readValue(res2.getResponse().getContentAsString(), ClientSummaryResponse.class);
        assertEquals("CL-002", c2.getClientId());
        assertEquals("Sunrise Hardware", c2.getName());
        assertEquals(ChargeModel.PER_PARCEL, c2.getDefaultRateType());

        // 3. Update client details
        req1.setName("Northbridge Trading Corp");
        req1.setAddress("Updated Address, Manila");
        MvcResult updateRes = mockMvc.perform(put("/api/v1/clients/CL-001")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isOk())
                .andReturn();

        ClientSummaryResponse updated = objectMapper.readValue(updateRes.getResponse().getContentAsString(), ClientSummaryResponse.class);
        assertEquals("Northbridge Trading Corp", updated.getName());
        assertEquals("Updated Address, Manila", updated.getAddress());

        // 4. Smart Deletion: Hard Delete on client with 0 shipments
        mockMvc.perform(delete("/api/v1/clients/CL-002")
                        .header("Authorization", officeToken))
                .andExpect(status().isNoContent());

        assertTrue(clientRepository.findById("CL-002").isEmpty());
    }

    @Test
    public void testPaginatedSearchAndZeroNPlusOneAggregations() throws Exception {
        // 1. Create client
        Client client = new Client(
                "CL-001",
                "Northbridge Trading",
                "Binondo, Manila",
                "0917-555-0148",
                "orders@northbridge.ph",
                ChargeModel.FLAT,
                true
        );
        clientRepository.saveAndFlush(client);

        // 2. Register Shipment 1: 3 parcels, Flat fee 1550, Unpaid (Paid at reg = false)
        ShipmentRegistrationRequest regReq1 = new ShipmentRegistrationRequest();
        regReq1.setClientId("CL-001");
        regReq1.setRecipientName("Juan Dela Cruz");
        regReq1.setRecipientAddress("Baguio City");
        regReq1.setRecipientContact("09181112222");
        regReq1.setQuantity(3);
        regReq1.setChargeModel(ChargeModel.FLAT);
        regReq1.setShippingFee(new BigDecimal("1550.00"));
        regReq1.setPaidAtRegistration(false);
        regReq1.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        regReq1.setParcels(List.of(
                new ParcelUnitRequest(1, new BigDecimal("2"), new BigDecimal("20"), new BigDecimal("15"), new BigDecimal("10")),
                new ParcelUnitRequest(2, new BigDecimal("2"), new BigDecimal("20"), new BigDecimal("15"), new BigDecimal("10")),
                new ParcelUnitRequest(3, new BigDecimal("2"), new BigDecimal("20"), new BigDecimal("15"), new BigDecimal("10"))
        ));
        shipmentService.registerShipment(regReq1, "office");

        // 3. Register Shipment 2: 1 parcel, Flat fee 450, Paid at reg = true
        ShipmentRegistrationRequest regReq2 = new ShipmentRegistrationRequest();
        regReq2.setClientId("CL-001");
        regReq2.setRecipientName("Maria Santos");
        regReq2.setRecipientAddress("Baguio City");
        regReq2.setRecipientContact("09183334444");
        regReq2.setQuantity(1);
        regReq2.setChargeModel(ChargeModel.FLAT);
        regReq2.setShippingFee(new BigDecimal("450.00"));
        regReq2.setPaidAtRegistration(true);
        regReq2.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        regReq2.setParcels(List.of(
                new ParcelUnitRequest(1, new BigDecimal("1"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"))
        ));
        shipmentService.registerShipment(regReq2, "office");

        // 4. Test Paginated Query: GET /api/v1/clients?page=0&size=20&search=Northbridge
        MvcResult pageRes = mockMvc.perform(get("/api/v1/clients?page=0&size=20&search=Northbridge&active=true")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode root = objectMapper.readTree(pageRes.getResponse().getContentAsString());
        assertTrue(root.has("content"));
        JsonNode content = root.get("content");
        assertEquals(1, content.size());

        JsonNode cNode = content.get(0);
        assertEquals("CL-001", cNode.get("clientId").asText());
        assertEquals("Northbridge Trading", cNode.get("name").asText());
        assertEquals(2, cNode.get("totalShipments").asLong());
        assertEquals(4, cNode.get("totalParcels").asLong());
        assertEquals(2000.0, cNode.get("totalCharges").asDouble(), 0.01);
        assertEquals(450.0, cNode.get("totalPaid").asDouble(), 0.01);
        assertEquals(1550.0, cNode.get("outstandingBalance").asDouble(), 0.01);

        // 5. Test Client Profile Inspection: GET /api/v1/clients/CL-001
        MvcResult detailRes = mockMvc.perform(get("/api/v1/clients/CL-001")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();

        ClientDetailResponse detail = objectMapper.readValue(detailRes.getResponse().getContentAsString(), ClientDetailResponse.class);
        assertEquals("CL-001", detail.getClientId());
        assertEquals(2, detail.getTotalShipments());
        assertEquals(4, detail.getTotalParcels());
        assertEquals(new BigDecimal("2000.00").compareTo(detail.getTotalCharges()), 0);
        assertEquals(new BigDecimal("450.00").compareTo(detail.getTotalPaid()), 0);
        assertEquals(new BigDecimal("1550.00").compareTo(detail.getOutstandingBalance()), 0);
        assertEquals(2, detail.getShipments().size());

        // 6. Smart Deletion: Soft Deactivation on client with historical shipments
        mockMvc.perform(delete("/api/v1/clients/CL-001")
                        .header("Authorization", officeToken))
                .andExpect(status().isNoContent());

        Client softDeactivated = clientRepository.findById("CL-001").orElseThrow();
        assertFalse(softDeactivated.getActive());
    }
}
