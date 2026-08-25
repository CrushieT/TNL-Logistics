package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.dto.ParcelUnitDetailResponse;
import com.tnl.logistics.dto.ParcelUnitRequest;
import com.tnl.logistics.dto.PrintLabelRequest;
import com.tnl.logistics.dto.ShipmentDetailResponse;
import com.tnl.logistics.dto.ShipmentRegistrationRequest;
import com.tnl.logistics.dto.ShipmentResponse;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
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
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Transactional
public class ShipmentIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private ShipmentRepository shipmentRepository;

    @Autowired
    private ParcelUnitRepository parcelUnitRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private TrackingEventRepository trackingEventRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private String officeToken;
    private String fieldToken;
    private String currentYear;

    @BeforeEach
    public void setup() {
        trackingEventRepository.deleteAll();
        paymentRepository.deleteAll();
        parcelUnitRepository.deleteAll();
        shipmentRepository.deleteAll();

        officeToken = "Bearer " + JwtTokenProvider.generateToken("office", "OFFICE_STAFF");
        fieldToken = "Bearer " + JwtTokenProvider.generateToken("field", "FIELD_STAFF");

        if (clientRepository.findById("CL-001").isEmpty()) {
            clientRepository.save(new Client("CL-001", "Acme Logistics Client", "Manila", "09170000000", "client@acme.com"));
        }

        currentYear = String.valueOf(LocalDate.now().getYear());
    }

    @Test
    public void testFlatRateShipmentRegistrationAndSequenceFormatting() throws Exception {
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("2.5"), new BigDecimal("10"), new BigDecimal("20"), new BigDecimal("30"));
        ParcelUnitRequest p2 = new ParcelUnitRequest(2, new BigDecimal("3.0"), new BigDecimal("10"), new BigDecimal("20"), new BigDecimal("30"));

        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientName("John Doe");
        request.setRecipientAddress("Cebu City");
        request.setRecipientContact("09181112222");
        request.setQuantity(2);
        request.setChargeModel(ChargeModel.FLAT);
        request.setShippingFee(new BigDecimal("150.00"));
        request.setOtherCharges(new BigDecimal("50.00"));
        request.setPaidAtRegistration(false);
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setParcels(List.of(p1, p2));

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), ShipmentResponse.class);

        assertTrue(response.getShipmentId().startsWith("SHP-" + currentYear + "-"));
        assertEquals(2, response.getTrackingIds().size());
        assertTrue(response.getTrackingIds().get(0).startsWith("TRK-" + currentYear + "-"));
        assertTrue(response.getTrackingIds().get(1).startsWith("TRK-" + currentYear + "-"));
        assertEquals(new BigDecimal("200.00"), response.getTotalAmount());
    }

    @Test
    public void testPerParcelPricingAndAutoPaymentCreation() throws Exception {
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("1.0"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"));
        ParcelUnitRequest p2 = new ParcelUnitRequest(2, new BigDecimal("1.0"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"));

        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientName("Jane Smith");
        request.setRecipientAddress("Davao City");
        request.setRecipientContact("09193334444");
        request.setQuantity(2);
        request.setChargeModel(ChargeModel.PER_PARCEL);
        request.setShippingFee(new BigDecimal("100.00"));
        request.setOtherCharges(new BigDecimal("20.00"));
        request.setPaidAtRegistration(true);
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setParcels(List.of(p1, p2));

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), ShipmentResponse.class);

        assertEquals(new BigDecimal("220.00"), response.getTotalAmount());
        assertTrue(response.getPaidAtRegistration());

        List<Payment> payments = paymentRepository.findAll();
        assertEquals(1, payments.size());
        assertEquals(new BigDecimal("220.00"), payments.get(0).getAmountPaid());
        assertEquals(PaymentMethod.CASH, payments.get(0).getMethod());

        List<TrackingEvent> events = trackingEventRepository.findAll();
        assertEquals(4, events.size());
        assertEquals(ParcelStatus.REGISTERED, events.get(0).getStatus());
    }

    @Test
    public void testPaginatedShipmentListingAndSearch() throws Exception {
        // Register 2 shipments
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("1.0"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"));

        ShipmentRegistrationRequest req1 = new ShipmentRegistrationRequest();
        req1.setClientId("CL-001");
        req1.setRecipientName("Alpha Recipient");
        req1.setRecipientAddress("Manila");
        req1.setRecipientContact("09111111111");
        req1.setQuantity(1);
        req1.setChargeModel(ChargeModel.FLAT);
        req1.setShippingFee(new BigDecimal("100.00"));
        req1.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        req1.setParcels(List.of(p1));

        mockMvc.perform(post("/api/v1/shipments")
                .header("Authorization", officeToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req1))).andExpect(status().isCreated());

        ShipmentRegistrationRequest req2 = new ShipmentRegistrationRequest();
        req2.setClientId("CL-001");
        req2.setRecipientName("Beta Recipient");
        req2.setRecipientAddress("Baguio");
        req2.setRecipientContact("09222222222");
        req2.setQuantity(1);
        req2.setChargeModel(ChargeModel.FLAT);
        req2.setShippingFee(new BigDecimal("150.00"));
        req2.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        req2.setParcels(List.of(p1));

        mockMvc.perform(post("/api/v1/shipments")
                .header("Authorization", officeToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req2))).andExpect(status().isCreated());

        // 1. Search for "Alpha"
        MvcResult searchResult = mockMvc.perform(get("/api/v1/shipments?search=Alpha&page=0&size=10")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode jsonNode = objectMapper.readTree(searchResult.getResponse().getContentAsString());
        assertEquals(1, jsonNode.get("content").size());
        assertEquals("Alpha Recipient", jsonNode.get("content").get(0).get("recipientName").asText());

        // 2. Fetch all paginated
        MvcResult allResult = mockMvc.perform(get("/api/v1/shipments?page=0&size=10")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode allNode = objectMapper.readTree(allResult.getResponse().getContentAsString());
        int totalElements = allNode.has("page") ? allNode.get("page").get("totalElements").asInt() : allNode.get("totalElements").asInt();
        assertEquals(2, totalElements);
    }

    @Test
    public void testShipmentDetailAndParcelUnitDetailAndLabelPrinting() throws Exception {
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("2.0"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"));
        ShipmentRegistrationRequest req = new ShipmentRegistrationRequest();
        req.setClientId("CL-001");
        req.setRecipientName("Target Detail Recipient");
        req.setRecipientAddress("Pangasinan");
        req.setRecipientContact("09333333333");
        req.setQuantity(1);
        req.setChargeModel(ChargeModel.FLAT);
        req.setShippingFee(new BigDecimal("250.00"));
        req.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        req.setParcels(List.of(p1));

        MvcResult createResult = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse created = objectMapper.readValue(createResult.getResponse().getContentAsString(), ShipmentResponse.class);
        String shipmentId = created.getShipmentId();
        String trackingId = created.getTrackingIds().get(0);

        // 1. Get Shipment Detail
        MvcResult detailResult = mockMvc.perform(get("/api/v1/shipments/" + shipmentId)
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();

        ShipmentDetailResponse detail = objectMapper.readValue(detailResult.getResponse().getContentAsString(), ShipmentDetailResponse.class);
        assertEquals(shipmentId, detail.getShipmentId());
        assertEquals("Target Detail Recipient", detail.getRecipient());
        assertEquals(1, detail.getUnits().size());
        assertEquals(trackingId, detail.getUnits().get(0).getTrackingId());

        // 2. Get Parcel Unit Detail
        MvcResult unitResult = mockMvc.perform(get("/api/v1/parcel-units/" + trackingId)
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();

        ParcelUnitDetailResponse unitDetail = objectMapper.readValue(unitResult.getResponse().getContentAsString(), ParcelUnitDetailResponse.class);
        assertEquals(trackingId, unitDetail.getTrackingId());
        assertEquals("Target Detail Recipient", unitDetail.getRecipientName());
        assertFalse(unitDetail.getHistory().isEmpty());

        // 3. Print Label
        mockMvc.perform(post("/api/v1/shipments/" + shipmentId + "/labels/print")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PrintLabelRequest(List.of(trackingId)))))
                .andExpect(status().isOk());

        ParcelUnit updatedUnit = parcelUnitRepository.findById(trackingId).orElseThrow();
        assertEquals(LabelStatus.PRINTED, updatedUnit.getLabelStatus());
        assertEquals(0, updatedUnit.getReprintCount());

        // 4. Subsequent Print (Reprint)
        mockMvc.perform(post("/api/v1/shipments/" + shipmentId + "/labels/print")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PrintLabelRequest(List.of(trackingId)))))
                .andExpect(status().isOk());

        ParcelUnit reprintedUnit = parcelUnitRepository.findById(trackingId).orElseThrow();
        assertEquals(1, reprintedUnit.getReprintCount());
    }

    @Test
    public void testRoleGatingForFieldStaff() throws Exception {
        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientName("Unauthorized Access");
        request.setRecipientAddress("Test");
        request.setRecipientContact("000");
        request.setQuantity(1);
        request.setChargeModel(ChargeModel.FLAT);
        request.setShippingFee(new BigDecimal("100.00"));
        request.setRegisteredVia(RegisteredVia.MOBILE_FIELD);
        request.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("1"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"))));

        mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }
}
