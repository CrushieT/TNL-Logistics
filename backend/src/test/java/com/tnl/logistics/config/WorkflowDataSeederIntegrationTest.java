package com.tnl.logistics.config;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tnl.logistics.model.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.ParcelExceptionRequest;
import com.tnl.logistics.dto.TrackingScanRequest;
import com.tnl.logistics.service.CollectionsService;
import com.tnl.logistics.service.ShipmentService;
import com.tnl.logistics.service.SoaService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = {
        "app.seed.workflow-fixtures=true",
        "spring.datasource.url=jdbc:mysql://localhost:3306/tnl_workflow_named_fixture_test?createDatabaseIfNotExist=true"
})
@AutoConfigureMockMvc
@ActiveProfiles({"test", "workflow"})
@Transactional
class WorkflowDataSeederIntegrationTest {
    @Autowired EntityManager entityManager;
    @Autowired WorkflowDataSeeder seeder;
    @Autowired ShipmentService shipments;
    @Autowired SoaService statements;
    @Autowired CollectionsService collections;
    @Autowired BCryptPasswordEncoder encoder;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    @Test
    void coversCurrentRegistrationPricingPrintAndPaymentContracts() {
        List<Shipment> allShipments = entityManager.createQuery("select shipment from Shipment shipment", Shipment.class).getResultList();
        assertEquals(100, allShipments.size());
        for (Shipment shipment : allShipments) {
            assertEquals(ChargeModel.PER_KILO, shipment.getChargeModel());
            assertEquals(shipment.getClient().getName(), shipment.getRecipientName());
            assertTrue(shipment.getDescription().length() <= 120);
            assertTrue(shipment.getRecipientAddress().length() <= 80);
            assertTrue(shipment.getRecipientContact().matches("[0-9]{11}"));
            assertNotNull(shipment.getAppliedRatePerKilo());
            assertEquals(3500, shipment.getAppliedVolumetricDivisor());
            assertEquals(0, shipment.getShippingFee().add(shipment.getOtherCharges()).compareTo(shipment.getTotalAmount()));
            assertEquals(0, shipment.getTotalActualWeight().max(shipment.getTotalVolumetricWeight()).compareTo(shipment.getBillableWeight()));
            assertEquals(0, shipment.getBillableWeight().multiply(shipment.getAppliedRatePerKilo()).setScale(2, RoundingMode.HALF_UP)
                    .compareTo(shipment.getShippingFee()));
            List<ParcelUnit> units = units(shipment);
            assertEquals(shipment.getQuantity(), units.size());
            BigDecimal weight = units.stream().map(ParcelUnit::getWeightKg).reduce(BigDecimal.ZERO, BigDecimal::add);
            assertEquals(0, weight.compareTo(shipment.getTotalActualWeight()));
            for (ParcelUnit parcel : units) {
                List<TrackingEvent> history = entityManager.createQuery(
                        "select event from TrackingEvent event where event.parcelUnit.trackingId = :id order by event.eventId", TrackingEvent.class)
                        .setParameter("id", parcel.getTrackingId()).getResultList();
                assertEquals(ParcelStatus.REGISTERED, history.getFirst().getStatus());
                assertEquals(ParcelStatus.QR_GENERATED, history.get(1).getStatus());
                assertEquals(parcel.getCurrentStatus(), history.getLast().getStatus());
                assertNotEquals(LabelStatus.REPRINTED, parcel.getLabelStatus());
                if (parcel.getCurrentStatus() == ParcelStatus.LOADED_ON_TRUCK) assertNotNull(parcel.getCurrentVehicle());
                else assertNull(parcel.getCurrentVehicle());
            }
        }
        assertEquals(120, scenario("WF23 ").getDescription().length());
        assertEquals(80, scenario("WF23 ").getRecipientAddress().length());
        assertTrue(scenario("WF24 ").getTotalVolumetricWeight().compareTo(scenario("WF24 ").getTotalActualWeight()) > 0);
        assertEquals(0, new BigDecimal("35.00").compareTo(scenario("WF01 ").getAppliedRatePerKilo()));
        assertEquals(0, new BigDecimal("45.00").compareTo(scenario("WF02 ").getAppliedRatePerKilo()));
        assertEquals(LabelStatus.NOT_PRINTED, units(scenario("WF01 ")).getFirst().getLabelStatus());
        assertEquals(1, units(scenario("WF03 ")).getFirst().getReprintCount());
        assertEquals(2, units(scenario("WF22 ")).stream().filter(parcel -> parcel.getLabelStatus() == LabelStatus.PRINTED).count());
        EnumSet<PaymentMethod> methods = EnumSet.copyOf(entityManager.createQuery("select distinct payment.method from Payment payment", PaymentMethod.class).getResultList());
        assertEquals(EnumSet.allOf(PaymentMethod.class), methods);
    }

