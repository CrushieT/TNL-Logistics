package com.tnl.logistics.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.ParcelUnitRequest;
import com.tnl.logistics.dto.ShipmentRegistrationRequest;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
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
import org.springframework.transaction.annotation.Propagation;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class SplitWaybillIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired ClientRepository clientRepository;
    @Autowired ParcelUnitRepository parcelUnitRepository;
    @Autowired WaybillRepository waybillRepository;
    @Autowired TrackingEventRepository trackingEventRepository;
    @Autowired PaymentRepository paymentRepository;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Autowired com.tnl.logistics.service.SystemSettingService systemSettingService;
    @Autowired com.tnl.logistics.service.WaybillService waybillService;

    @BeforeEach
    void setup() {
        cleanupWaybillClientShipments();
        jdbcTemplate.update("UPDATE system_setting SET rate_per_kilo = 100.00 WHERE setting_id = 1");
        systemSettingService.refreshCachedSettings();
        Client client = clientRepository.findById("CL-001").orElseThrow();
        client.setActive(true);
        clientRepository.save(client);
    }

    @AfterEach
    void tearDown() {
        cleanupWaybillClientShipments();
    }

    private void cleanupWaybillClientShipments() {
        List<String> leftovers = jdbcTemplate.queryForList(
                "SELECT shipment_id FROM shipment WHERE recipient_name = 'Waybill Client'", String.class);
        for (String shipmentId : leftovers) {
            jdbcTemplate.update("DELETE FROM tracking_event WHERE tracking_id IN (SELECT tracking_id FROM parcel_unit WHERE shipment_id = ?)", shipmentId);
            jdbcTemplate.update("DELETE FROM waybill_return_scan WHERE waybill_id IN (SELECT waybill_id FROM waybill WHERE shipment_id = ?)", shipmentId);
            jdbcTemplate.update("UPDATE parcel_unit SET waybill_id = NULL WHERE shipment_id = ?", shipmentId);
            jdbcTemplate.update("DELETE FROM waybill WHERE shipment_id = ?", shipmentId);
            jdbcTemplate.update("DELETE FROM parcel_unit WHERE shipment_id = ?", shipmentId);
            jdbcTemplate.update("DELETE FROM payment WHERE shipment_id = ?", shipmentId);
            jdbcTemplate.update("DELETE FROM shipment WHERE shipment_id = ?", shipmentId);
        }
    }

    @Test
    void fiveOfTenWaybillsCompleteIndependently() throws Exception {
        String shipmentId = register(10);
        List<ParcelUnit> units = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId);
        List<LabelStatus> labelStatuses = units.stream().map(ParcelUnit::getLabelStatus).toList();
        int paymentCount = paymentRepository.findByShipment_ShipmentId(shipmentId).size();
        arrive(units);
        List<String> first = ids(units.subList(0, 5));
        List<String> last = ids(units.subList(5, 10));
        first.forEach(this::load);
        String key = UUID.randomUUID().toString();
        String waybillA = generate(shipmentId, first, key);
        assertEquals(waybillA, generate(shipmentId, first, key));
        last.forEach(this::load);
        String waybillB = generate(shipmentId, last, UUID.randomUUID().toString());
        assertNotEquals(waybillA, waybillB);
        mockMvc.perform(get("/api/v1/waybills/shipments/" + shipmentId).with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
        send(waybillA);
        complete(waybillA, null, "USR-HAULER2");
        mockMvc.perform(get("/api/v1/shipments/" + shipmentId).with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.statusRollup").value("5 / 10 Completed"))
                .andExpect(jsonPath("$.status").value("Partially Completed"));
        for (String id : last) assertEquals(ParcelStatus.LOADED_TO_HAULER,
                parcelUnitRepository.findById(id).orElseThrow().getCurrentStatus());
        send(waybillB);
        complete(waybillB, "Client Signatory", "USR-HAULER");
        mockMvc.perform(get("/api/v1/shipments/" + shipmentId).with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.statusRollup").value("10 / 10 Completed"));
        for (String id : first) assertEquals(1, trackingEventRepository
                .findByParcelUnit_TrackingIdOrderByEventTimestampAsc(id).stream()
                .filter(event -> event.getStatus() == ParcelStatus.COMPLETED).count());
        assertEquals("Signed waybill " + waybillA + " completed", trackingEventRepository
                .findByParcelUnit_TrackingIdOrderByEventTimestampAsc(first.get(0)).stream()
                .filter(event -> event.getStatus() == ParcelStatus.COMPLETED).findFirst().orElseThrow().getRemarks());
        assertEquals("Signed waybill " + waybillB + " by Client Signatory", trackingEventRepository
                .findByParcelUnit_TrackingIdOrderByEventTimestampAsc(last.get(0)).stream()
                .filter(event -> event.getStatus() == ParcelStatus.COMPLETED).findFirst().orElseThrow().getRemarks());
        assertEquals(labelStatuses, parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId)
                .stream().map(ParcelUnit::getLabelStatus).toList());
        assertEquals(paymentCount, paymentRepository.findByShipment_ShipmentId(shipmentId).size());
    }

    @Test
    void invalidGenerationRollsBackAndMembershipIsExclusive() throws Exception {
        String shipmentId = register(2);
        String otherShipment = register(1);
        List<ParcelUnit> units = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId);
        ParcelUnit other = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(otherShipment).get(0);
        arrive(units);
        arrive(List.of(other));
        load(units.get(0).getTrackingId());
        load(other.getTrackingId());
        String id = units.get(0).getTrackingId();
        mockMvc.perform(post("/api/v1/waybills/generate").with(user("USR-HAULER").roles("FIELD_STAFF"))
                .contentType(MediaType.APPLICATION_JSON).content(generation(shipmentId,
                        List.of(id, other.getTrackingId()), UUID.randomUUID().toString())))
                .andExpect(status().isBadRequest());
        assertTrue(waybillRepository.findByShipment_ShipmentIdOrderByGeneratedAtDesc(shipmentId).isEmpty());
        String usedKey = UUID.randomUUID().toString();
        String number = generate(shipmentId, List.of(id), usedKey);
        mockMvc.perform(post("/api/v1/waybills/generate").with(user("USR-HAULER").roles("FIELD_STAFF"))
                .contentType(MediaType.APPLICATION_JSON).content(generation(shipmentId,
                        List.of(id), UUID.randomUUID().toString())))
                .andExpect(status().isBadRequest());
        assertEquals(number, parcelUnitRepository.findById(id).orElseThrow().getWaybill().getWaybillId());
        mockMvc.perform(post("/api/v1/waybills/generate").with(user("USR-HAULER").roles("FIELD_STAFF"))
                .contentType(MediaType.APPLICATION_JSON).content(generation(otherShipment,
                        List.of(other.getTrackingId()), usedKey)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void completionRequiresMatchingWaybillConfirmationAndBlocksGenericScan() throws Exception {
        String shipmentId = register(2);
        List<ParcelUnit> units = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId);
        arrive(units);
        List<String> ids = ids(units);
        ids.forEach(this::load);
        String number = generate(shipmentId, ids, UUID.randomUUID().toString());
        send(number);
        mockMvc.perform(post("/api/v1/waybills/" + number + "/complete").with(user("USR-HAULER").roles("FIELD_STAFF"))
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(
                        Map.of("signedBy", "Signer"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Waybill completion is not permitted."));
        mockMvc.perform(post("/api/v1/waybills/" + number + "/complete").with(user("USR-HAULER").roles("FIELD_STAFF"))
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(
                        Map.of("confirmedWaybillId", "WYB-2026-9999", "signedBy", "Signer"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Waybill completion is not permitted."));
        mockMvc.perform(post("/api/v1/tracking-events/scan").with(user("USR-HAULER").roles("FIELD_STAFF"))
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(
                        Map.of("trackingId", ids.get(0), "targetStatus", "COMPLETED"))))
                .andExpect(status().isBadRequest());
        complete(number, "Signer", "USR-HAULER");
        complete(number, "Signer", "USR-HAULER");
        mockMvc.perform(get("/api/v1/waybills/" + number)
                .with(user("USR-HAULER").roles("FIELD_STAFF")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scannedTrackingIds").doesNotExist());
        assertEquals(1, trackingEventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(ids.get(0))
                .stream().filter(event -> event.getStatus() == ParcelStatus.COMPLETED).count());
    }

    @Test
    void completionRejectsUnknownOrUnsentWaybillsAndRetiredReturnScanRoute() throws Exception {
        String shipmentId = register(1);
        ParcelUnit unit = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId).get(0);
        arrive(List.of(unit));
        load(unit.getTrackingId());
        String waybillId = generate(shipmentId, List.of(unit.getTrackingId()), UUID.randomUUID().toString());

        mockMvc.perform(post("/api/v1/waybills/" + waybillId + "/complete")
                .with(user("USR-HAULER").roles("FIELD_STAFF"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("confirmedWaybillId", waybillId))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Waybill completion is not permitted."));

        String unknownWaybillId = "WYB-2026-9999";
        mockMvc.perform(post("/api/v1/waybills/" + unknownWaybillId + "/complete")
                .with(user("USR-HAULER").roles("FIELD_STAFF"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("confirmedWaybillId", unknownWaybillId))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Waybill completion is not permitted."));

        mockMvc.perform(post("/api/v1/waybills/" + waybillId + "/return-scans")
                .with(user("USR-HAULER").roles("FIELD_STAFF"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("trackingId", unit.getTrackingId()))))
                .andExpect(status().isNotFound());
    }

    @Test
    void completionValidatesAllManifestUnitsBeforeMutation() throws Exception {
        String shipmentId = register(2);
        List<ParcelUnit> units = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId);
        arrive(units);
        List<String> trackingIds = ids(units);
        trackingIds.forEach(this::load);
        String waybillId = generate(shipmentId, trackingIds, UUID.randomUUID().toString());
        send(waybillId);

        ParcelUnit invalidUnit = parcelUnitRepository.findById(trackingIds.get(1)).orElseThrow();
        invalidUnit.setCurrentStatus(ParcelStatus.ARRIVED_AT_TNL);
        parcelUnitRepository.saveAndFlush(invalidUnit);

        mockMvc.perform(post("/api/v1/waybills/" + waybillId + "/complete")
                .with(user("USR-HAULER").roles("FIELD_STAFF"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("confirmedWaybillId", waybillId))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Waybill completion is not permitted."));

        assertEquals(ParcelStatus.LOADED_TO_HAULER,
                parcelUnitRepository.findById(trackingIds.get(0)).orElseThrow().getCurrentStatus());
        assertEquals(0, trackingEventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(trackingIds.get(0))
                .stream().filter(event -> event.getStatus() == ParcelStatus.COMPLETED).count());
        assertEquals(WaybillStatus.SENT_TO_HAULER, waybillRepository.findById(waybillId).orElseThrow().getStatus());
    }

    @Test
    void onlyHaulerStaffMayGenerate() throws Exception {
        String shipmentId = register(1);
        ParcelUnit unit = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId).get(0);
        unit.setCurrentStatus(ParcelStatus.LOADED_TO_HAULER);
        parcelUnitRepository.save(unit);
        String body = generation(shipmentId, List.of(unit.getTrackingId()), UUID.randomUUID().toString());
        mockMvc.perform(post("/api/v1/waybills/generate").with(user("USR-ADMIN").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/waybills/generate").with(user("USR-FIELD").roles("FIELD_STAFF"))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        String waybillId = generate(shipmentId, List.of(unit.getTrackingId()), UUID.randomUUID().toString());
        mockMvc.perform(post("/api/v1/waybills/" + waybillId + "/send")
                .with(user("USR-FIELD").roles("FIELD_STAFF"))).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/waybills/" + waybillId + "/complete")
                .with(user("USR-FIELD").roles("FIELD_STAFF"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("confirmedWaybillId", waybillId,
                        "signedBy", "Signer"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/waybills/" + waybillId + "/complete")
                .with(user("USR-ADMIN").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("confirmedWaybillId", waybillId))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/waybills/" + waybillId + "/complete")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("confirmedWaybillId", waybillId))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentGenerationCannotAssignOneUnitTwice() throws Exception {
        String shipmentId = register(1);
        ParcelUnit unit = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId).get(0);
        arrive(List.of(unit));
        load(unit.getTrackingId());

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            List<Future<String>> attempts = new ArrayList<>();
            for (int attempt = 0; attempt < 2; attempt++) {
                attempts.add(executor.submit(() -> {
                    com.tnl.logistics.dto.WaybillGenerationRequest request = new com.tnl.logistics.dto.WaybillGenerationRequest();
                    request.setShipmentId(shipmentId);
                    request.setTrackingIds(List.of(unit.getTrackingId()));
                    request.setIdempotencyKey(UUID.randomUUID().toString());
                    start.await();
                    try {
                        return waybillService.generate(request, "USR-HAULER").getWaybillId();
                    } catch (IllegalStateException exception) {
                        return null;
                    }
                }));
            }
            start.countDown();
            List<String> created = new ArrayList<>();
            for (Future<String> attempt : attempts) {
                String waybillId = attempt.get();
                if (waybillId != null) created.add(waybillId);
            }
            assertEquals(1, created.size());
            assertEquals(1, waybillRepository.findByShipment_ShipmentIdOrderByGeneratedAtDesc(shipmentId).size());
            assertEquals(created.get(0), parcelUnitRepository.findById(unit.getTrackingId())
                    .orElseThrow().getWaybill().getWaybillId());
        } finally {
            executor.shutdownNow();
            if (shipmentId != null) {
                jdbcTemplate.update("DELETE FROM tracking_event WHERE tracking_id IN (SELECT tracking_id FROM parcel_unit WHERE shipment_id = ?)", shipmentId);
                jdbcTemplate.update("DELETE FROM waybill_return_scan WHERE waybill_id IN (SELECT waybill_id FROM waybill WHERE shipment_id = ?)", shipmentId);
                jdbcTemplate.update("UPDATE parcel_unit SET waybill_id = NULL WHERE shipment_id = ?", shipmentId);
                jdbcTemplate.update("DELETE FROM waybill WHERE shipment_id = ?", shipmentId);
                jdbcTemplate.update("DELETE FROM parcel_unit WHERE shipment_id = ?", shipmentId);
                jdbcTemplate.update("DELETE FROM payment WHERE shipment_id = ?", shipmentId);
                jdbcTemplate.update("DELETE FROM shipment WHERE shipment_id = ?", shipmentId);
            }
        }
    }

    private String register(int count) throws Exception {
        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientName("Waybill Client");
        request.setRecipientAddress("Baguio City");
        request.setRecipientContact("09170000000");
        request.setChargeModel(ChargeModel.FLAT);
        request.setShippingFee(new BigDecimal("500.00"));
        request.setQuantity(count);
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setExpectedRatePerKilo(new BigDecimal("100.00"));
        request.setExpectedVolumetricDivisor(5000);
        List<ParcelUnitRequest> parcels = new ArrayList<>();
        for (int index = 1; index <= count; index++) parcels.add(new ParcelUnitRequest(index,
                new BigDecimal("2.5"), new BigDecimal("20"), new BigDecimal("20"), new BigDecimal("20")));
        request.setParcels(parcels);
        MvcResult result = mockMvc.perform(post("/api/v1/shipments").with(user("USR-ADMIN").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("shipmentId").asText();
    }

    private void arrive(List<ParcelUnit> units) {
        for (ParcelUnit unit : units) unit.setCurrentStatus(ParcelStatus.ARRIVED_AT_TNL);
        parcelUnitRepository.saveAll(units);
    }

    private List<String> ids(List<ParcelUnit> units) { return units.stream().map(ParcelUnit::getTrackingId).toList(); }

    private void load(String trackingId) {
        try {
            mockMvc.perform(post("/api/v1/tracking-events/scan").with(user("USR-HAULER").roles("FIELD_STAFF"))
                    .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(
                            Map.of("trackingId", trackingId, "targetStatus", "LOADED_TO_HAULER"))))
                    .andExpect(status().isOk());
        } catch (Exception exception) { throw new RuntimeException(exception); }
    }

    private String generation(String shipmentId, List<String> ids, String key) throws Exception {
        return objectMapper.writeValueAsString(Map.of("shipmentId", shipmentId, "trackingIds", ids, "idempotencyKey", key));
    }

    private String generate(String shipmentId, List<String> ids, String key) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/waybills/generate")
                .with(user("USR-HAULER").roles("FIELD_STAFF")).contentType(MediaType.APPLICATION_JSON)
                .content(generation(shipmentId, ids, key)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.parcels.length()").value(ids.size())).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("waybillId").asText();
    }

    private void send(String number) throws Exception {
        mockMvc.perform(post("/api/v1/waybills/" + number + "/send")
                .with(user("USR-HAULER").roles("FIELD_STAFF")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("SENT_TO_HAULER"));
    }

    private void complete(String number, String signatory, String actor) throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("confirmedWaybillId", number);
        if (signatory != null) {
            payload.put("signedBy", signatory);
        }
        mockMvc.perform(post("/api/v1/waybills/" + number + "/complete")
                .with(user(actor).roles("FIELD_STAFF")).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("SIGNED_COMPLETED"));
    }
}
