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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
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
    private PrintEventRepository printEventRepository;

    @Autowired
    private PrintAuditJobRepository printAuditJobRepository;

    @Autowired
    private com.tnl.logistics.repository.WaybillRepository waybillRepository;

    @Autowired
    private com.tnl.logistics.repository.VehicleRepository vehicleRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private String officeToken;
    private String fieldToken;
    private String currentYear;

    @BeforeEach
    public void setup() {
        waybillRepository.deleteAll();
        printEventRepository.deleteAll();
        printAuditJobRepository.deleteAll();
        trackingEventRepository.deleteAll();
        paymentRepository.deleteAll();
        parcelUnitRepository.deleteAll();
        shipmentRepository.deleteAll();

        jdbcTemplate.update("DELETE FROM identifier_counter WHERE counter_key IN (?, ?)",
                "SHIPMENT:" + LocalDate.now().getYear(),
                "TRACKING:" + LocalDate.now().getYear());

        officeToken = "Bearer " + JwtTokenProvider.generateToken("USR-OFFICE", "OFFICE_STAFF");
        fieldToken = "Bearer " + JwtTokenProvider.generateToken("USR-FIELD", "FIELD_STAFF");

        Client client = clientRepository.findById("CL-001").orElse(null);
        if (client == null) {
            clientRepository.save(new Client("CL-001", "Acme Logistics Client", "Manila", "09170000000", "client@acme.com", ChargeModel.FLAT, true));
        } else if (!Boolean.TRUE.equals(client.getActive())) {
            client.setActive(true);
            clientRepository.save(client);
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
    public void testOfficeStaffMobileRegistrationContractAndPaymentStates() throws Exception {
        for (boolean isPaid : List.of(false, true)) {
            ShipmentRegistrationRequest request = createMobileRegistrationRequest();
            request.setPaidAtRegistration(isPaid);
            request.setChargeModel(isPaid ? ChargeModel.PER_PARCEL : ChargeModel.FLAT);
            MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                            .header("Authorization", officeToken).contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated()).andReturn();
            JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
            java.util.Set<String> fields = new java.util.HashSet<>();
            body.fieldNames().forEachRemaining(fields::add);
            assertEquals(java.util.Set.of("shipmentId", "clientId", "recipientName", "totalAmount", "paidAtRegistration", "trackingIds"), fields);
            ShipmentResponse response = objectMapper.treeToValue(body, ShipmentResponse.class);
            assertEquals(0, new BigDecimal(isPaid ? "220.20" : "120.10").compareTo(response.getTotalAmount()));
            assertEquals(isPaid, response.getPaidAtRegistration());
            assertEquals(2, response.getTrackingIds().size());
            assertEquals(RegisteredVia.MOBILE_FIELD, shipmentRepository.findById(response.getShipmentId()).orElseThrow().getRegisteredVia());
            for (String trackingId : response.getTrackingIds()) {
                ParcelUnit parcel = parcelUnitRepository.findById(trackingId).orElseThrow();
                assertEquals(ParcelStatus.QR_GENERATED, parcel.getCurrentStatus());
                assertEquals(LabelStatus.NOT_PRINTED, parcel.getLabelStatus());
                assertEquals(new BigDecimal("0.0300"), parcel.getVolumeCbm());
                List<TrackingEvent> events = trackingEventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(trackingId);
                assertEquals(2, events.size());
                assertTrue(events.stream().allMatch(event -> "USR-OFFICE".equals(event.getStaff().getUserId())));
                assertEquals(java.util.Set.of(ParcelStatus.REGISTERED, ParcelStatus.QR_GENERATED),
                        events.stream().map(TrackingEvent::getStatus).collect(java.util.stream.Collectors.toSet()));
            }
            assertEquals(isPaid ? 1 : 0, paymentRepository.count());
            if (isPaid) {
                Payment payment = paymentRepository.findAll().getFirst();
                assertEquals(PaymentMethod.CASH, payment.getMethod());
                assertEquals(0, response.getTotalAmount().compareTo(payment.getAmountPaid()));
            }
        }
    }

    @Test
    public void testMobileRegistrationRejectsInvalidTokenAndFieldStaffWithoutWrites() throws Exception {
        String payload = objectMapper.writeValueAsString(createMobileRegistrationRequest());
        mockMvc.perform(post("/api/v1/shipments").header("Authorization", "Bearer invalid-token")
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/shipments").header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isForbidden());
        assertEquals(0, shipmentRepository.count());
        assertEquals(0, paymentRepository.count());
    }

    @Test
    public void testMobileRegistrationRejectsInvalidMeasurementsAndFeesWithoutWrites() throws Exception {
        ShipmentRegistrationRequest request = createMobileRegistrationRequest();
        request.setShippingFee(new BigDecimal("-1"));
        request.getParcels().getFirst().setWeightKg(new BigDecimal("0"));
        MvcResult result = mockMvc.perform(post("/api/v1/shipments").header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest()).andReturn();
        JsonNode errors = objectMapper.readTree(result.getResponse().getContentAsString()).get("fieldErrors");
        assertTrue(errors.has("shippingFee"));
        assertTrue(errors.has("parcels[0].weightKg"));
        assertEquals(0, shipmentRepository.count());
        assertEquals(0, parcelUnitRepository.count());
        assertEquals(0, paymentRepository.count());
    }

    private ShipmentRegistrationRequest createMobileRegistrationRequest() {
        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientName("Mobile registration recipient");
        request.setRecipientAddress("Test street, Baguio");
        request.setRecipientContact("09170000000");
        request.setQuantity(2);
        request.setChargeModel(ChargeModel.FLAT);
        request.setShippingFee(new BigDecimal("100.10"));
        request.setOtherCharges(new BigDecimal("20.00"));
        request.setRegisteredVia(RegisteredVia.MOBILE_FIELD);
        request.setRoute("Manila to TNL Baguio");
        request.setParcels(List.of(
                new ParcelUnitRequest(1, new BigDecimal("1.25"), new BigDecimal("40"), new BigDecimal("25"), new BigDecimal("30")),
                new ParcelUnitRequest(2, new BigDecimal("1.25"), new BigDecimal("40"), new BigDecimal("25"), new BigDecimal("30"))));
        return request;
    }

    @Test
    public void testShipmentPaginationBoundsInvalidPageAndSizeValues() throws Exception {
        MvcResult oversizedResult = mockMvc.perform(get("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .param("page", "-7")
                        .param("size", "1000000"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode oversizedPage = objectMapper.readTree(oversizedResult.getResponse().getContentAsString()).get("page");
        assertEquals(0, oversizedPage.get("number").asInt());
        assertEquals(100, oversizedPage.get("size").asInt());

        MvcResult undersizedResult = mockMvc.perform(get("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .param("size", "0"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode undersizedPage = objectMapper.readTree(undersizedResult.getResponse().getContentAsString()).get("page");
        assertEquals(0, undersizedPage.get("number").asInt());
        assertEquals(1, undersizedPage.get("size").asInt());

        mockMvc.perform(get("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .param("page", "not-a-number"))
                .andExpect(status().isBadRequest());
    }

    @Test
    public void testShipmentPaginationBoundsDoNotBypassAuthorization() throws Exception {
        mockMvc.perform(get("/api/v1/shipments")
                        .param("page", "-7")
                        .param("size", "1000000"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/shipments")
                        .header("Authorization", "Bearer invalid-token")
                        .param("page", "-7")
                        .param("size", "1000000"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/shipments")
                        .header("Authorization", fieldToken)
                        .param("page", "-7")
                        .param("size", "1000000"))
                .andExpect(status().isForbidden());
    }

    @Test
    public void testFindParcelSearchFilterAndRoleGates() throws Exception {
        // 1. Create a mobile shipment with 2 parcels
        ShipmentRegistrationRequest regReq = createMobileRegistrationRequest();
        MvcResult regResult = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(regReq)))
                .andExpect(status().isCreated()).andReturn();
        ShipmentResponse created = objectMapper.readValue(regResult.getResponse().getContentAsString(), ShipmentResponse.class);
        String trackingId0 = created.getTrackingIds().getFirst();

        // 2. Role gating: FIELD_STAFF cannot access GET /api/v1/shipments or GET /api/v1/shipments/{id}
        mockMvc.perform(get("/api/v1/shipments").header("Authorization", fieldToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/shipments/" + created.getShipmentId()).header("Authorization", fieldToken))
                .andExpect(status().isForbidden());

        // 3. Search by parcel tracking ID finds the parent shipment
        MvcResult searchResult = mockMvc.perform(get("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .param("search", trackingId0))
                .andExpect(status().isOk()).andReturn();
        JsonNode searchJson = objectMapper.readTree(searchResult.getResponse().getContentAsString());
        assertEquals(1, searchJson.get("page").get("totalElements").asInt());
        JsonNode firstItem = searchJson.get("content").get(0);
        assertEquals(created.getShipmentId(), firstItem.get("shipmentId").asText());
        assertEquals("MOBILE_FIELD", firstItem.get("registeredVia").asText());
        assertEquals(false, firstItem.get("allLabelsPrinted").asBoolean());

        // 4. Label status filter: NEEDS_LABEL returns the shipment
        MvcResult needsLabelResult = mockMvc.perform(get("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .param("labelStatus", "NEEDS_LABEL"))
                .andExpect(status().isOk()).andReturn();
        assertEquals(1, objectMapper.readTree(needsLabelResult.getResponse().getContentAsString()).get("page").get("totalElements").asInt());

        // 5. Record label print for all units
        mockMvc.perform(post("/api/v1/shipments/" + created.getShipmentId() + "/labels/print")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PrintLabelRequest(
                                UUID.randomUUID(), null, "SYSTEM-PDF"))))
                .andExpect(status().isOk());

        // 6. After print, NEEDS_LABEL returns 0 and PRINTED returns 1 with allLabelsPrinted: true
        MvcResult afterPrintNeeds = mockMvc.perform(get("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .param("labelStatus", "NEEDS_LABEL"))
                .andExpect(status().isOk()).andReturn();
        assertEquals(0, objectMapper.readTree(afterPrintNeeds.getResponse().getContentAsString()).get("page").get("totalElements").asInt());

        MvcResult afterPrintPrinted = mockMvc.perform(get("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .param("labelStatus", "PRINTED"))
                .andExpect(status().isOk()).andReturn();
        JsonNode printedJson = objectMapper.readTree(afterPrintPrinted.getResponse().getContentAsString());
        assertEquals(1, printedJson.get("page").get("totalElements").asInt());
        assertTrue(printedJson.get("content").get(0).get("allLabelsPrinted").asBoolean());

        // 7. Inspect single parcel endpoint returns full details
        MvcResult parcelResult = mockMvc.perform(get("/api/v1/parcel-units/" + trackingId0)
                        .header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode parcelJson = objectMapper.readTree(parcelResult.getResponse().getContentAsString());
        assertEquals(trackingId0, parcelJson.get("trackingId").asText());
        assertEquals(created.getShipmentId(), parcelJson.get("shipmentId").asText());
        assertEquals("Printed", parcelJson.get("labelStatus").asText());
    }

    @Test
    public void testRegistrationUsesNumericCountersPastIdentifierWidthBoundaries() throws Exception {
        Client client = clientRepository.findById("CL-001").orElseThrow();
        Shipment shipment999 = new Shipment(
                "SHP-" + currentYear + "-999", client, "Original 999", "Manila", "09170000001",
                1, ChargeModel.FLAT, new BigDecimal("100.00"), BigDecimal.ZERO,
                new BigDecimal("100.00"), false, RegisteredVia.DESKTOP_OFFICE);
        Shipment shipment1000 = new Shipment(
                "SHP-" + currentYear + "-1000", client, "Original 1000", "Manila", "09170000002",
                1, ChargeModel.FLAT, new BigDecimal("100.00"), BigDecimal.ZERO,
                new BigDecimal("100.00"), false, RegisteredVia.DESKTOP_OFFICE);
        shipmentRepository.save(shipment999);
        shipmentRepository.save(shipment1000);
        parcelUnitRepository.save(new ParcelUnit(
                "TRK-" + currentYear + "-999999", shipment999, 1, null, null, null, null, null));
        parcelUnitRepository.save(new ParcelUnit(
                "TRK-" + currentYear + "-1000000", shipment1000, 1, null, null, null, null, null));

        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientName("New Recipient");
        request.setRecipientAddress("Cebu City");
        request.setRecipientContact("09181112222");
        request.setQuantity(1);
        request.setChargeModel(ChargeModel.FLAT);
        request.setShippingFee(new BigDecimal("150.00"));
        request.setOtherCharges(BigDecimal.ZERO);
        request.setPaidAtRegistration(false);
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("2.5"), null, null, null)));

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), ShipmentResponse.class);
        assertEquals("SHP-" + currentYear + "-1001", response.getShipmentId());
        assertEquals("TRK-" + currentYear + "-1000001", response.getTrackingIds().getFirst());
        assertEquals("Original 1000", shipmentRepository.findById("SHP-" + currentYear + "-1000").orElseThrow().getRecipientName());
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
                        .content(objectMapper.writeValueAsString(new PrintLabelRequest(UUID.randomUUID(), List.of(trackingId)))))
                .andExpect(status().isOk());

        ParcelUnit updatedUnit = parcelUnitRepository.findById(trackingId).orElseThrow();
        assertEquals(LabelStatus.PRINTED, updatedUnit.getLabelStatus());
        assertEquals(0, updatedUnit.getReprintCount());

        // 4. Subsequent Print (Reprint)
        mockMvc.perform(post("/api/v1/shipments/" + shipmentId + "/labels/print")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PrintLabelRequest(UUID.randomUUID(), List.of(trackingId)))))
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

    @Test
    public void testRejectShipmentRegistrationForInactiveClient() throws Exception {
        // Create an inactive client
        Client inactiveClient = new Client("CL-INACTIVE", "Deactivated Client", "Manila", "09170001111", "inactive@client.com", ChargeModel.FLAT, false);
        clientRepository.saveAndFlush(inactiveClient);

        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-INACTIVE");
        request.setRecipientName("Test Inactive Rejection");
        request.setRecipientAddress("Baguio");
        request.setRecipientContact("09180000000");
        request.setQuantity(1);
        request.setChargeModel(ChargeModel.FLAT);
        request.setShippingFee(new BigDecimal("200.00"));
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("1"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"))));

        mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    public void testShipmentFilteredPagination() throws Exception {
        // Shipment 1: Paid, Registered
        ShipmentRegistrationRequest req1 = new ShipmentRegistrationRequest();
        req1.setClientId("CL-001");
        req1.setRecipientName("Alpha Recipient");
        req1.setRecipientAddress("Baguio");
        req1.setRecipientContact("09180000001");
        req1.setQuantity(1);
        req1.setChargeModel(ChargeModel.FLAT);
        req1.setShippingFee(new BigDecimal("100.00"));
        req1.setPaidAtRegistration(true);
        req1.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        req1.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("1"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"))));

        MvcResult res1 = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isCreated())
                .andReturn();
        ShipmentResponse s1 = objectMapper.readValue(res1.getResponse().getContentAsString(), ShipmentResponse.class);

        // Shipment 2: Unpaid, Loaded on Truck
        ShipmentRegistrationRequest req2 = new ShipmentRegistrationRequest();
        req2.setClientId("CL-001");
        req2.setRecipientName("Beta Recipient");
        req2.setRecipientAddress("La Trinidad");
        req2.setRecipientContact("09180000002");
        req2.setQuantity(1);
        req2.setChargeModel(ChargeModel.FLAT);
        req2.setShippingFee(new BigDecimal("200.00"));
        req2.setPaidAtRegistration(false);
        req2.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        req2.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("1"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"))));

        MvcResult res2 = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isCreated())
                .andReturn();
        ShipmentResponse s2 = objectMapper.readValue(res2.getResponse().getContentAsString(), ShipmentResponse.class);

        ParcelUnit u2 = parcelUnitRepository.findById(s2.getTrackingIds().get(0)).orElseThrow();
        u2.setCurrentStatus(ParcelStatus.LOADED_ON_TRUCK);
        parcelUnitRepository.saveAndFlush(u2);

        // Shipment 3: Partial, Completed
        ShipmentRegistrationRequest req3 = new ShipmentRegistrationRequest();
        req3.setClientId("CL-001");
        req3.setRecipientName("Gamma Recipient");
        req3.setRecipientAddress("Itogon");
        req3.setRecipientContact("09180000003");
        req3.setQuantity(1);
        req3.setChargeModel(ChargeModel.FLAT);
        req3.setShippingFee(new BigDecimal("300.00"));
        req3.setPaidAtRegistration(false);
        req3.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        req3.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("1"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"))));

        MvcResult res3 = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req3)))
                .andExpect(status().isCreated())
                .andReturn();
        ShipmentResponse s3 = objectMapper.readValue(res3.getResponse().getContentAsString(), ShipmentResponse.class);

        Shipment shp3 = shipmentRepository.findById(s3.getShipmentId()).orElseThrow();
        Payment p3 = new Payment(shp3, new BigDecimal("50.00"), PaymentMethod.GCASH, LocalDate.now());
        paymentRepository.saveAndFlush(p3);

        ParcelUnit u3 = parcelUnitRepository.findById(s3.getTrackingIds().get(0)).orElseThrow();
        u3.setCurrentStatus(ParcelStatus.COMPLETED);
        parcelUnitRepository.saveAndFlush(u3);

        // 1. Verify Unfiltered pagination (totalElements = 3, size = 2 -> page 0 has 2, totalElements = 3)
        MvcResult pageResult = mockMvc.perform(get("/api/v1/shipments?page=0&size=2")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode pageJson = objectMapper.readTree(pageResult.getResponse().getContentAsString());
        assertEquals(3, getTotalElements(pageJson));
        assertEquals(2, pageJson.get("content").size());

        // 2. Filter by paymentStatus = "Paid"
        MvcResult paidResult = mockMvc.perform(get("/api/v1/shipments?paymentStatus=Paid")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode paidJson = objectMapper.readTree(paidResult.getResponse().getContentAsString());
        assertEquals(1, getTotalElements(paidJson));
        assertEquals(s1.getShipmentId(), paidJson.get("content").get(0).get("shipmentId").asText());

        // 3. Filter by paymentStatus = "Unpaid"
        MvcResult unpaidResult = mockMvc.perform(get("/api/v1/shipments?paymentStatus=Unpaid")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode unpaidJson = objectMapper.readTree(unpaidResult.getResponse().getContentAsString());
        assertEquals(1, getTotalElements(unpaidJson));
        assertEquals(s2.getShipmentId(), unpaidJson.get("content").get(0).get("shipmentId").asText());

        // 4. Filter by paymentStatus = "Partial"
        MvcResult partialResult = mockMvc.perform(get("/api/v1/shipments?paymentStatus=Partial")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode partialJson = objectMapper.readTree(partialResult.getResponse().getContentAsString());
        assertEquals(1, getTotalElements(partialJson));
        assertEquals(s3.getShipmentId(), partialJson.get("content").get(0).get("shipmentId").asText());

        // 5. Filter by status = "Loaded on Truck"
        MvcResult truckResult = mockMvc.perform(get("/api/v1/shipments?status=Loaded on Truck")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode truckJson = objectMapper.readTree(truckResult.getResponse().getContentAsString());
        assertEquals(1, getTotalElements(truckJson));
        assertEquals(s2.getShipmentId(), truckJson.get("content").get(0).get("shipmentId").asText());

        // 6. Filter by status = "Completed"
        MvcResult compResult = mockMvc.perform(get("/api/v1/shipments?status=Completed")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode compJson = objectMapper.readTree(compResult.getResponse().getContentAsString());
        assertEquals(1, getTotalElements(compJson));
        assertEquals(s3.getShipmentId(), compJson.get("content").get(0).get("shipmentId").asText());

        // 7. Combined filter: status = "Loaded on Truck" & paymentStatus = "Unpaid"
        MvcResult combResult = mockMvc.perform(get("/api/v1/shipments?status=Loaded on Truck&paymentStatus=Unpaid")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode combJson = objectMapper.readTree(combResult.getResponse().getContentAsString());
        assertEquals(1, getTotalElements(combJson));
        assertEquals(s2.getShipmentId(), combJson.get("content").get(0).get("shipmentId").asText());

        // 8. Non-matching combination: status = "Completed" & paymentStatus = "Unpaid" -> 0 results
        MvcResult noMatchResult = mockMvc.perform(get("/api/v1/shipments?status=Completed&paymentStatus=Unpaid")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode noMatchJson = objectMapper.readTree(noMatchResult.getResponse().getContentAsString());
        assertEquals(0, getTotalElements(noMatchJson));
        assertEquals(0, noMatchJson.get("content").size());
    }

    @Test
    public void testFilterShipmentsByVehicle() throws Exception {
        Vehicle vehicle1 = vehicleRepository.findById("TRK-01").orElseGet(() ->
                vehicleRepository.save(new Vehicle("TRK-01", "ABC-1234", "6-Wheeler Forward")));
        Vehicle vehicle2 = vehicleRepository.findById("TRK-02").orElseGet(() ->
                vehicleRepository.save(new Vehicle("TRK-02", "XYZ-5678", "10-Wheeler Wing Van")));

        // Shipment 1: Loaded on TRK-01
        ShipmentRegistrationRequest req1 = new ShipmentRegistrationRequest();
        req1.setClientId("CL-001");
        req1.setRecipientName("Vehicle Test Recipient 1");
        req1.setRecipientAddress("Baguio City");
        req1.setRecipientContact("09180000011");
        req1.setQuantity(1);
        req1.setChargeModel(ChargeModel.FLAT);
        req1.setShippingFee(new BigDecimal("250.00"));
        req1.setPaidAtRegistration(false);
        req1.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        req1.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("2"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"))));

        MvcResult res1 = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isCreated())
                .andReturn();
        ShipmentResponse s1 = objectMapper.readValue(res1.getResponse().getContentAsString(), ShipmentResponse.class);

        ParcelUnit u1 = parcelUnitRepository.findById(s1.getTrackingIds().get(0)).orElseThrow();
        u1.setCurrentStatus(ParcelStatus.LOADED_ON_TRUCK);
        u1.setCurrentVehicle(vehicle1);
        parcelUnitRepository.saveAndFlush(u1);

        // Shipment 2: Registered (no vehicle assigned)
        ShipmentRegistrationRequest req2 = new ShipmentRegistrationRequest();
        req2.setClientId("CL-001");
        req2.setRecipientName("Vehicle Test Recipient 2");
        req2.setRecipientAddress("Baguio City");
        req2.setRecipientContact("09180000012");
        req2.setQuantity(1);
        req2.setChargeModel(ChargeModel.FLAT);
        req2.setShippingFee(new BigDecimal("350.00"));
        req2.setPaidAtRegistration(false);
        req2.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        req2.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("2"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"))));

        MvcResult res2 = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isCreated())
                .andReturn();
        ShipmentResponse s2 = objectMapper.readValue(res2.getResponse().getContentAsString(), ShipmentResponse.class);

        // 1. Filter by vehicleId = TRK-01 -> returns s1 only
        MvcResult trk1Result = mockMvc.perform(get("/api/v1/shipments?vehicleId=TRK-01")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode trk1Json = objectMapper.readTree(trk1Result.getResponse().getContentAsString());
        assertEquals(1, getTotalElements(trk1Json));
        assertEquals(s1.getShipmentId(), trk1Json.get("content").get(0).get("shipmentId").asText());
        assertEquals("TRK-01", trk1Json.get("content").get(0).get("vehicleId").asText());
        assertEquals(vehicle1.getPlateNumber(), trk1Json.get("content").get(0).get("vehiclePlate").asText());

        // 2. Filter by vehicleId = TRK-02 -> returns 0 results
        MvcResult trk2Result = mockMvc.perform(get("/api/v1/shipments?vehicleId=TRK-02")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode trk2Json = objectMapper.readTree(trk2Result.getResponse().getContentAsString());
        assertEquals(0, getTotalElements(trk2Json));

        // 3. Filter by vehicleId = ALL -> returns all shipments
        MvcResult allResult = mockMvc.perform(get("/api/v1/shipments?vehicleId=ALL")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode allJson = objectMapper.readTree(allResult.getResponse().getContentAsString());
        assertEquals(2, getTotalElements(allJson));

        // 4. Combined filter: status = Loaded on Truck and vehicleId = TRK-01
        MvcResult combResult = mockMvc.perform(get("/api/v1/shipments?status=Loaded on Truck&vehicleId=TRK-01")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode combJson = objectMapper.readTree(combResult.getResponse().getContentAsString());
        assertEquals(1, getTotalElements(combJson));
        assertEquals(s1.getShipmentId(), combJson.get("content").get(0).get("shipmentId").asText());
    }

    private int getTotalElements(JsonNode jsonNode) {
        if (jsonNode.has("page") && jsonNode.get("page").has("totalElements")) {
            return jsonNode.get("page").get("totalElements").asInt();
        }
        if (jsonNode.has("totalElements")) {
            return jsonNode.get("totalElements").asInt();
        }
        return 0;
    }

    @Test
    public void testRegisterShipmentFailsWhenQuantityMismatchesParcelCount() throws Exception {
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("2.5"), new BigDecimal("10"), new BigDecimal("20"), new BigDecimal("30"));
        ParcelUnitRequest p2 = new ParcelUnitRequest(2, new BigDecimal("3.0"), new BigDecimal("10"), new BigDecimal("20"), new BigDecimal("30"));

        // Quantity 1 with 2 parcels
        ShipmentRegistrationRequest underbilledRequest = new ShipmentRegistrationRequest();
        underbilledRequest.setClientId("CL-001");
        underbilledRequest.setRecipientName("Underbilled Customer");
        underbilledRequest.setRecipientAddress("Makati");
        underbilledRequest.setRecipientContact("09181112222");
        underbilledRequest.setQuantity(1);
        underbilledRequest.setChargeModel(ChargeModel.PER_PARCEL);
        underbilledRequest.setShippingFee(new BigDecimal("100.00"));
        underbilledRequest.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        underbilledRequest.setParcels(List.of(p1, p2));

        MvcResult result1 = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(underbilledRequest)))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode json1 = objectMapper.readTree(result1.getResponse().getContentAsString());
        assertTrue(json1.get("message").asText().contains("must match parcel items count"));

        // Quantity 3 with 2 parcels
        underbilledRequest.setQuantity(3);
        MvcResult result2 = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(underbilledRequest)))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode json2 = objectMapper.readTree(result2.getResponse().getContentAsString());
        assertTrue(json2.get("message").asText().contains("must match parcel items count"));
    }

    @Test
    public void testRegisterShipmentFailsWhenParcelSequenceHasDuplicatesOrGaps() throws Exception {
        // Gap in sequence: [1, 3]
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("2.5"), null, null, null);
        ParcelUnitRequest p3 = new ParcelUnitRequest(3, new BigDecimal("3.0"), null, null, null);

        ShipmentRegistrationRequest gapRequest = new ShipmentRegistrationRequest();
        gapRequest.setClientId("CL-001");
        gapRequest.setRecipientName("Gap Customer");
        gapRequest.setRecipientAddress("Pasig");
        gapRequest.setRecipientContact("09181112222");
        gapRequest.setQuantity(2);
        gapRequest.setChargeModel(ChargeModel.FLAT);
        gapRequest.setShippingFee(new BigDecimal("100.00"));
        gapRequest.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        gapRequest.setParcels(List.of(p1, p3));

        MvcResult gapResult = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(gapRequest)))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode gapJson = objectMapper.readTree(gapResult.getResponse().getContentAsString());
        assertTrue(gapJson.get("message").asText().contains("contiguous sequence from 1 to 2"));

        // Duplicate sequence: [1, 1]
        ParcelUnitRequest pDup = new ParcelUnitRequest(1, new BigDecimal("4.0"), null, null, null);
        gapRequest.setParcels(List.of(p1, pDup));

        MvcResult dupResult = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(gapRequest)))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode dupJson = objectMapper.readTree(dupResult.getResponse().getContentAsString());
        assertTrue(dupJson.get("message").asText().contains("contiguous sequence from 1 to 2"));

        // Starting offset error: [2, 3]
        ParcelUnitRequest p2 = new ParcelUnitRequest(2, new BigDecimal("2.5"), null, null, null);
        gapRequest.setParcels(List.of(p2, p3));

        MvcResult offsetResult = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(gapRequest)))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode offsetJson = objectMapper.readTree(offsetResult.getResponse().getContentAsString());
        assertTrue(offsetJson.get("message").asText().contains("contiguous sequence from 1 to 2"));
    }

    @Test
    public void testRegisterShipmentSucceedsWithUnorderedInputNormalizedContiguously() throws Exception {
        // Out of order in request: seq 2 then seq 1
        ParcelUnitRequest p2 = new ParcelUnitRequest(2, new BigDecimal("2.5"), new BigDecimal("10"), new BigDecimal("20"), new BigDecimal("30"));
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("3.0"), new BigDecimal("10"), new BigDecimal("20"), new BigDecimal("30"));

        ShipmentRegistrationRequest unorderedRequest = new ShipmentRegistrationRequest();
        unorderedRequest.setClientId("CL-001");
        unorderedRequest.setRecipientName("Valid Unordered Customer");
        unorderedRequest.setRecipientAddress("Taguig");
        unorderedRequest.setRecipientContact("09181112222");
        unorderedRequest.setQuantity(2);
        unorderedRequest.setChargeModel(ChargeModel.PER_PARCEL);
        unorderedRequest.setShippingFee(new BigDecimal("100.00"));
        unorderedRequest.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        unorderedRequest.setParcels(List.of(p2, p1));

        mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(unorderedRequest)))
                .andExpect(status().isCreated());
    }
}