    @Test
    void containsSplitLossRecoveryAndReopenedManifestScenarios() {
        assertEquals(36, count("Waybill"));
        assertEquals(18, units(scenario("PAGE-24 ")).size(), "Multi-page waybill printing needs more than 15 manifest members");
        List<ParcelUnit> split = units(scenario("WF10 "));
        assertEquals(2, split.stream().filter(parcel -> parcel.getCurrentStatus() == ParcelStatus.COMPLETED).count());
        assertEquals(1, split.stream().filter(parcel -> parcel.getWaybill() == null).count());
        ParcelUnit lost = units(scenario("WF11 ")).getFirst();
        assertTrue(lost.isLost());
        assertEquals(ParcelStatus.QR_GENERATED, lost.getCurrentStatus());
        assertEquals(0, scenario("WF11 ").getTotalAmount().compareTo(shipments.getShipmentById(scenario("WF11 ").getShipmentId()).getTotalAmount()));
        Waybill withLoss = units(scenario("WF16 ")).getFirst().getWaybill();
        assertEquals(WaybillStatus.SIGNED_COMPLETED, withLoss.getStatus());
        assertEquals("WITH_LOSS", withLoss.getReconciliationOutcome());
        assertEquals(1, units(scenario("WF16 ")).stream().filter(ParcelUnit::isLost).count());
        assertEquals(2, units(scenario("WF16 ")).stream().filter(parcel -> parcel.getCurrentStatus() == ParcelStatus.COMPLETED).count());
        assertEquals("ALL_LOST", units(scenario("WF19 ")).getFirst().getWaybill().getReconciliationOutcome());
        Waybill reopened = units(scenario("WF21 ")).getFirst().getWaybill();
        assertEquals(WaybillStatus.SENT_TO_HAULER, reopened.getStatus());
        assertNull(reopened.getSignedAt());
        assertNull(reopened.getReconciliationOutcome());
        assertTrue(reopened.getManifestRevision() > 0);
        assertEquals(1, units(scenario("WF21 ")).stream().filter(ParcelUnit::isLost).count());
        assertTrue(units(scenario("WF20 ")).stream().noneMatch(ParcelUnit::isLost));
        assertEquals(20, count("ParcelLossEvent"));
        assertEquals(22, count("ParcelExceptionCommand"));
        assertEquals(6, count("WaybillReconciliationEvent"));
        assertEquals(1, count("WaybillReturnScan"));
    }

