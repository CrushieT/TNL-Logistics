package com.tnl.logistics.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.*;
import com.tnl.logistics.service.SystemSettingService;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ParcelLossIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired SystemSettingService settings;
    private final List<String> shipmentIds = new ArrayList<>();
    private final List<String> vehicleIds = new ArrayList<>();

    @BeforeEach void setPricing() {
        jdbc.update("UPDATE system_setting SET rate_per_kilo = 100.00 WHERE setting_id = 1");
        settings.refreshCachedSettings();
        jdbc.update("UPDATE client SET active = TRUE WHERE client_id = 'CL-001'");
    }

    @AfterEach void cleanup() {
        for (String shipmentId : shipmentIds) {
            jdbc.update("DELETE FROM parcel_exception_command WHERE target_id IN (SELECT tracking_id FROM parcel_unit WHERE shipment_id = ?) OR target_id IN (SELECT waybill_id FROM waybill WHERE shipment_id = ?)", shipmentId, shipmentId);
            jdbc.update("DELETE FROM parcel_loss_event WHERE tracking_id IN (SELECT tracking_id FROM parcel_unit WHERE shipment_id = ?)", shipmentId);
            jdbc.update("DELETE FROM waybill_reconciliation_event WHERE waybill_id IN (SELECT waybill_id FROM waybill WHERE shipment_id = ?)", shipmentId);
            jdbc.update("DELETE FROM tracking_event WHERE tracking_id IN (SELECT tracking_id FROM parcel_unit WHERE shipment_id = ?)", shipmentId);
            jdbc.update("DELETE FROM waybill_return_scan WHERE waybill_id IN (SELECT waybill_id FROM waybill WHERE shipment_id = ?)", shipmentId);
            jdbc.update("UPDATE parcel_unit SET waybill_id = NULL WHERE shipment_id = ?", shipmentId);
            jdbc.update("DELETE FROM waybill WHERE shipment_id = ?", shipmentId);
            jdbc.update("DELETE FROM parcel_unit WHERE shipment_id = ?", shipmentId);
            jdbc.update("DELETE FROM payment WHERE shipment_id = ?", shipmentId);
            jdbc.update("DELETE FROM shipment WHERE shipment_id = ?", shipmentId);
        }
        for (String vehicleId : vehicleIds) jdbc.update("DELETE FROM vehicle WHERE vehicle_id = ?", vehicleId);
    }

    @ParameterizedTest @EnumSource(value = ParcelStatus.class, names = "COMPLETED", mode = EnumSource.Mode.EXCLUDE)
    void lossRecoveryPreservesEveryUnfinishedPosition(ParcelStatus position) throws Exception {
        Fixture fixture = create(1, position);
        String trackingId = fixture.ids().get(0);
        Map<String, Object> before = jdbc.queryForMap("SELECT current_status, current_vehicle_id, label_status, reprint_count FROM parcel_unit WHERE tracking_id = ?", trackingId);
        BigDecimal total = jdbc.queryForObject("SELECT total_amount FROM shipment WHERE shipment_id = ?", BigDecimal.class, fixture.shipmentId());
        long revision = revision(trackingId);
        String requestId = UUID.randomUUID().toString();
        command(trackingId, "lost", "  Missing at hub  ", revision, requestId).andExpect(status().isOk())
                .andExpect(jsonPath("$.lost").value(true)).andExpect(jsonPath("$.lossHistory[0].reason").value("Missing at hub"));
        command(trackingId, "lost", "Missing at hub", revision, requestId).andExpect(status().isOk());
        command(trackingId, "lost", "Different", revision, requestId).andExpect(status().isConflict());
        command(trackingId, "found", "Recovered", revision, UUID.randomUUID().toString()).andExpect(status().isConflict());
        command(trackingId, "found", "Recovered", revision(trackingId), UUID.randomUUID().toString()).andExpect(status().isOk())
                .andExpect(jsonPath("$.lost").value(false)).andExpect(jsonPath("$.lossHistory.length()").value(2));
        assertEquals(before, jdbc.queryForMap("SELECT current_status, current_vehicle_id, label_status, reprint_count FROM parcel_unit WHERE tracking_id = ?", trackingId));
        assertEquals(total, jdbc.queryForObject("SELECT total_amount FROM shipment WHERE shipment_id = ?", BigDecimal.class, fixture.shipmentId()));
        assertEquals(0, deliveryEvents(fixture));
        command(trackingId, "lost", "Missing again", revision(trackingId), UUID.randomUUID().toString()).andExpect(status().isOk());
        assertEquals(3, jdbc.queryForObject("SELECT COUNT(*) FROM parcel_loss_event WHERE tracking_id = ?", Integer.class, trackingId));
    }

    @Test void validatesAuthorizationReasonsIdsAndDeliveredState() throws Exception {
        Fixture fixture = create(1, ParcelStatus.COMPLETED);
        String trackingId = fixture.ids().get(0);
        command(trackingId, "lost", "Missing", revision(trackingId), UUID.randomUUID().toString()).andExpect(status().isConflict());
        for (String reason : List.of("", "   ", "x".repeat(256))) {
            command(trackingId, "lost", reason, revision(trackingId), UUID.randomUUID().toString()).andExpect(status().isBadRequest());
        }
        for (String payload : List.of("{}", "{\"reason\":\"Missing\",\"expectedRevision\":-1,\"requestId\":\"test\"}",
                "{\"reason\":\"Missing\",\"expectedRevision\":0,\"requestId\":\"invalid id\"}")) {
            mvc.perform(post("/api/v1/parcel-units/" + trackingId + "/lost").with(user("USR-ADMIN").roles("ADMIN"))
                    .contentType(MediaType.APPLICATION_JSON).content(payload)).andExpect(status().isBadRequest());
        }
        command("MISSING", "lost", "Missing", 0, UUID.randomUUID().toString()).andExpect(status().isNotFound());
        for (String role : List.of("RECEIVING_STAFF", "COURIER_STAFF", "DISPATCH_STAFF")) {
            mvc.perform(post("/api/v1/parcel-units/" + trackingId + "/lost").with(user("USR-OFFICE").roles(role))
                    .contentType(MediaType.APPLICATION_JSON).content(body("Missing", 0, UUID.randomUUID().toString())))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(post("/api/v1/parcel-units/" + trackingId + "/lost").with(user("USR-OFFICE").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content(body("Missing", 0, UUID.randomUUID().toString())))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/parcel-units/" + trackingId + "/lost").contentType(MediaType.APPLICATION_JSON)
                .content(body("Missing", 0, UUID.randomUUID().toString()))).andExpect(status().isUnauthorized());
    }

    @Test void lostParcelBlocksSingleBatchGenerationAndLeaksNoReasonToScanner() throws Exception {
        Fixture fixture = create(2, ParcelStatus.ARRIVED_AT_TNL);
        String lostId = fixture.ids().get(1);
        command(lostId, "lost", "PRIVATE REASON", revision(lostId), UUID.randomUUID().toString()).andExpect(status().isOk());
        mvc.perform(get("/api/v1/tracking-events/scan-context/" + lostId).with(user("USR-HAULER").roles("DISPATCH_STAFF")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.canScan").value(false))
                .andExpect(jsonPath("$.scanBlockedReason").exists()).andExpect(jsonPath("$.lossHistory").doesNotExist());
        scan(lostId, "LOADED_TO_HAULER").andExpect(status().isConflict());
        mvc.perform(post("/api/v1/tracking-events/batch-scan").with(user("USR-HAULER").roles("DISPATCH_STAFF"))
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("trackingIds", fixture.ids(), "targetStatus", "LOADED_TO_HAULER"))))
                .andExpect(status().isConflict());
        assertEquals("ARRIVED_AT_TNL", parcelStatus(fixture.ids().get(0)));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM tracking_event WHERE tracking_id = ? AND status = 'LOADED_TO_HAULER'", Integer.class, fixture.ids().get(0)));
        jdbc.update("UPDATE parcel_unit SET current_status = 'LOADED_TO_HAULER' WHERE shipment_id = ?", fixture.shipmentId());
        generateRequest(fixture).andExpect(status().isBadRequest());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM waybill WHERE shipment_id = ?", Integer.class, fixture.shipmentId()));
    }

    @Test void mixedClosurePreservesFiveMembersAndExactlyFourDeliveryEventsThenReopens() throws Exception {
        Fixture fixture = create(5, ParcelStatus.LOADED_TO_HAULER);
        String waybillId = generate(fixture);
        send(waybillId).andExpect(status().isOk());
        String lostId = fixture.ids().get(4);
        command(lostId, "lost", "Missing", revision(lostId), UUID.randomUUID().toString()).andExpect(status().isOk());
        complete(waybillId, null).andExpect(status().isConflict());
        complete(waybillId, 0L).andExpect(status().isConflict());
        complete(waybillId, manifestRevision(waybillId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.statusLabel").value("Closed with Loss"))
                .andExpect(jsonPath("$.parcels.length()").value(5)).andExpect(jsonPath("$.deliveredCount").value(4)).andExpect(jsonPath("$.lostCount").value(1));
        mvc.perform(get("/api/v1/shipments/" + fixture.shipmentId()).with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.waybillStatus").value("Waybill: Closed with Loss"));
        complete(waybillId, manifestRevision(waybillId)).andExpect(status().isOk());
        assertEquals(4, deliveryEvents(fixture));
        assertEquals("LOADED_TO_HAULER", parcelStatus(lostId));
        command(lostId, "found", "Recovered", revision(lostId), UUID.randomUUID().toString()).andExpect(status().isOk());
        assertEquals("SENT_TO_HAULER", waybillStatus(waybillId));
        assertEquals(4, deliveryEvents(fixture));
        complete(waybillId, 1L).andExpect(status().isConflict());
        complete(waybillId, manifestRevision(waybillId)).andExpect(status().isOk()).andExpect(jsonPath("$.deliveredCount").value(5));
        assertEquals(5, deliveryEvents(fixture));
        mvc.perform(get("/api/v1/waybills/" + waybillId + "/reconciliation-history").with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3)).andExpect(jsonPath("$[0].signedBy").value("Test Signatory"));
        mvc.perform(get("/api/v1/waybills/" + waybillId + "/reconciliation-history").with(user("USR-HAULER").roles("DISPATCH_STAFF")))
                .andExpect(status().isForbidden());
    }

    @Test void generatedAllLostRequiresExplicitAdminClosureAndReopensToGenerated() throws Exception {
        Fixture fixture = create(2, ParcelStatus.LOADED_TO_HAULER);
        String waybillId = generate(fixture);
        for (String trackingId : fixture.ids()) command(trackingId, "lost", "Missing", revision(trackingId), UUID.randomUUID().toString()).andExpect(status().isOk());
        assertEquals("GENERATED", waybillStatus(waybillId));
        send(waybillId).andExpect(status().isBadRequest());
        String requestId = UUID.randomUUID().toString();
        long manifestRevision = manifestRevision(waybillId);
        close(waybillId, manifestRevision, requestId).andExpect(status().isOk()).andExpect(jsonPath("$.reconciliationOutcome").value("ALL_LOST"))
                .andExpect(jsonPath("$.signedBy").isEmpty()).andExpect(jsonPath("$.signedAt").isEmpty());
        close(waybillId, manifestRevision, requestId).andExpect(status().isOk());
        assertEquals(0, deliveryEvents(fixture));
        String trackingId = fixture.ids().get(0);
        command(trackingId, "found", "Recovered", revision(trackingId), UUID.randomUUID().toString()).andExpect(status().isOk());
        assertEquals("GENERATED", waybillStatus(waybillId));
        send(waybillId).andExpect(status().isOk());
        complete(waybillId, manifestRevision(waybillId)).andExpect(status().isOk()).andExpect(jsonPath("$.deliveredCount").value(1));
    }

    @Test void rejectsCrossRecordReplaysAndNonAllLostClosure() throws Exception {
        Fixture fixture = create(2, ParcelStatus.LOADED_TO_HAULER);
        String waybillId = generate(fixture);
        String requestId = UUID.randomUUID().toString();
        String first = fixture.ids().get(0);
        command(first, "lost", "Missing", revision(first), requestId).andExpect(status().isOk());
        command(fixture.ids().get(1), "lost", "Missing", revision(fixture.ids().get(1)), requestId).andExpect(status().isConflict());
        close(waybillId, manifestRevision(waybillId), requestId).andExpect(status().isConflict());
        close(waybillId, manifestRevision(waybillId), UUID.randomUUID().toString()).andExpect(status().isConflict());
        assertEquals("GENERATED", waybillStatus(waybillId));
    }

    @Test void missingRecordsKeepLegacyScanAndSendContracts() throws Exception {
        scan("TRK-MISSING", "LOADED_TO_HAULER").andExpect(status().isBadRequest());
        send("WYB-2026-9999").andExpect(status().isBadRequest());
        close("WYB-2026-9999", 0, UUID.randomUUID().toString()).andExpect(status().isNotFound());
    }

    @Test void foundAndAllLostClosureAreAdminOnlyAndReasonBoundaryIsInclusive() throws Exception {
        Fixture fixture = create(1, ParcelStatus.LOADED_TO_HAULER);
        String waybillId = generate(fixture);
        String trackingId = fixture.ids().get(0);
        String requestId = UUID.randomUUID().toString();
        long revision = revision(trackingId);
        command(trackingId, "lost", "x".repeat(255), revision, requestId).andExpect(status().isOk());
        command(trackingId, "lost", "Again", revision(trackingId), UUID.randomUUID().toString()).andExpect(status().isConflict());
        for (String role : List.of("RECEIVING_STAFF", "COURIER_STAFF", "DISPATCH_STAFF")) {
            mvc.perform(post("/api/v1/parcel-units/" + trackingId + "/found").with(user("USR-OFFICE").roles(role))
                    .contentType(MediaType.APPLICATION_JSON).content(body("Recovered", revision(trackingId), UUID.randomUUID().toString())))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/waybills/" + waybillId + "/close-all-lost").with(user("USR-OFFICE").roles(role))
                    .contentType(MediaType.APPLICATION_JSON).content(body("All missing", manifestRevision(waybillId), UUID.randomUUID().toString())))
                    .andExpect(status().isForbidden());
        }
    }

    @Test void dispatchedAllLostClosureReopensToSentWithoutDeliveryEvents() throws Exception {
        Fixture fixture = create(1, ParcelStatus.LOADED_TO_HAULER);
        String waybillId = generate(fixture);
        send(waybillId).andExpect(status().isOk());
        String trackingId = fixture.ids().get(0);
        command(trackingId, "lost", "Missing", revision(trackingId), UUID.randomUUID().toString()).andExpect(status().isOk());
        complete(waybillId, manifestRevision(waybillId)).andExpect(status().isBadRequest());
        close(waybillId, manifestRevision(waybillId), UUID.randomUUID().toString()).andExpect(status().isOk());
        command(trackingId, "found", "Recovered", revision(trackingId), UUID.randomUUID().toString()).andExpect(status().isOk());
        assertEquals("SENT_TO_HAULER", waybillStatus(waybillId));
        assertEquals(0, deliveryEvents(fixture));
        assertEquals("SENT_TO_HAULER", jdbc.queryForObject("SELECT custody_state FROM waybill_reconciliation_event WHERE waybill_id = ? AND action = 'CLOSED'", String.class, waybillId));
    }

    @Test void simultaneousIdenticalCommandsAppendOneLossEvent() throws Exception {
        Fixture fixture = create(1, ParcelStatus.ARRIVED_AT_TNL);
        String trackingId = fixture.ids().get(0);
        long revision = revision(trackingId);
        String requestId = UUID.randomUUID().toString();
        Callable<Integer> request = () -> command(trackingId, "lost", "Missing", revision, requestId).andReturn().getResponse().getStatus();
        assertEquals(List.of(200, 200), race(request, request));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM parcel_loss_event WHERE tracking_id = ?", Integer.class, trackingId));
    }

    @Test void lostCargoKeepsVehicleHistoryButLeavesActiveCountsAndReportDistribution() throws Exception {
        Fixture fixture = create(1, ParcelStatus.LOADED_ON_TRUCK);
        String trackingId = fixture.ids().get(0);
        String vehicleId = "VH-LOSS-" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("INSERT INTO vehicle (vehicle_id, plate_number, description, active) VALUES (?, ?, 'Loss fixture', TRUE)", vehicleId, vehicleId);
        vehicleIds.add(vehicleId);
        jdbc.update("UPDATE parcel_unit SET current_vehicle_id = ? WHERE tracking_id = ?", vehicleId, trackingId);
        mvc.perform(get("/api/v1/vehicles/" + vehicleId).with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.onTruckCount").value(1));
        JsonNode before = report();
        command(trackingId, "lost", "Missing", revision(trackingId), UUID.randomUUID().toString()).andExpect(status().isOk());
        assertEquals(vehicleId, jdbc.queryForObject("SELECT current_vehicle_id FROM parcel_unit WHERE tracking_id = ?", String.class, trackingId));
        mvc.perform(get("/api/v1/vehicles/" + vehicleId).with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.onTruckCount").value(0));
        mvc.perform(get("/api/v1/shipments/" + fixture.shipmentId()).with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.deliveredCount").value(0)).andExpect(jsonPath("$.lostCount").value(1));
        JsonNode after = report();
        assertEquals(statusCount(before, "LOADED_ON_TRUCK") - 1, statusCount(after, "LOADED_ON_TRUCK"));
        assertEquals(statusCount(before, "LOST") + 1, statusCount(after, "LOST"));
        assertEquals(before.get("kpis"), after.get("kpis"));
    }

    private JsonNode report() throws Exception {
        String today = java.time.LocalDate.now().toString();
        return mapper.readTree(mvc.perform(get("/api/v1/reports/summary").param("startDate", today).param("endDate", today)
                .with(user("USR-ADMIN").roles("ADMIN"))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    private long statusCount(JsonNode report, String statusCode) {
        for (JsonNode row : report.get("statusDistribution")) {
            if (statusCode.equals(row.get("status").asText())) return row.get("count").asLong();
        }
        return 0;
    }

    @Test void racesLossAgainstCompletionWithoutFalseDelivery() throws Exception {
        Fixture fixture = create(2, ParcelStatus.LOADED_TO_HAULER);
        String waybillId = generate(fixture);
        send(waybillId).andExpect(status().isOk());
        String trackingId = fixture.ids().get(0);
        long revision = revision(trackingId);
        List<Integer> responses = race(
                () -> command(trackingId, "lost", "Missing", revision, UUID.randomUUID().toString()).andReturn().getResponse().getStatus(),
                () -> complete(waybillId, 0L).andReturn().getResponse().getStatus());
        assertTrue(responses.contains(200));
        assertTrue(responses.contains(409));
        boolean isLost = Boolean.TRUE.equals(jdbc.queryForObject("SELECT is_lost FROM parcel_unit WHERE tracking_id = ?", Boolean.class, trackingId));
        assertEquals(isLost ? "LOADED_TO_HAULER" : "COMPLETED", parcelStatus(trackingId));
        assertEquals(isLost ? 0 : 2, deliveryEvents(fixture));
    }

    @Test void racesRecoveryAgainstAllLostClosure() throws Exception {
        Fixture fixture = create(1, ParcelStatus.LOADED_TO_HAULER);
        String waybillId = generate(fixture);
        String trackingId = fixture.ids().get(0);
        command(trackingId, "lost", "Missing", revision(trackingId), UUID.randomUUID().toString()).andExpect(status().isOk());
        long revision = revision(trackingId);
        long manifestRevision = manifestRevision(waybillId);
        List<Integer> responses = race(
                () -> command(trackingId, "found", "Recovered", revision, UUID.randomUUID().toString()).andReturn().getResponse().getStatus(),
                () -> close(waybillId, manifestRevision, UUID.randomUUID().toString()).andReturn().getResponse().getStatus());
        assertEquals(200, responses.get(0));
        assertTrue(responses.get(1) == 200 || responses.get(1) == 409);
        assertEquals("GENERATED", waybillStatus(waybillId));
        assertEquals(0, deliveryEvents(fixture));
    }

    @Test void racesLossAgainstScanAndGeneration() throws Exception {
        Fixture scanning = create(1, ParcelStatus.ARRIVED_AT_TNL);
        String trackingId = scanning.ids().get(0);
        long revision = revision(trackingId);
        List<Integer> scanResults = race(
                () -> command(trackingId, "lost", "Missing", revision, UUID.randomUUID().toString()).andReturn().getResponse().getStatus(),
                () -> scan(trackingId, "LOADED_TO_HAULER").andReturn().getResponse().getStatus());
        assertTrue(scanResults.contains(200));
        assertTrue(scanResults.contains(409));
        Fixture generating = create(1, ParcelStatus.LOADED_TO_HAULER);
        String generatingId = generating.ids().get(0);
        long generationRevision = revision(generatingId);
        List<Integer> generationResults = race(
                () -> command(generatingId, "lost", "Missing", generationRevision, UUID.randomUUID().toString()).andReturn().getResponse().getStatus(),
                () -> generateRequest(generating).andReturn().getResponse().getStatus());
        assertTrue(generationResults.contains(200));
        assertFalse(generationResults.stream().allMatch(code -> code == 200));
        assertTrue(generationResults.stream().allMatch(code -> code == 200 || code == 400 || code == 409));
    }

    private List<Integer> race(Callable<Integer> first, Callable<Integer> second) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            Future<Integer> firstResult = executor.submit(() -> { start.await(); return first.call(); });
            Future<Integer> secondResult = executor.submit(() -> { start.await(); return second.call(); });
            start.countDown();
            return List.of(firstResult.get(30, TimeUnit.SECONDS), secondResult.get(30, TimeUnit.SECONDS));
        } finally { executor.shutdownNow(); }
    }

    private Fixture create(int count, ParcelStatus position) throws Exception {
        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientName("Loss Test " + UUID.randomUUID());
        request.setRecipientAddress("Test Hub");
        request.setRecipientContact("09170000000");
        request.setChargeModel(ChargeModel.PER_KILO);
        request.setQuantity(count);
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setExpectedRatePerKilo(new BigDecimal("100.00"));
        request.setExpectedVolumetricDivisor(5000);
        List<ParcelUnitRequest> units = new ArrayList<>();
        for (int index = 1; index <= count; index++) units.add(new ParcelUnitRequest(index, new BigDecimal("2.5"), new BigDecimal("20"), new BigDecimal("20"), new BigDecimal("20")));
        request.setParcels(units);
        JsonNode response = mapper.readTree(mvc.perform(post("/api/v1/shipments").with(user("USR-OFFICE").roles("RECEIVING_STAFF"))
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(request)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        String shipmentId = response.get("shipmentId").asText();
        shipmentIds.add(shipmentId);
        jdbc.update("UPDATE parcel_unit SET current_status = ? WHERE shipment_id = ?", position.name(), shipmentId);
        return new Fixture(shipmentId, jdbc.queryForList("SELECT tracking_id FROM parcel_unit WHERE shipment_id = ? ORDER BY seq", String.class, shipmentId));
    }
    private ResultActions command(String trackingId, String action, String reason, long revision, String requestId) throws Exception {
        return mvc.perform(post("/api/v1/parcel-units/" + trackingId + "/" + action).with(user("USR-ADMIN").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content(body(reason, revision, requestId)));
    }
    private String body(String reason, long revision, String requestId) throws Exception {
        return mapper.writeValueAsString(Map.of("reason", reason, "expectedRevision", revision, "requestId", requestId));
    }
    private ResultActions scan(String trackingId, String status) throws Exception {
        return mvc.perform(post("/api/v1/tracking-events/scan").with(user("USR-HAULER").roles("DISPATCH_STAFF"))
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("trackingId", trackingId, "targetStatus", status))));
    }
    private ResultActions generateRequest(Fixture fixture) throws Exception {
        return mvc.perform(post("/api/v1/waybills/generate").with(user("USR-HAULER").roles("DISPATCH_STAFF"))
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("shipmentId", fixture.shipmentId(), "trackingIds", fixture.ids(), "idempotencyKey", UUID.randomUUID().toString()))));
    }
    private String generate(Fixture fixture) throws Exception {
        return mapper.readTree(generateRequest(fixture).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("waybillId").asText();
    }
    private ResultActions send(String waybillId) throws Exception {
        return mvc.perform(post("/api/v1/waybills/" + waybillId + "/send").with(user("USR-HAULER").roles("DISPATCH_STAFF")));
    }
    private ResultActions complete(String waybillId, Long revision) throws Exception {
        Map<String, Object> request = new HashMap<>(Map.of("confirmedWaybillId", waybillId, "signedBy", "Test Signatory"));
        if (revision != null) request.put("manifestRevision", revision);
        return mvc.perform(post("/api/v1/waybills/" + waybillId + "/complete").with(user("USR-HAULER").roles("DISPATCH_STAFF"))
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(request)));
    }
    private ResultActions close(String waybillId, long revision, String requestId) throws Exception {
        return mvc.perform(post("/api/v1/waybills/" + waybillId + "/close-all-lost").with(user("USR-ADMIN").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content(body("All missing", revision, requestId)));
    }
    private long revision(String id) { return jdbc.queryForObject("SELECT revision FROM parcel_unit WHERE tracking_id = ?", Long.class, id); }
    private long manifestRevision(String id) { return jdbc.queryForObject("SELECT manifest_revision FROM waybill WHERE waybill_id = ?", Long.class, id); }
    private String parcelStatus(String id) { return jdbc.queryForObject("SELECT current_status FROM parcel_unit WHERE tracking_id = ?", String.class, id); }
    private String waybillStatus(String id) { return jdbc.queryForObject("SELECT status FROM waybill WHERE waybill_id = ?", String.class, id); }
    private int deliveryEvents(Fixture fixture) { return jdbc.queryForObject("SELECT COUNT(*) FROM tracking_event WHERE tracking_id IN (SELECT tracking_id FROM parcel_unit WHERE shipment_id = ?) AND status = 'COMPLETED'", Integer.class, fixture.shipmentId()); }
    private record Fixture(String shipmentId, List<String> ids) {}
}
