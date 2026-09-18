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
import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.ParcelUnit;
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
@ActiveProfiles("test")
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
    private com.tnl.logistics.repository.WaybillRepository waybillRepository;

    @Autowired
    private ShipmentService shipmentService;

    private String officeToken;

    @BeforeEach
    public void setup() {
        waybillRepository.deleteAll();
        trackingEventRepository.deleteAll();
        parcelUnitRepository.deleteAll();
        paymentRepository.deleteAll();
        shipmentRepository.deleteAll();
        clientRepository.deleteAll();

        officeToken = "Bearer " + JwtTokenProvider.generateToken("USR-OFFICE", "OFFICE_STAFF");
    }

    @Test
    public void testMobileClientCreationValidationAndRoleGates() throws Exception {
        ClientCreateRequest request = new ClientCreateRequest("Mobile test client", "Baguio test address", "09170000000", null);
        String payload = objectMapper.writeValueAsString(request);
        String fieldToken = "Bearer " + JwtTokenProvider.generateToken("USR-FIELD", "FIELD_STAFF");
        mockMvc.perform(post("/api/v1/clients").header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/clients").header("Authorization", fieldToken).param("active", "true"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/clients").header("Authorization", "Bearer invalid-token")
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isForbidden());
        request.setEmail("invalid-email");
        MvcResult invalid = mockMvc.perform(post("/api/v1/clients").header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest()).andReturn();
        assertTrue(objectMapper.readTree(invalid.getResponse().getContentAsString()).get("fieldErrors").has("email"));
        assertEquals(0, clientRepository.count());
        MvcResult created = mockMvc.perform(post("/api/v1/clients").header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk()).andReturn();
        JsonNode body = objectMapper.readTree(created.getResponse().getContentAsString());
        assertTrue(body.get("active").asBoolean());
        assertTrue(body.get("clientId").asText().startsWith("CL-"));
        assertTrue(body.get("email").isNull());
        java.util.Set<String> fields = new java.util.HashSet<>();
        body.fieldNames().forEachRemaining(fields::add);
        assertEquals(java.util.Set.of("clientId", "name", "address", "contactNumber", "email", "defaultRateType", "active", "dateRegistered",
                "totalShipments", "totalParcels", "totalCharges", "totalPaid", "outstandingBalance"), fields);
        assertEquals(1, clientRepository.count());
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
        shipmentService.registerShipment(regReq1, "USR-OFFICE");

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
        shipmentService.registerShipment(regReq2, "USR-OFFICE");

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

    @Test
    public void testClientDetailWithZeroShipmentsReturnsEmptyStats() throws Exception {
        Client client = new Client(
                "CL-099",
                "New Enterprise",
                "Makati City",
                "0917-999-8888",
                "admin@newenterprise.ph",
                ChargeModel.FLAT,
                true
        );
        clientRepository.saveAndFlush(client);

        MvcResult detailRes = mockMvc.perform(get("/api/v1/clients/CL-099")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();

        ClientDetailResponse detail = objectMapper.readValue(detailRes.getResponse().getContentAsString(), ClientDetailResponse.class);
        assertEquals("CL-099", detail.getClientId());
        assertEquals(0, detail.getTotalShipments());
        assertEquals(0, detail.getTotalParcels());
        assertEquals(BigDecimal.ZERO, detail.getTotalCharges());
        assertEquals(BigDecimal.ZERO, detail.getTotalPaid());
        assertEquals(BigDecimal.ZERO, detail.getOutstandingBalance());
        assertTrue(detail.getShipments().isEmpty());
    }

    @Test
    public void testBatchQueriesForParcelsAndPayments() {
        assertTrue(parcelUnitRepository.findByShipment_ShipmentIdInOrderBySeqAsc(List.of("NON-EXISTENT")).isEmpty());
        assertTrue(paymentRepository.findByShipment_ShipmentIdIn(List.of("NON-EXISTENT")).isEmpty());
    }

    @Test
    public void testClientListingDefaultsToPaginationUnlessAllSpecified() throws Exception {
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

        // Omitting page parameter should return paginated PageImpl response (with content)
        MvcResult pagedRes = mockMvc.perform(get("/api/v1/clients")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode pagedRoot = objectMapper.readTree(pagedRes.getResponse().getContentAsString());
        assertTrue(pagedRoot.has("content"), "Default client listing must return a paginated Page structure");
        assertEquals(1, pagedRoot.get("content").size());

        // Explicit all=true should return flat array response
        MvcResult allRes = mockMvc.perform(get("/api/v1/clients?all=true")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode allRoot = objectMapper.readTree(allRes.getResponse().getContentAsString());
        assertTrue(allRoot.isArray(), "all=true parameter must return a JSON array");
        assertEquals(1, allRoot.size());
    }

    @Test
    public void testClientDetailIncludesCompletedShipmentsInRollupAndCounters() throws Exception {
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

        // 2. Register a shipment with 2 parcels
        ShipmentRegistrationRequest regReq = new ShipmentRegistrationRequest();
        regReq.setClientId("CL-001");
        regReq.setRecipientName("Juan Dela Cruz");
        regReq.setRecipientAddress("Baguio City");
        regReq.setRecipientContact("09181112222");
        regReq.setQuantity(2);
        regReq.setChargeModel(ChargeModel.FLAT);
        regReq.setShippingFee(new BigDecimal("1000.00"));
        regReq.setPaidAtRegistration(true);
        regReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        regReq.setParcels(List.of(
                new ParcelUnitRequest(1, new BigDecimal("2"), new BigDecimal("20"), new BigDecimal("15"), new BigDecimal("10")),
                new ParcelUnitRequest(2, new BigDecimal("3"), new BigDecimal("25"), new BigDecimal("15"), new BigDecimal("10"))
        ));
        ShipmentResponse created = shipmentService.registerShipment(regReq, "USR-OFFICE");
        String shipmentId = created.getShipmentId();

        // 3. Mark all parcels as COMPLETED
        List<ParcelUnit> parcels = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId);
        assertEquals(2, parcels.size());
        for (ParcelUnit unit : parcels) {
            unit.setCurrentStatus(ParcelStatus.COMPLETED);
        }
        parcelUnitRepository.saveAllAndFlush(parcels);

        // 4. Request client detail
        MvcResult detailRes = mockMvc.perform(get("/api/v1/clients/CL-001")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();

        ClientDetailResponse detail = objectMapper.readValue(detailRes.getResponse().getContentAsString(), ClientDetailResponse.class);
        assertEquals(1, detail.getTotalShipments());
        assertEquals(2, detail.getTotalParcels());
        assertEquals(1L, detail.getCompletedDeliveries());
        assertEquals(1, detail.getShipments().size());
        assertEquals("Completed", detail.getShipments().get(0).getStatus());
        assertEquals("2 / 2 Completed", detail.getShipments().get(0).getStatusRollup());
    }
}

