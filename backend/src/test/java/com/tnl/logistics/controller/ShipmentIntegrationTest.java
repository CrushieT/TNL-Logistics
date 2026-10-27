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
import org.junit.jupiter.api.AfterEach;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

@SpringBootTest(properties = "spring.jpa.properties.hibernate.session_factory.statement_inspector=com.tnl.logistics.controller.ShipmentIntegrationTest$SqlCapture")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class ShipmentIntegrationTest {

    public static class SqlCapture implements org.hibernate.resource.jdbc.spi.StatementInspector {
        static final ThreadLocal<List<String>> statements = ThreadLocal.withInitial(java.util.ArrayList::new);

        @Override
        public String inspect(String sql) {
            statements.get().add(sql);
            return sql;
        }
    }

    @Autowired
    private jakarta.persistence.EntityManager entityManager;

    @Autowired
    private com.tnl.logistics.service.ShipmentService shipmentService;

    @Test
    void currentVehicleReadsPreserveBoundedSql() throws Exception {
        for (int shipmentNumber = 0; shipmentNumber < 3; shipmentNumber++) {
            ShipmentRegistrationRequest request = createMobileRegistrationRequest();
            request.setRecipientName("Vehicle SQL " + shipmentNumber);
            mockMvc.perform(post("/api/v1/shipments").header("Authorization", officeToken)
                    .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated());
        }
        Vehicle vehicle = vehicleRepository.save(new Vehicle("SQL-TRUCK", "SQL-PLATE", "SQL fixture"));
        List<ParcelUnit> parcels = parcelUnitRepository.findAll();
        parcels.forEach(parcel -> parcel.setCurrentVehicle(vehicle));
        parcelUnitRepository.saveAll(parcels);
        entityManager.flush();
        entityManager.clear();
        SqlCapture.statements.get().clear();
        var page = shipmentService.getShipments(null, null, null, null, null,
                org.springframework.data.domain.PageRequest.of(0, 2));
        List<String> listSql = List.copyOf(SqlCapture.statements.get());
        assertEquals(4, listSql.size(), listSql.toString());
        assertTrue(listSql.get(0).contains("limit ?"));
        assertFalse(listSql.get(0).contains("join vehicle"));
        assertEquals("select count(s1_0.shipment_id) from shipment s1_0", listSql.get(1));
        assertTrue(listSql.get(2).contains("left join vehicle"));
        assertTrue(listSql.get(2).contains("shipment_id in (?,?)"));
        var returnedShipmentIds = page.getContent().stream().map(summary -> summary.getShipmentId())
                .collect(java.util.stream.Collectors.toSet());
        var loadedParcels = entityManager.unwrap(org.hibernate.engine.spi.SessionImplementor.class)
                .getPersistenceContextInternal().getEntitiesByKey().values().stream()
                .filter(ParcelUnit.class::isInstance).map(ParcelUnit.class::cast).toList();
        assertEquals(4, loadedParcels.size());
        assertTrue(loadedParcels.stream().allMatch(parcel -> returnedShipmentIds.contains(parcel.getShipment().getShipmentId())));
        assertEquals(2, page.getNumberOfElements());
        assertEquals(3, page.getTotalElements());
        String shipmentId = page.getContent().get(0).getShipmentId();
        entityManager.clear();
        SqlCapture.statements.get().clear();
        assertEquals(2, shipmentService.getShipmentById(shipmentId).getUnits().size());
        List<String> detailSql = List.copyOf(SqlCapture.statements.get());
        assertEquals(5, detailSql.size(), detailSql.toString());
        assertTrue(detailSql.stream().anyMatch(sql -> sql.contains("left join vehicle") && sql.contains("shipment_id in (?)")));
        assertFalse(detailSql.stream().anyMatch(sql -> sql.contains(" from vehicle ")));
        System.out.println("VEHICLE_LIST_SQL " + listSql.size() + " " + listSql);
        System.out.println("VEHICLE_DETAIL_SQL " + detailSql.size() + " " + detailSql);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {
            "NONE", "SINGLE", "REPEATED", "MULTIPLE", "PARTIAL", "LOST", "LOST_ONLY", "CLEARED", "BLANK_PLATE"
    })
    void currentVehicleAssignmentsRemainSeparateFromHistory(String scenario) throws Exception {
        ShipmentRegistrationRequest request = createMobileRegistrationRequest();
        if (scenario.equals("SINGLE")) {
            request.setQuantity(1);
            request.setParcels(request.getParcels().subList(0, 1));
        }
        MvcResult created = mockMvc.perform(post("/api/v1/shipments").header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated()).andReturn();
        String shipmentId = objectMapper.readTree(created.getResponse().getContentAsString()).get("shipmentId").asText();
        List<ParcelUnit> parcels = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId);
        String firstPlate = scenario.equals("BLANK_PLATE") ? " " : "PLATE-A";
        Vehicle firstVehicle = vehicleRepository.save(new Vehicle("CURRENT-A", firstPlate, "Current fixture"));
        Vehicle secondVehicle = vehicleRepository.save(new Vehicle("CURRENT-B", "PLATE-B", "Current fixture"));
        boolean hasFirstAssignment = !scenario.equals("NONE") && !scenario.equals("CLEARED");
        if (hasFirstAssignment) {
            parcels.get(0).setCurrentVehicle(firstVehicle);
            parcels.get(0).setCurrentStatus(ParcelStatus.LOADED_ON_TRUCK);
        }
        if (scenario.equals("REPEATED")) parcels.get(1).setCurrentVehicle(firstVehicle);
        if (List.of("MULTIPLE", "LOST").contains(scenario)) {
            parcels.get(1).setCurrentVehicle(secondVehicle);
        }
        if (scenario.equals("LOST")) parcels.get(1).setLost(true);
        if (scenario.equals("LOST_ONLY")) parcels.get(0).setLost(true);
        if (scenario.equals("CLEARED")) {
            parcels.forEach(parcel -> parcel.setCurrentStatus(ParcelStatus.ARRIVED_AT_TNL));
            AppUser staff = entityManager.find(AppUser.class, "USR-OFFICE");
            trackingEventRepository.save(new TrackingEvent(parcels.get(0), ParcelStatus.LOADED_ON_TRUCK,
                    firstVehicle, staff, "Retained previous assignment"));
        }
        parcelUnitRepository.saveAllAndFlush(parcels);
        entityManager.clear();
        SqlCapture.statements.get().clear();
        var page = shipmentService.getShipments(null, null, null, null, null,
                org.springframework.data.domain.PageRequest.of(0, 10));
        var summary = page.getContent().get(0);
        int expectedCount = List.of("NONE", "LOST_ONLY", "CLEARED").contains(scenario) ? 0
                : scenario.equals("MULTIPLE") ? 2 : 1;
        assertEquals(expectedCount, summary.getCurrentVehicleCount());
        assertEquals(expectedCount == 1 ? "CURRENT-A" : null, summary.getCurrentVehicleId());
        assertEquals(expectedCount == 1 ? firstPlate : null, summary.getCurrentVehiclePlate());
        if (scenario.equals("CLEARED")) assertEquals("CURRENT-A", summary.getVehicleId());
        assertTrue(SqlCapture.statements.get().stream().allMatch(sql -> sql.startsWith("select ")),
                "Read-only list must not modify business records");
        entityManager.clear();
        SqlCapture.statements.get().clear();
        var detail = shipmentService.getShipmentById(shipmentId);
        assertEquals(5, SqlCapture.statements.get().size(), SqlCapture.statements.get().toString());
        assertFalse(SqlCapture.statements.get().stream().anyMatch(sql -> sql.contains(" from vehicle ")));
        assertEquals(parcels.stream().map(ParcelUnit::getSeq).toList(),
                detail.getUnits().stream().map(unit -> unit.getPackageIndex()).toList());
        for (int parcelIndex = 0; parcelIndex < parcels.size(); parcelIndex++) {
            ParcelUnit fixture = parcels.get(parcelIndex);
            var unit = detail.getUnits().get(parcelIndex);
            Vehicle expectedVehicle = fixture.isLost() ? null : fixture.getCurrentVehicle();
            assertEquals(expectedVehicle == null ? null : expectedVehicle.getVehicleId(), unit.getCurrentVehicleId());
            assertEquals(expectedVehicle == null ? null : expectedVehicle.getPlateNumber(), unit.getCurrentVehiclePlate());
        }
        assertTrue(SqlCapture.statements.get().stream().allMatch(sql -> sql.startsWith("select ")),
                "Read-only list and detail must not modify business records");
        MvcResult detailResult = mockMvc.perform(get("/api/v1/shipments/" + shipmentId).header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode detailJson = objectMapper.readTree(detailResult.getResponse().getContentAsString());
        assertTrue(detailJson.get("units").get(0).has("currentVehicleId"));
        assertTrue(detailJson.get("units").get(0).has("currentVehiclePlate"));
        MvcResult listResult = mockMvc.perform(get("/api/v1/shipments").header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        assertEquals(expectedCount, objectMapper.readTree(listResult.getResponse().getContentAsString())
                .get("content").get(0).get("currentVehicleCount").asInt());
        if (scenario.equals("CLEARED")) {
            var filtered = shipmentService.getShipments(null, null, null, "CURRENT-A", null,
                    org.springframework.data.domain.PageRequest.of(0, 10));
            assertEquals(1, filtered.getTotalElements());
            assertEquals(0, filtered.getContent().get(0).getCurrentVehicleCount());
            assertEquals(1, trackingEventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(
                    parcels.get(0).getTrackingId()).stream().filter(event -> event.getVehicle() != null).count());
        }
    }

    @Autowired
    private com.tnl.logistics.support.TestSessionTokenFactory sessionTokens;

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
    private com.tnl.logistics.service.SystemSettingService systemSettingService;

    @Autowired
    private com.tnl.logistics.repository.SystemSettingRepository systemSettingRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private String officeToken; private String adminToken;
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

        jdbcTemplate.update("UPDATE system_setting SET rate_per_kilo = 100.00 WHERE setting_id = 1");
        systemSettingService.refreshCachedSettings();

        officeToken = "Bearer " + sessionTokens.generateToken("USR-OFFICE", "RECEIVING_STAFF");
        adminToken = "Bearer " + sessionTokens.generateToken("USR-ADMIN", "ADMIN");
        fieldToken = "Bearer " + sessionTokens.generateToken("USR-FIELD", "COURIER_STAFF");

        Client client = clientRepository.findById("CL-001").orElse(null);
        if (client == null) {
            clientRepository.save(new Client("CL-001", "Acme Logistics Client", "Manila", "09170000000", "client@acme.com", ChargeModel.FLAT, true));
        } else {
            client.setActive(true);
            client.setRatePerKilo(null);
            clientRepository.save(client);
        }

        currentYear = String.valueOf(LocalDate.now().getYear());
    }

    @AfterEach
    public void tearDown() {
        jdbcTemplate.update("UPDATE system_setting SET rate_per_kilo = 100.00 WHERE setting_id = 1");
        systemSettingService.refreshCachedSettings();
    }

    @Test
    public void testHalfCentPricingMatchesFrontendPreviewAndPersistsTotals() throws Exception {
        Client client = clientRepository.findById("CL-001").orElseThrow();
        client.setRatePerKilo(new BigDecimal("34.25"));
        clientRepository.saveAndFlush(client);
        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientAddress("Delivery street");
        request.setRecipientContact("09170000000");
        request.setQuantity(1);
        request.setChargeModel(ChargeModel.PER_KILO);
        request.setOtherCharges(new BigDecimal("0.29"));
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setExpectedRatePerKilo(new BigDecimal("34.25"));
        request.setExpectedVolumetricDivisor(5000);
        request.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("0.06"),
                new BigDecimal("0.1"), new BigDecimal("0.1"), new BigDecimal("0.1"))));

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.shippingFee").value(2.06))
                .andExpect(jsonPath("$.totalAmount").value(2.35))
                .andReturn();
        ShipmentResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), ShipmentResponse.class);
        JsonNode responseJson = objectMapper.readTree(result.getResponse().getContentAsString());
        java.util.Set<String> responseFields = new java.util.HashSet<>();
        responseJson.fieldNames().forEachRemaining(responseFields::add);
        assertEquals(java.util.Set.of("shipmentId", "clientId", "recipientName", "totalAmount",
                "paidAtRegistration", "trackingIds", "appliedRatePerKilo", "appliedVolumetricDivisor",
                "totalActualWeight", "totalVolumetricWeight", "billableWeight", "shippingFee", "otherCharges"), responseFields);
        Shipment persisted = shipmentRepository.findById(response.getShipmentId()).orElseThrow();
        assertEquals(0, new BigDecimal("2.06").compareTo(persisted.getShippingFee()));
        assertEquals(0, new BigDecimal("2.35").compareTo(persisted.getTotalAmount()));
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
        request.setOtherCharges(new BigDecimal("50.00"));
        request.setPaidAtRegistration(false);
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setExpectedRatePerKilo(new BigDecimal("100.00"));
        request.setExpectedVolumetricDivisor(5000);
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
        assertEquals(new BigDecimal("600.00"), response.getTotalAmount());
        assertEquals(new BigDecimal("100.00"), response.getAppliedRatePerKilo());
        assertEquals(5000, response.getAppliedVolumetricDivisor());
        assertEquals(new BigDecimal("5.50"), response.getTotalActualWeight());
        assertEquals(new BigDecimal("2.40"), response.getTotalVolumetricWeight());
        assertEquals(new BigDecimal("5.50"), response.getBillableWeight());
        assertEquals(new BigDecimal("550.00"), response.getShippingFee());
        assertEquals(new BigDecimal("50.00"), response.getOtherCharges());
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
            assertEquals(java.util.Set.of(
                    "shipmentId", "clientId", "recipientName", "totalAmount", "paidAtRegistration", "trackingIds",
                    "appliedRatePerKilo", "appliedVolumetricDivisor", "totalActualWeight", "totalVolumetricWeight",
                    "billableWeight", "shippingFee", "otherCharges"
            ), fields);
            ShipmentResponse response = objectMapper.treeToValue(body, ShipmentResponse.class);
            // Billable weight is 12.00 kg. With rate 100.00: shipping fee = 1200.00, other charges = 20.00 -> total 1220.00
            assertEquals(0, new BigDecimal("1220.00").compareTo(response.getTotalAmount()));
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
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
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
        request.setOtherCharges(new BigDecimal("20.00"));
        request.setRegisteredVia(RegisteredVia.MOBILE_FIELD);
        request.setRoute("Manila to TNL Baguio");
        request.setExpectedRatePerKilo(new BigDecimal("100.00"));
        request.setExpectedVolumetricDivisor(5000);
        request.setParcels(List.of(
                new ParcelUnitRequest(1, new BigDecimal("1.25"), new BigDecimal("40"), new BigDecimal("25"), new BigDecimal("30")),
                new ParcelUnitRequest(2, new BigDecimal("1.25"), new BigDecimal("40"), new BigDecimal("25"), new BigDecimal("30"))));
        return request;
    }

    @Test
    public void testRegistrationRejectsOversizedFieldsAndExcessiveQuantityWithoutWrites() throws Exception {
        ShipmentRegistrationRequest request = createMobileRegistrationRequest();
        request.setRecipientName("A".repeat(151));
        request.setRecipientAddress("B".repeat(256));
        request.setRecipientContact("0".repeat(12));
        request.setDescription("D".repeat(256));
        request.setRoute("R".repeat(151));
        request.setQuantity(1001);

        MvcResult result = mockMvc.perform(post("/api/v1/shipments").header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest()).andReturn();

        JsonNode errors = objectMapper.readTree(result.getResponse().getContentAsString()).get("fieldErrors");
        assertTrue(errors.has("recipientName"));
        assertTrue(errors.has("recipientAddress"));
        assertTrue(errors.has("recipientContact"));
        assertTrue(errors.has("description"));
        assertTrue(errors.has("route"));
        assertTrue(errors.has("quantity"));
        assertEquals(0, shipmentRepository.count());
        assertEquals(0, parcelUnitRepository.count());
        assertEquals(0, paymentRepository.count());
    }

    @Test
    public void testRegistrationAcceptsLabelTextAtCharacterLimits() throws Exception {
        ShipmentRegistrationRequest request = createMobileRegistrationRequest();
        request.setRecipientAddress("A".repeat(80));
        request.setDescription("D".repeat(120));

        MvcResult result = mockMvc.perform(post("/api/v1/shipments").header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated()).andReturn();
        String shipmentId = objectMapper.readTree(result.getResponse().getContentAsString()).get("shipmentId").asText();
        Shipment shipment = shipmentRepository.findById(shipmentId).orElseThrow();
        assertEquals(request.getRecipientAddress(), shipment.getRecipientAddress());
        assertEquals(request.getDescription(), shipment.getDescription());
    }

    @Test
    public void testRegistrationRejectsLabelTextOneCharacterOverLimitWithoutWrites() throws Exception {
        for (String field : List.of("recipientAddress", "description")) {
            ShipmentRegistrationRequest request = createMobileRegistrationRequest();
            if (field.equals("recipientAddress")) {
                request.setRecipientAddress("A".repeat(81));
            } else {
                request.setDescription("D".repeat(121));
            }
            MvcResult result = mockMvc.perform(post("/api/v1/shipments").header("Authorization", officeToken)
                            .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest()).andReturn();
            JsonNode errors = objectMapper.readTree(result.getResponse().getContentAsString()).get("fieldErrors");
            assertTrue(errors.has(field));
            assertEquals(0, shipmentRepository.count());
            assertEquals(0, parcelUnitRepository.count());
            assertEquals(0, paymentRepository.count());
        }
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
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/shipments")
                        .header("Authorization", "Bearer invalid-token")
                        .param("page", "-7")
                        .param("size", "1000000"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));

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

    // 2. Role gating: COURIER_STAFF cannot access GET /api/v1/shipments or GET /api/v1/shipments/{id}
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
        request.setExpectedRatePerKilo(new BigDecimal("100.00"));
        request.setExpectedVolumetricDivisor(5000);
        request.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("2.5"), new BigDecimal("10"), new BigDecimal("20"), new BigDecimal("30"))));

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
        request.setOtherCharges(new BigDecimal("20.00"));
        request.setPaidAtRegistration(true);
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setExpectedRatePerKilo(new BigDecimal("100.00"));
        request.setExpectedVolumetricDivisor(5000);
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
        Client alphaClient = clientRepository.findById("CL-ALPHA").orElseGet(() ->
                clientRepository.save(new Client("CL-ALPHA", "Alpha Logistics Client", "Manila", "09111111111", "alpha@client.com", ChargeModel.FLAT, true)));

        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("1.0"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"));

        ShipmentRegistrationRequest req1 = new ShipmentRegistrationRequest();
        req1.setClientId(alphaClient.getClientId());
        req1.setRecipientAddress("Manila");
        req1.setRecipientContact("09111111111");
        req1.setQuantity(1);
        req1.setChargeModel(ChargeModel.FLAT);
        req1.setShippingFee(new BigDecimal("100.00"));
        req1.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        req1.setExpectedRatePerKilo(new BigDecimal("100.00"));
        req1.setExpectedVolumetricDivisor(5000);
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
        req2.setExpectedRatePerKilo(new BigDecimal("100.00"));
        req2.setExpectedVolumetricDivisor(5000);
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
        assertEquals("Alpha Logistics Client", jsonNode.get("content").get(0).get("recipientName").asText());

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
        req.setExpectedRatePerKilo(new BigDecimal("100.00"));
        req.setExpectedVolumetricDivisor(5000);
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
        assertEquals("Acme Logistics Client", detail.getRecipient());
        assertEquals(1, detail.getUnits().size());
        assertEquals(trackingId, detail.getUnits().get(0).getTrackingId());

        // 2. Get Parcel Unit Detail
        MvcResult unitResult = mockMvc.perform(get("/api/v1/parcel-units/" + trackingId)
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();

        ParcelUnitDetailResponse unitDetail = objectMapper.readValue(unitResult.getResponse().getContentAsString(), ParcelUnitDetailResponse.class);
        assertEquals(trackingId, unitDetail.getTrackingId());
        assertEquals("Acme Logistics Client", unitDetail.getRecipientName());
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
        request.setExpectedRatePerKilo(new BigDecimal("100.00"));
        request.setExpectedVolumetricDivisor(5000);
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
        request.setExpectedRatePerKilo(new BigDecimal("100.00"));
        request.setExpectedVolumetricDivisor(5000);
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
        req1.setExpectedRatePerKilo(new BigDecimal("100.00"));
        req1.setExpectedVolumetricDivisor(5000);
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
        req2.setExpectedRatePerKilo(new BigDecimal("100.00"));
        req2.setExpectedVolumetricDivisor(5000);
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
        req3.setExpectedRatePerKilo(new BigDecimal("100.00"));
        req3.setExpectedVolumetricDivisor(5000);
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
        req1.setExpectedRatePerKilo(new BigDecimal("100.00"));
        req1.setExpectedVolumetricDivisor(5000);
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
        req2.setExpectedRatePerKilo(new BigDecimal("100.00"));
        req2.setExpectedVolumetricDivisor(5000);
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
        underbilledRequest.setExpectedRatePerKilo(new BigDecimal("100.00"));
        underbilledRequest.setExpectedVolumetricDivisor(5000);
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
        BigDecimal dim = new BigDecimal("10");
        // Gap in sequence: [1, 3]
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("2.5"), dim, dim, dim);
        ParcelUnitRequest p3 = new ParcelUnitRequest(3, new BigDecimal("3.0"), dim, dim, dim);

        ShipmentRegistrationRequest gapRequest = new ShipmentRegistrationRequest();
        gapRequest.setClientId("CL-001");
        gapRequest.setRecipientName("Gap Customer");
        gapRequest.setRecipientAddress("Pasig");
        gapRequest.setRecipientContact("09181112222");
        gapRequest.setQuantity(2);
        gapRequest.setChargeModel(ChargeModel.FLAT);
        gapRequest.setShippingFee(new BigDecimal("100.00"));
        gapRequest.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        gapRequest.setExpectedRatePerKilo(new BigDecimal("100.00"));
        gapRequest.setExpectedVolumetricDivisor(5000);
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
        ParcelUnitRequest pDup = new ParcelUnitRequest(1, new BigDecimal("4.0"), dim, dim, dim);
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
        ParcelUnitRequest p2 = new ParcelUnitRequest(2, new BigDecimal("2.5"), dim, dim, dim);
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
        unorderedRequest.setExpectedRatePerKilo(new BigDecimal("100.00"));
        unorderedRequest.setExpectedVolumetricDivisor(5000);
        unorderedRequest.setParcels(List.of(p2, p1));

        mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(unorderedRequest)))
                .andExpect(status().isCreated());
    }

    @Test
    public void testRegistrationFailsWhenRatePerKiloNotConfigured() throws Exception {
        try {
            SystemSetting setting = systemSettingRepository.findById(SystemSetting.DEFAULT_SETTING_ID).orElseThrow();
            setting.setRatePerKilo(null);
            systemSettingRepository.saveAndFlush(setting);
            systemSettingService.refreshCachedSettings();

            ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("2.0"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"));
            ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
            request.setClientId("CL-001");
            request.setRecipientAddress("Manila");
            request.setRecipientContact("09180001111");
            request.setQuantity(1);
            request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
            request.setExpectedRatePerKilo(new BigDecimal("100.00"));
            request.setExpectedVolumetricDivisor(5000);
            request.setParcels(List.of(p1));

            MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                            .header("Authorization", officeToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isConflict())
                    .andReturn();

            JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
            assertEquals("RATE_PER_KILO_NOT_CONFIGURED", json.get("code").asText());
        } finally {
            jdbcTemplate.update("UPDATE system_setting SET rate_per_kilo = 100.00 WHERE setting_id = 1");
            systemSettingService.refreshCachedSettings();
        }
    }

    @Test
    public void testRegistrationFailsWhenExpectedRatePerKiloMissing() throws Exception {
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("2.0"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"));
        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientAddress("Manila");
        request.setRecipientContact("09180001111");
        request.setQuantity(1);
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setExpectedVolumetricDivisor(5000);
        request.setParcels(List.of(p1));
        // expectedRatePerKilo omitted

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        assertTrue(json.has("fieldErrors") && json.get("fieldErrors").has("expectedRatePerKilo"));
    }

    @Test
    public void testRegistrationFailsWhenExpectedVolumetricDivisorMissing() throws Exception {
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("2.0"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"));
        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientAddress("Manila");
        request.setRecipientContact("09180001111");
        request.setQuantity(1);
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setExpectedRatePerKilo(new BigDecimal("100.00"));
        request.setParcels(List.of(p1));
        // expectedVolumetricDivisor omitted

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        assertTrue(json.has("fieldErrors") && json.get("fieldErrors").has("expectedVolumetricDivisor"));
    }

    @Test
    public void testRegistrationFailsWhenExpectedRatePerKiloStale() throws Exception {
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("2.0"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"));
        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientAddress("Manila");
        request.setRecipientContact("09180001111");
        request.setQuantity(1);
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setParcels(List.of(p1));
        request.setExpectedRatePerKilo(new BigDecimal("50.00")); // Configured is 100.00
        request.setExpectedVolumetricDivisor(5000);

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        assertEquals("STALE_SETTINGS", json.get("code").asText());
    }

    @Test
    public void testRegistrationFailsWhenExpectedVolumetricDivisorStale() throws Exception {
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("2.0"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"));
        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientAddress("Manila");
        request.setRecipientContact("09180001111");
        request.setQuantity(1);
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setParcels(List.of(p1));
        request.setExpectedRatePerKilo(new BigDecimal("100.00"));
        request.setExpectedVolumetricDivisor(6000); // Configured is 5000

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        assertEquals("STALE_SETTINGS", json.get("code").asText());
    }

    @Test
    public void testRegistrationFailsWhenCalculationExceedsStorageBounds() throws Exception {
        // 1000 units of 3000 x 1000 x 1000 cm = 3 billion cm3 per unit = 600,000 kg vol each.
        // Total volumetric weight = 600,000,000 kg. At rate 100.00 -> 60 billion PHP, exceeding DECIMAL(12,2) limit.
        List<ParcelUnitRequest> largeParcels = new java.util.ArrayList<>();
        for (int i = 1; i <= 1000; i++) {
            largeParcels.add(new ParcelUnitRequest(i, new BigDecimal("10.00"), new BigDecimal("3000"), new BigDecimal("1000"), new BigDecimal("1000")));
        }

        ShipmentRegistrationRequest overflowRequest = new ShipmentRegistrationRequest();
        overflowRequest.setClientId("CL-001");
        overflowRequest.setRecipientAddress("Manila");
        overflowRequest.setRecipientContact("09180001111");
        overflowRequest.setQuantity(1000);
        overflowRequest.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        overflowRequest.setExpectedRatePerKilo(new BigDecimal("100.00"));
        overflowRequest.setExpectedVolumetricDivisor(5000);
        overflowRequest.setParcels(largeParcels);

        long shipmentsBefore = shipmentRepository.count();

        mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overflowRequest)))
                .andExpect(status().isBadRequest());

        assertEquals(shipmentsBefore, shipmentRepository.count());
    }

    @Test
    public void testRecipientNameDerivedFromClientRecord() throws Exception {
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("2.0"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"));
        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001"); // Client name is "Acme Logistics Client"
        request.setRecipientName("Different Name Should Be Overridden");
        request.setRecipientAddress("Manila");
        request.setRecipientContact("09180001111");
        request.setQuantity(1);
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setExpectedRatePerKilo(new BigDecimal("100.00"));
        request.setExpectedVolumetricDivisor(5000);
        request.setParcels(List.of(p1));

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), ShipmentResponse.class);
        assertEquals("Acme Logistics Client", response.getRecipientName());

        Shipment persisted = shipmentRepository.findById(response.getShipmentId()).orElseThrow();
        assertEquals("Acme Logistics Client", persisted.getRecipientName());
    }

    @Test
    public void testBillableWeightCalculationActualVsVolumetric() throws Exception {
        // Case A: Actual Weight dominates (15 kg actual vs 0.20 kg volumetric)
        ParcelUnitRequest pActual = new ParcelUnitRequest(1, new BigDecimal("15.00"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"));
        ShipmentRegistrationRequest reqActual = new ShipmentRegistrationRequest();
        reqActual.setClientId("CL-001");
        reqActual.setRecipientAddress("Manila");
        reqActual.setRecipientContact("09180001111");
        reqActual.setQuantity(1);
        reqActual.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        reqActual.setExpectedRatePerKilo(new BigDecimal("100.00"));
        reqActual.setExpectedVolumetricDivisor(5000);
        reqActual.setParcels(List.of(pActual));

        MvcResult resActual = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqActual)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse actualResp = objectMapper.readValue(resActual.getResponse().getContentAsString(), ShipmentResponse.class);
        assertEquals(new BigDecimal("15.00"), actualResp.getTotalActualWeight());
        assertEquals(new BigDecimal("0.20"), actualResp.getTotalVolumetricWeight());
        assertEquals(new BigDecimal("15.00"), actualResp.getBillableWeight());
        assertEquals(new BigDecimal("1500.00"), actualResp.getShippingFee());

        // Case B: Volumetric Weight dominates (1 kg actual vs 20.00 kg volumetric: 50x50x40 / 5000 = 20)
        ParcelUnitRequest pVol = new ParcelUnitRequest(1, new BigDecimal("1.00"), new BigDecimal("50"), new BigDecimal("50"), new BigDecimal("40"));
        ShipmentRegistrationRequest reqVol = new ShipmentRegistrationRequest();
        reqVol.setClientId("CL-001");
        reqVol.setRecipientAddress("Manila");
        reqVol.setRecipientContact("09180001111");
        reqVol.setQuantity(1);
        reqVol.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        reqVol.setExpectedRatePerKilo(new BigDecimal("100.00"));
        reqVol.setExpectedVolumetricDivisor(5000);
        reqVol.setParcels(List.of(pVol));

        MvcResult resVol = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqVol)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse volResp = objectMapper.readValue(resVol.getResponse().getContentAsString(), ShipmentResponse.class);
        assertEquals(new BigDecimal("1.00"), volResp.getTotalActualWeight());
        assertEquals(new BigDecimal("20.00"), volResp.getTotalVolumetricWeight());
        assertEquals(new BigDecimal("20.00"), volResp.getBillableWeight());
        assertEquals(new BigDecimal("2000.00"), volResp.getShippingFee());
    }

    @Test
    public void testSettingChangeDoesNotAffectExistingShipmentSnapshot() throws Exception {
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("10.00"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"));
        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientAddress("Manila");
        request.setRecipientContact("09180001111");
        request.setQuantity(1);
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setExpectedRatePerKilo(new BigDecimal("100.00"));
        request.setExpectedVolumetricDivisor(5000);
        request.setParcels(List.of(p1));

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), ShipmentResponse.class);
        String shipmentId = response.getShipmentId();
        assertEquals(new BigDecimal("100.00"), response.getAppliedRatePerKilo());
        assertEquals(new BigDecimal("1000.00"), response.getTotalAmount());

        try {
            // Later settings change rate to 350.00
            jdbcTemplate.update("UPDATE system_setting SET rate_per_kilo = 350.00 WHERE setting_id = 1");
            systemSettingService.refreshCachedSettings();

            // Existing shipment detail must retain snapshot rate 100.00 and original total 1000.00
            MvcResult detailResult = mockMvc.perform(get("/api/v1/shipments/" + shipmentId)
                            .header("Authorization", officeToken))
                    .andExpect(status().isOk())
                    .andReturn();

            com.tnl.logistics.dto.ShipmentDetailResponse detail = objectMapper.readValue(
                    detailResult.getResponse().getContentAsString(), com.tnl.logistics.dto.ShipmentDetailResponse.class);
            assertEquals(new BigDecimal("100.00"), detail.getAppliedRatePerKilo());
            assertEquals(new BigDecimal("1000.00"), detail.getTotalAmount());
        } finally {
            jdbcTemplate.update("UPDATE system_setting SET rate_per_kilo = 100.00 WHERE setting_id = 1");
            systemSettingService.refreshCachedSettings();
        }
    }

    @Test
    public void testClientRateOverridesGlobalAndExistingShipmentKeepsSnapshot() throws Exception {
        Client client = clientRepository.findById("CL-001").orElseThrow();
        client.setRatePerKilo(new BigDecimal("75.00"));
        clientRepository.saveAndFlush(client);

        mockMvc.perform(get("/api/v1/shipments/calculation-settings")
                        .header("Authorization", officeToken)
                        .param("clientId", "CL-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ratePerKilo").value(75.00));

        ShipmentRegistrationRequest request = createMobileRegistrationRequest();
        request.setQuantity(1);
        request.setParcels(List.of(new ParcelUnitRequest(
                1,
                new BigDecimal("10.00"),
                new BigDecimal("10"),
                new BigDecimal("10"),
                new BigDecimal("10")
        )));
        request.setOtherCharges(BigDecimal.ZERO);
        request.setPaidAtRegistration(false);
        request.setExpectedRatePerKilo(new BigDecimal("75.00"));

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse response = objectMapper.readValue(
                result.getResponse().getContentAsString(), ShipmentResponse.class);
        assertEquals(0, new BigDecimal("75.00").compareTo(response.getAppliedRatePerKilo()));
        assertEquals(0, new BigDecimal("750.00").compareTo(response.getShippingFee()));
        assertEquals(0, new BigDecimal("750.00").compareTo(response.getTotalAmount()));

        client.setRatePerKilo(new BigDecimal("60.00"));
        clientRepository.saveAndFlush(client);

        mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_SETTINGS"));
        assertEquals(1, shipmentRepository.count());

        MvcResult detailResult = mockMvc.perform(get("/api/v1/shipments/" + response.getShipmentId())
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        ShipmentDetailResponse detail = objectMapper.readValue(
                detailResult.getResponse().getContentAsString(), ShipmentDetailResponse.class);
        assertEquals(0, new BigDecimal("75.00").compareTo(detail.getAppliedRatePerKilo()));
        assertEquals(0, new BigDecimal("750.00").compareTo(detail.getTotalAmount()));
    }

    @Test
    public void testClientRateWorksWhenGlobalRateIsNotConfigured() throws Exception {
        Client client = clientRepository.findById("CL-001").orElseThrow();
        client.setRatePerKilo(new BigDecimal("80.00"));
        clientRepository.saveAndFlush(client);

        jdbcTemplate.update("UPDATE system_setting SET rate_per_kilo = NULL WHERE setting_id = 1");
        systemSettingService.refreshCachedSettings();

        ShipmentRegistrationRequest request = createMobileRegistrationRequest();
        request.setExpectedRatePerKilo(new BigDecimal("80.00"));

        mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.appliedRatePerKilo").value(80.00));
    }
    @Test
    public void testAdminCanRegisterAndQueryShipments() throws Exception {
        ShipmentRegistrationRequest request = createMobileRegistrationRequest();
        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse created = objectMapper.readValue(
                result.getResponse().getContentAsString(), ShipmentResponse.class);

        mockMvc.perform(get("/api/v1/shipments")
                        .header("Authorization", adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/shipments/" + created.getShipmentId())
                        .header("Authorization", adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/parcel-units/" + created.getTrackingIds().get(0))
                        .header("Authorization", adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/shipments/calculation-settings")
                        .header("Authorization", adminToken)
                        .param("clientId", "CL-001"))
                .andExpect(status().isOk());
    }

    @Test
    public void testUnfilteredShipmentListingFastPathSelectionAndEquivalence() throws Exception {
        for (int i = 1; i <= 3; i++) {
            ShipmentRegistrationRequest request = createMobileRegistrationRequest();
            request.setRecipientAddress("Baguio Street " + i);
            mockMvc.perform(post("/api/v1/shipments")
                            .header("Authorization", officeToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated());
            Thread.sleep(5);
        }

        // 1. Fast path with completely absent/null query parameters
        MvcResult nullParamsResult = mockMvc.perform(get("/api/v1/shipments?page=0&size=10")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode nullParamsJson = objectMapper.readTree(nullParamsResult.getResponse().getContentAsString());
        assertEquals(3, getTotalElements(nullParamsJson));
        assertEquals(3, nullParamsJson.get("content").size());

        JsonNode firstShipment = nullParamsJson.get("content").get(0);
        assertTrue(firstShipment.has("shipmentId"));
        assertTrue(firstShipment.has("clientName"));
        assertEquals("Acme Logistics Client", firstShipment.get("clientName").asText());
        assertTrue(firstShipment.has("quantity"));
        assertEquals(2, firstShipment.get("quantity").asInt());

        // 2. Fast path with legitimately normalized-empty filters
        MvcResult normalizedEmptyResult = mockMvc.perform(get("/api/v1/shipments?page=0&size=10&search=   &status=ALL&paymentStatus=ALL&vehicleId=ALL&labelStatus=ALL")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode normalizedEmptyJson = objectMapper.readTree(normalizedEmptyResult.getResponse().getContentAsString());
        assertEquals(3, getTotalElements(normalizedEmptyJson));
        assertEquals(3, normalizedEmptyJson.get("content").size());

        // 3. Fast path with empty string parameters
        MvcResult emptyStringsResult = mockMvc.perform(get("/api/v1/shipments?page=0&size=10&search=&status=&paymentStatus=&vehicleId=&labelStatus=")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode emptyStringsJson = objectMapper.readTree(emptyStringsResult.getResponse().getContentAsString());
        assertEquals(3, getTotalElements(emptyStringsJson));
        assertEquals(3, emptyStringsJson.get("content").size());

        // 4. Exact equivalence between specialized query and filtered query in repository
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(
                0, 10, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "dateRegistered"));
        org.springframework.data.domain.Page<Shipment> fastPage = shipmentRepository.findAllShipmentsWithClient(pageable);
        org.springframework.data.domain.Page<Shipment> filterPage = shipmentRepository.searchShipmentsWithFilters(null, null, null, null, null, pageable);

        assertEquals(fastPage.getTotalElements(), filterPage.getTotalElements());
        assertEquals(fastPage.getContent().size(), filterPage.getContent().size());
        for (int i = 0; i < fastPage.getContent().size(); i++) {
            assertEquals(fastPage.getContent().get(i).getShipmentId(), filterPage.getContent().get(i).getShipmentId());
            assertEquals(fastPage.getContent().get(i).getClient().getName(), filterPage.getContent().get(i).getClient().getName());
        }
    }

    @Test
    public void testFilteredPathRetentionForIndividualAndCombinedFilters() throws Exception {
        Client alphaClient = clientRepository.findById("CL-ALPHA").orElseGet(() ->
                clientRepository.save(new Client("CL-ALPHA", "Alpha Logistics Client", "Manila", "09111111111", "alpha@client.com", ChargeModel.FLAT, true)));
        Client betaClient = clientRepository.findById("CL-BETA").orElseGet(() ->
                clientRepository.save(new Client("CL-BETA", "Beta Logistics Client", "Cebu", "09222222222", "beta@client.com", ChargeModel.FLAT, true)));

        ShipmentRegistrationRequest unpaidReq = createMobileRegistrationRequest();
        unpaidReq.setClientId(alphaClient.getClientId());
        unpaidReq.setPaidAtRegistration(false);
        mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(unpaidReq)))
                .andExpect(status().isCreated());

        ShipmentRegistrationRequest paidReq = createMobileRegistrationRequest();
        paidReq.setClientId(betaClient.getClientId());
        paidReq.setPaidAtRegistration(true);
        paidReq.setChargeModel(ChargeModel.PER_PARCEL);
        mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(paidReq)))
                .andExpect(status().isCreated());

        // Individual search filter
        MvcResult searchRes = mockMvc.perform(get("/api/v1/shipments?search=Alpha")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode searchJson = objectMapper.readTree(searchRes.getResponse().getContentAsString());
        assertEquals(1, getTotalElements(searchJson));
        assertEquals("Alpha Logistics Client", searchJson.get("content").get(0).get("recipientName").asText());

        // Individual status filter
        MvcResult statusRes = mockMvc.perform(get("/api/v1/shipments?status=QR_GENERATED")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode statusJson = objectMapper.readTree(statusRes.getResponse().getContentAsString());
        assertEquals(2, getTotalElements(statusJson));

        // Individual payment filter
        MvcResult paymentRes = mockMvc.perform(get("/api/v1/shipments?paymentStatus=PAID")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode paymentJson = objectMapper.readTree(paymentRes.getResponse().getContentAsString());
        assertEquals(1, getTotalElements(paymentJson));
        assertEquals("Beta Logistics Client", paymentJson.get("content").get(0).get("recipientName").asText());

        // Individual label filter
        MvcResult labelRes = mockMvc.perform(get("/api/v1/shipments?labelStatus=NEEDS_LABEL")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode labelJson = objectMapper.readTree(labelRes.getResponse().getContentAsString());
        assertEquals(2, getTotalElements(labelJson));

        // Combined filters
        MvcResult combinedRes = mockMvc.perform(get("/api/v1/shipments?search=Beta&paymentStatus=PAID")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode combinedJson = objectMapper.readTree(combinedRes.getResponse().getContentAsString());
        assertEquals(1, getTotalElements(combinedJson));
        assertEquals("Beta Logistics Client", combinedJson.get("content").get(0).get("recipientName").asText());

        // Non-matching filter combination
        MvcResult noMatchRes = mockMvc.perform(get("/api/v1/shipments?search=Beta&paymentStatus=UNPAID")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode noMatchJson = objectMapper.readTree(noMatchRes.getResponse().getContentAsString());
        assertEquals(0, getTotalElements(noMatchJson));
        assertEquals(0, noMatchJson.get("content").size());

        // Invalid filter value
        MvcResult invalidRes = mockMvc.perform(get("/api/v1/shipments?status=NON_EXISTENT_STATUS")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode invalidJson = objectMapper.readTree(invalidRes.getResponse().getContentAsString());
        assertEquals(0, getTotalElements(invalidJson));
        assertEquals(0, invalidJson.get("content").size());
    }

    @Test
    public void testUnfilteredShipmentPaginationEdgeCasesAndClamping() throws Exception {
        for (int i = 1; i <= 5; i++) {
            ShipmentRegistrationRequest req = createMobileRegistrationRequest();
            req.setRecipientAddress("Edge Case Street " + i);
            mockMvc.perform(post("/api/v1/shipments")
                            .header("Authorization", officeToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isCreated());
            Thread.sleep(5);
        }

        // Page 0 (size 2) -> first page
        MvcResult p0Res = mockMvc.perform(get("/api/v1/shipments?page=0&size=2")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode p0Json = objectMapper.readTree(p0Res.getResponse().getContentAsString());
        assertEquals(5, getTotalElements(p0Json));
        assertEquals(2, p0Json.get("content").size());
        int p0Number = p0Json.has("page") ? p0Json.get("page").get("number").asInt() : p0Json.get("number").asInt();
        int p0TotalPages = p0Json.has("page") ? p0Json.get("page").get("totalPages").asInt() : p0Json.get("totalPages").asInt();
        assertEquals(0, p0Number);
        assertEquals(3, p0TotalPages);

        // Page 1 (size 2) -> adjacent page
        MvcResult p1Res = mockMvc.perform(get("/api/v1/shipments?page=1&size=2")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode p1Json = objectMapper.readTree(p1Res.getResponse().getContentAsString());
        assertEquals(2, p1Json.get("content").size());
        int p1Number = p1Json.has("page") ? p1Json.get("page").get("number").asInt() : p1Json.get("number").asInt();
        assertEquals(1, p1Number);

        // Page 2 (size 2) -> final page with remainder 1
        MvcResult p2Res = mockMvc.perform(get("/api/v1/shipments?page=2&size=2")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode p2Json = objectMapper.readTree(p2Res.getResponse().getContentAsString());
        assertEquals(1, p2Json.get("content").size());
        int p2Number = p2Json.has("page") ? p2Json.get("page").get("number").asInt() : p2Json.get("number").asInt();
        assertEquals(2, p2Number);

        // Beyond-last page (page 10)
        MvcResult pBeyondRes = mockMvc.perform(get("/api/v1/shipments?page=10&size=2")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode pBeyondJson = objectMapper.readTree(pBeyondRes.getResponse().getContentAsString());
        assertEquals(5, getTotalElements(pBeyondJson));
        assertEquals(0, pBeyondJson.get("content").size());
        int pBeyondNumber = pBeyondJson.has("page") ? pBeyondJson.get("page").get("number").asInt() : pBeyondJson.get("number").asInt();
        assertEquals(10, pBeyondNumber);

        // Negative page clamped to 0
        MvcResult negPageRes = mockMvc.perform(get("/api/v1/shipments?page=-5&size=2")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode negPageJson = objectMapper.readTree(negPageRes.getResponse().getContentAsString());
        int negNumber = negPageJson.has("page") ? negPageJson.get("page").get("number").asInt() : negPageJson.get("number").asInt();
        assertEquals(0, negNumber);
        assertEquals(2, negPageJson.get("content").size());

        // Size clamping: size=0 clamped to 1
        MvcResult zeroSizeRes = mockMvc.perform(get("/api/v1/shipments?page=0&size=0")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode zeroSizeJson = objectMapper.readTree(zeroSizeRes.getResponse().getContentAsString());
        assertEquals(1, zeroSizeJson.get("content").size());
        int zeroSize = zeroSizeJson.has("page") ? zeroSizeJson.get("page").get("size").asInt() : zeroSizeJson.get("size").asInt();
        assertEquals(1, zeroSize);

        // Size clamping: size=500 clamped to MAX_PAGE_SIZE (100)
        MvcResult largeSizeRes = mockMvc.perform(get("/api/v1/shipments?page=0&size=500")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode largeSizeJson = objectMapper.readTree(largeSizeRes.getResponse().getContentAsString());
        int largeSize = largeSizeJson.has("page") ? largeSizeJson.get("page").get("size").asInt() : largeSizeJson.get("size").asInt();
        assertEquals(100, largeSize);
        assertEquals(5, largeSizeJson.get("content").size());
    }

    @Test
    public void testShipmentListingRoleAccessAndAuthorization() throws Exception {
        // ADMIN -> 200 OK
        mockMvc.perform(get("/api/v1/shipments")
                        .header("Authorization", adminToken))
                .andExpect(status().isOk());

        // RECEIVING_STAFF -> 200 OK
        mockMvc.perform(get("/api/v1/shipments")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk());

        // COURIER_STAFF -> 403 Forbidden
        mockMvc.perform(get("/api/v1/shipments")
                        .header("Authorization", fieldToken))
                .andExpect(status().isForbidden());

        // Unauthenticated -> 401 Unauthorized
        mockMvc.perform(get("/api/v1/shipments"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    public void testManualShippingFeeOverrideHonoredAndPreservesSnapshots() throws Exception {
        ShipmentRegistrationRequest request = createMobileRegistrationRequest();
        // Override shipping fee to 350.00 instead of calculated 1200.00
        request.setShippingFee(new BigDecimal("350.00"));
        request.setOtherCharges(new BigDecimal("50.00"));
        request.setPaidAtRegistration(false);

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), ShipmentResponse.class);
        assertEquals(new BigDecimal("350.00"), response.getShippingFee());
        assertEquals(new BigDecimal("50.00"), response.getOtherCharges());
        assertEquals(new BigDecimal("400.00"), response.getTotalAmount());
        assertFalse(response.getPaidAtRegistration());
        // Preserves calculated weight snapshots and active settings
        assertEquals(new BigDecimal("12.00"), response.getBillableWeight());
        assertEquals(new BigDecimal("100.00"), response.getAppliedRatePerKilo());
        assertEquals(5000, response.getAppliedVolumetricDivisor());

        Shipment persisted = shipmentRepository.findById(response.getShipmentId()).orElseThrow();
        assertEquals(new BigDecimal("350.00"), persisted.getShippingFee());
        assertEquals(new BigDecimal("50.00"), persisted.getOtherCharges());
        assertEquals(new BigDecimal("400.00"), persisted.getTotalAmount());
        assertFalse(persisted.getPaidAtRegistration());
    }

    @Test
    public void testZeroShippingFeeAndZeroTotalFreeShipment() throws Exception {
        ShipmentRegistrationRequest request = createMobileRegistrationRequest();
        request.setShippingFee(BigDecimal.ZERO);
        request.setOtherCharges(BigDecimal.ZERO);
        // Even if client sent paidAtRegistration = true, zero total must persist false with no Payment record
        request.setPaidAtRegistration(true);

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), ShipmentResponse.class);
        assertEquals(new BigDecimal("0.00"), response.getShippingFee());
        assertEquals(new BigDecimal("0.00"), response.getTotalAmount());
        assertFalse(response.getPaidAtRegistration());

        Shipment persisted = shipmentRepository.findById(response.getShipmentId()).orElseThrow();
        assertEquals(new BigDecimal("0.00"), persisted.getShippingFee());
        assertEquals(new BigDecimal("0.00"), persisted.getTotalAmount());
        assertFalse(persisted.getPaidAtRegistration());

        // Zero total creates no payment record
        List<Payment> payments = paymentRepository.findByShipment_ShipmentId(response.getShipmentId());
        assertTrue(payments.isEmpty());

        // Shows as Paid with zero balance because nothing is owed
        MvcResult detailResult = mockMvc.perform(get("/api/v1/shipments/" + response.getShipmentId())
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payment").value("Paid"))
                .andExpect(jsonPath("$.totalAmount").value(0.00))
                .andExpect(jsonPath("$.balance").value(0.00))
                .andReturn();

        // Summary listing also reflects Paid status
        mockMvc.perform(get("/api/v1/shipments?search=" + response.getShipmentId())
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].payment").value("Paid"))
                .andExpect(jsonPath("$.content[0].totalAmount").value(0.00))
                .andExpect(jsonPath("$.content[0].balance").value(0.00));
    }

    @Test
    public void testZeroShippingFeeWithNonZeroOtherChargesCreatesPaymentWhenPaid() throws Exception {
        ShipmentRegistrationRequest request = createMobileRegistrationRequest();
        request.setShippingFee(BigDecimal.ZERO);
        request.setOtherCharges(new BigDecimal("75.00"));
        request.setPaidAtRegistration(true);

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), ShipmentResponse.class);
        assertEquals(new BigDecimal("0.00"), response.getShippingFee());
        assertEquals(new BigDecimal("75.00"), response.getOtherCharges());
        assertEquals(new BigDecimal("75.00"), response.getTotalAmount());
        assertTrue(response.getPaidAtRegistration());

        List<Payment> payments = paymentRepository.findByShipment_ShipmentId(response.getShipmentId());
        assertEquals(1, payments.size());
        assertEquals(new BigDecimal("75.00"), payments.get(0).getAmountPaid());
    }

    @Test
    public void testManualShippingFeeRejectsMoreThanTwoDecimalPlaces() throws Exception {
        ShipmentRegistrationRequest request = createMobileRegistrationRequest();
        request.setShippingFee(new BigDecimal("125.456"));

        mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    public void testManualShippingFeeStillRequiresValidAndFreshCalculationSettings() throws Exception {
        ShipmentRegistrationRequest request = createMobileRegistrationRequest();
        request.setShippingFee(new BigDecimal("500.00"));
        // Stale expected rate per kilo must still trigger 409 CONFLICT
        request.setExpectedRatePerKilo(new BigDecimal("999.00"));

        mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_SETTINGS"));
    }
}