    @Test
    void seedsFinancialCyclesPaidOutstandingDeductionsAndMultiPageStatements() {
        LocalDate cycle = collections.calculateActiveCycleDate(LocalDate.now());
        assertEquals(7, count("Soa"));
        assertEquals(7, count("SoaBatch"));
        assertEquals(7, count("WeeklyCollection"));
        assertTrue(collections.getActiveCycleDates().containsAll(List.of(cycle, cycle.minusWeeks(1), cycle.minusWeeks(2))));
        var outstanding = statements.getStatementPreview("CL-WF-023", cycle);
        assertEquals(18, outstanding.getItems().size());
        assertTrue(outstanding.getAmountDue().signum() > 0);
        assertEquals(0, new BigDecimal("25.00").compareTo(outstanding.getDeductionAmount()));
        var paid = statements.getStatementPreview("CL-WF-024", cycle);
        assertEquals(18, paid.getItems().size());
        assertEquals(0, paid.getAmountDue().signum());
        assertEquals(0, statements.getStatementPreview("CL-WF-006", cycle).getAmountDue().signum());
        assertNull(scenario("FIN-UNBILLED ").getStatementId());
        for (Soa statement : entityManager.createQuery("select statement from Soa statement", Soa.class).getResultList()) {
            assertEquals(0, statement.getCurrentCharges().subtract(statement.getTotalPaid()).subtract(statement.getDeductions())
                    .max(BigDecimal.ZERO).compareTo(statement.getOutstandingBalance()));
            assertNotNull(statement.getBatch());
            assertEquals(statement.getCollection().getCollectionDate(), statement.getStatementDate());
        }
        Shipment historical = scenario("FIN-DUE-2-1 ");
        var firstEvent = entityManager.createQuery("select event from TrackingEvent event where event.parcelUnit.shipment.shipmentId = :id order by event.eventId", TrackingEvent.class)
                .setParameter("id", historical.getShipmentId()).getResultList().getFirst();
        assertEquals(historical.getDateRegistered().toLocalDate(), firstEvent.getEventTimestamp().toLocalDate());
    }

    @Test
    void includesAccountsFleetAndEmptyDirectoriesForManualTesting() {
        assertEquals(26, count("AppUser"));
        assertEquals(26, count("Client"));
        assertEquals(25, count("Vehicle"));
        assertEquals(2, count("MobileDeviceBinding"));
        assertEquals("Elena Navarro", entityManager.find(AppUser.class, "U-002").getFullName());
        assertEquals("Bicol Home Essentials", entityManager.find(Client.class, "CL-WF-006").getName());
        assertEquals(150, entityManager.find(Client.class, "CL-WF-022").getName().length());
        for (AppUser staff : entityManager.createQuery("select staff from AppUser staff", AppUser.class).getResultList()) {
            assertFalse(staff.getFullName().contains("Workflow"));
        }
        for (Client client : entityManager.createQuery("select client from Client client", Client.class).getResultList()) {
            assertFalse(client.getName().contains("Workflow"));
        }
        for (Waybill manifest : entityManager.createQuery("select manifest from Waybill manifest", Waybill.class).getResultList()) {
            assertFalse(manifest.getHaulerName().contains("Workflow"));
            assertFalse(manifest.getDriverName().contains("Workflow"));
            assertTrue(manifest.getVehiclePlate().matches("[A-Z]{3}-[0-9]{4}"));
        }
        assertTrue(encoder.matches("office123", entityManager.find(AppUser.class, "U-002").getPasswordHash()));
        assertTrue(encoder.matches("1111", entityManager.find(AppUser.class, "U-003").getPinHash()));
        assertTrue(entityManager.find(AppUser.class, "U-008").getMustChangePassword());
        assertNull(entityManager.find(AppUser.class, "U-009").getPinHash());
        assertFalse(entityManager.find(AppUser.class, "U-010").getActive());
        assertFalse(entityManager.find(Client.class, "CL-WF-026").getActive());
        assertFalse(entityManager.find(Vehicle.class, "VH-WF-024").getActive());
        assertEquals(0, entityManager.createQuery("select count(shipment) from Shipment shipment where shipment.client.clientId = 'CL-WF-025'", Long.class).getSingleResult());
        assertTrue(count("PrintAuditJob") > 20);
        assertTrue(count("PrintEvent") > 20);
        assertTrue(count("Payment") > 20);
    }

    @Test
    void restartDoesNotDuplicateRecordsOrResetManualChanges() {
        List<String> entities = List.of("AppUser", "Client", "Vehicle", "Shipment", "ParcelUnit", "TrackingEvent",
                "Payment", "PrintAuditJob", "PrintEvent", "Waybill", "Soa", "WeeklyCollection", "SoaBatch",
                "ParcelLossEvent", "ParcelExceptionCommand", "WaybillReconciliationEvent", "MobileDeviceBinding");
        Map<String, Long> before = entities.stream().collect(Collectors.toMap(name -> name, this::count));
        AppUser user = entityManager.find(AppUser.class, "U-002");
        user.setTokenVersion(7);
        user.setFullName("Manual test user name");
        SystemSetting settings = entityManager.find(SystemSetting.class, SystemSetting.DEFAULT_SETTING_ID);
        settings.setSoaBankName("Manual Test Bank");
        Shipment shipment = scenario("WF01 ");
        shipment.setDescription("Manual test description");
        entityManager.flush();
        seeder.run();
        entityManager.flush();
        entityManager.clear();
        assertEquals(before, entities.stream().collect(Collectors.toMap(name -> name, this::count)));
        assertEquals(7, entityManager.find(AppUser.class, "U-002").getTokenVersion());
        assertEquals("Manual test user name", entityManager.find(AppUser.class, "U-002").getFullName());
        assertEquals("Manual Test Bank", entityManager.find(SystemSetting.class, SystemSetting.DEFAULT_SETTING_ID).getSoaBankName());
        assertEquals("Manual test description", entityManager.find(Shipment.class, shipment.getShipmentId()).getDescription());
    }

    @Test
    void fixtureEndpointsRespectRolesAndExposeUsableDirectories() throws Exception {
        mvc.perform(get("/api/v1/shipments").with(user("U-001").roles("ADMIN"))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/shipments").with(user("U-002").roles("RECEIVING_STAFF"))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/shipments").with(user("U-003").roles("COURIER_STAFF"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/shipments")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/collections/weekly").with(user("U-001").roles("ADMIN"))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/soa/preview").param("clientId", "CL-WF-023").with(user("U-001").roles("ADMIN"))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/collections/weekly").with(user("U-003").roles("COURIER_STAFF"))).andExpect(status().isForbidden());
    }

    @Test
    void rejectsProductionBeforeWritingAnyFixtures() {
        MockEnvironment production = new MockEnvironment();
        production.setActiveProfiles("workflow", "prod");
        WorkflowDataSeeder unsafe = new WorkflowDataSeeder(null, null, null, null, null, null, null, null,
                null, null, null, production, true);
        assertThrows(IllegalStateException.class, unsafe::run);
    }

    @Test
    void optOutDoesNotAccessPersistence() {
        MockEnvironment workflow = new MockEnvironment();
        workflow.setActiveProfiles("workflow");
        WorkflowDataSeeder disabled = new WorkflowDataSeeder(null, null, null, null, null, null, null, null,
                null, null, null, workflow, false);
        assertDoesNotThrow(() -> { disabled.run(); });
    }

    @Test
    void lostFixturesRejectScanningUnauthorizedChangesAndStaleRevisions() throws Exception {
        ParcelUnit lost = units(scenario("WF11 ")).getFirst();
        String trackingId = lost.getTrackingId();
        TrackingScanRequest scan = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-WF-001", "Workflow negative test");
        mvc.perform(post("/api/v1/tracking-events/scan").with(user("U-003").roles("COURIER_STAFF"))
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(scan))).andExpect(status().isConflict());
        ParcelExceptionRequest stale = new ParcelExceptionRequest("Recovered during test", lost.getRevision() + 1, "workflow-stale-request");
        mvc.perform(post("/api/v1/parcel-units/" + trackingId + "/found").with(user("U-002").roles("RECEIVING_STAFF"))
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(stale))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/parcel-units/" + trackingId + "/found").with(user("U-001").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(stale))).andExpect(status().isConflict());
        assertTrue(lost.isLost());
    }

    private Shipment scenario(String prefix) {
        return entityManager.createQuery("select shipment from Shipment shipment where shipment.description like :prefix", Shipment.class)
                .setParameter("prefix", prefix + "%").getSingleResult();
    }

    private List<ParcelUnit> units(Shipment shipment) {
        return entityManager.createQuery("select parcel from ParcelUnit parcel where parcel.shipment.shipmentId = :id order by parcel.seq", ParcelUnit.class)
                .setParameter("id", shipment.getShipmentId()).getResultList();
    }

    private long count(String entity) {
        return entityManager.createQuery("select count(record) from " + entity + " record", Long.class).getSingleResult();
    }
}
