package com.tnl.logistics.config;

import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.ShipmentRepository;
import com.tnl.logistics.service.*;
import jakarta.persistence.EntityManager;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:mysql://localhost:3306/tnl_loadtest_workflow_fixture_test?createDatabaseIfNotExist=true",
        "app.seed.admin=false", "app.seed.sample-data=false", "app.seed.mobile-pins=false"
})
@ActiveProfiles("test")
@Transactional
class LoadTestDataSeederIntegrationTest {
    @Autowired EntityManager entityManager;
    @Autowired ShipmentRepository shipmentRepository;
    @Autowired TransactionTemplate transactionTemplate;
    @Autowired BCryptPasswordEncoder passwordEncoder;
    @Autowired ShipmentService shipmentService;
    @Autowired TrackingService trackingService;
    @Autowired PaymentService paymentService;
    @Autowired WaybillService waybillService;
    @Autowired ParcelExceptionService exceptionService;
    @Autowired SoaService soaService;
    @Autowired CollectionsService collectionsService;
    @Autowired SystemSettingService systemSettingService;
    @Autowired Validator validator;
    @Autowired IdentifierCounterService counters;

    @Test
    void seedsCurrentWorkflowsAcrossBatchesAndPreservesThemOnRestart() {
        LoadTestDataSeeder seeder = new LoadTestDataSeeder(entityManager, shipmentRepository, transactionTemplate,
                passwordEncoder, shipmentService, trackingService, paymentService, waybillService, exceptionService,
                soaService, collectionsService, systemSettingService, validator, counters, true, 144, 20260925L, 7, "loadtest-test-password");
        seeder.run();

        assertEquals(144, shipmentRepository.count());
        assertEquals(500, count("Client"));
        assertEquals(100, count("Vehicle"));
        assertEquals(7, count("AppUser"));
        assertEquals(UserRole.DISPATCH_STAFF, entityManager.find(AppUser.class, "LT-DISPATCH").getRole());
        assertTrue(passwordEncoder.matches("1111", entityManager.find(AppUser.class, "LT-FIELD").getPinHash()));
        assertTrue(entityManager.find(AppUser.class, "LT-ONBOARD").getMustChangePassword());
        assertNull(entityManager.find(AppUser.class, "LT-NOPIN").getPinHash());
        assertFalse(entityManager.find(AppUser.class, "LT-DISABLED").getActive());
        assertFalse(entityManager.find(Client.class, "LT-CL-0500").getActive());

        for (Shipment shipment : entityManager.createQuery("select shipment from Shipment shipment", Shipment.class).getResultList()) {
            assertEquals(ChargeModel.PER_KILO, shipment.getChargeModel());
            assertEquals(shipment.getClient().getName(), shipment.getRecipientName());
            assertEquals(3500, shipment.getAppliedVolumetricDivisor());
            assertEquals(0, shipment.getBillableWeight().compareTo(shipment.getTotalActualWeight().max(shipment.getTotalVolumetricWeight())));
            assertEquals(0, shipment.getShippingFee().compareTo(shipment.getBillableWeight().multiply(shipment.getAppliedRatePerKilo())
                    .setScale(2, RoundingMode.HALF_UP)));
            assertEquals(0, shipment.getTotalAmount().compareTo(shipment.getShippingFee().add(shipment.getOtherCharges())));
            List<ParcelUnit> parcels = units(shipment);
            assertEquals(shipment.getQuantity(), parcels.size());
            assertEquals(0, shipment.getTotalActualWeight().compareTo(parcels.stream().map(ParcelUnit::getWeightKg)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)));
            for (ParcelUnit parcel : parcels) {
                List<TrackingEvent> events = entityManager.createQuery(
                        "select event from TrackingEvent event where event.parcelUnit.trackingId = :id order by event.eventId", TrackingEvent.class)
                        .setParameter("id", parcel.getTrackingId()).getResultList();
                assertEquals(ParcelStatus.REGISTERED, events.getFirst().getStatus());
                assertEquals(ParcelStatus.QR_GENERATED, events.get(1).getStatus());
                assertEquals(shipment.getDateRegistered().toLocalDate(), events.getFirst().getEventTimestamp().toLocalDate());
                assertEquals(parcel.getCurrentStatus(), events.getLast().getStatus());
                assertNotEquals(LabelStatus.REPRINTED, parcel.getLabelStatus());
                if (parcel.getCurrentStatus() == ParcelStatus.LOADED_ON_TRUCK) assertNotNull(parcel.getCurrentVehicle());
                else assertNull(parcel.getCurrentVehicle());
            }
        }
        assertEquals(LabelStatus.NOT_PRINTED, units(scenario(1)).getFirst().getLabelStatus());
        assertEquals(1, units(scenario(3)).getFirst().getReprintCount());
        assertEquals(1, units(scenario(22)).stream().filter(parcel -> parcel.getLabelStatus() == LabelStatus.NOT_PRINTED).count());
        assertEquals(18, units(scenario(24)).size());
        assertEquals(2, units(scenario(10)).stream().filter(parcel -> parcel.getCurrentStatus() == ParcelStatus.COMPLETED).count());
        assertEquals(1, units(scenario(10)).stream().filter(parcel -> parcel.getWaybill() == null).count());
        assertTrue(units(scenario(11)).getFirst().isLost());
        assertTrue(units(scenario(20)).stream().noneMatch(ParcelUnit::isLost));
        assertEquals("WITH_LOSS", units(scenario(16)).getFirst().getWaybill().getReconciliationOutcome());
        assertEquals("ALL_LOST", units(scenario(19)).getFirst().getWaybill().getReconciliationOutcome());
        Waybill reopened = units(scenario(21)).getFirst().getWaybill();
        assertEquals(WaybillStatus.SENT_TO_HAULER, reopened.getStatus());
        assertNull(reopened.getReconciliationOutcome());
        assertEquals(2, units(scenario(21)).stream().filter(ParcelUnit::isLost).count());
        assertEquals(6, count("WaybillReturnScan"));
        for (int scenario = 1; scenario <= 24; scenario++) {
            List<Shipment> matches = entityManager.createQuery(
                    "select shipment from Shipment shipment where shipment.description like :prefix order by shipment.shipmentId", Shipment.class)
                    .setParameter("prefix", String.format("LT%02d-%%", scenario)).getResultList();
            List<ParcelUnit> originals = units(matches.getFirst());
            List<ParcelUnit> copies = units(matches.getLast());
            assertEquals(originals.size(), copies.size());
            for (int parcelIndex = 0; parcelIndex < originals.size(); parcelIndex++) {
                ParcelUnit original = originals.get(parcelIndex);
                ParcelUnit copy = copies.get(parcelIndex);
                assertNotEquals(original.getTrackingId(), copy.getTrackingId());
                assertEquals(original.getCurrentStatus(), copy.getCurrentStatus());
                assertEquals(original.getLabelStatus(), copy.getLabelStatus());
                assertEquals(original.getReprintCount(), copy.getReprintCount());
                assertEquals(original.isLost(), copy.isLost());
                assertEquals(original.getRevision(), copy.getRevision());
                if (original.getWaybill() == null) assertNull(copy.getWaybill());
                else {
                    assertNotEquals(original.getWaybill().getWaybillId(), copy.getWaybill().getWaybillId());
                    assertEquals(original.getWaybill().getStatus(), copy.getWaybill().getStatus());
                    assertEquals(original.getWaybill().getManifestRevision(), copy.getWaybill().getManifestRevision());
                    assertEquals(original.getWaybill().getReconciliationOutcome(), copy.getWaybill().getReconciliationOutcome());
                }
            }
        }
        for (PrintAuditJob job : entityManager.createQuery(
                "select job from PrintAuditJob job where job.shipment.description like 'LT03-%'", PrintAuditJob.class).getResultList()) {
            List<String> ids = entityManager.createQuery(
                    "select event.parcelUnit.trackingId from PrintEvent event where event.printAuditJob.printJobId = :id order by event.parcelUnit.trackingId", String.class)
                    .setParameter("id", job.getPrintJobId()).getResultList();
            int reprintsBefore = units(job.getShipment()).getFirst().getReprintCount();
            shipmentService.recordLabelPrint(java.util.UUID.fromString(job.getPrintJobId()), job.getShipment().getShipmentId(),
                    ids, job.getStaff().getUserId(), job.getPrinterId());
            assertEquals(reprintsBefore, units(job.getShipment()).getFirst().getReprintCount(), "Copied print fingerprints must support idempotent retries");
        }
        for (Shipment shipment : entityManager.createQuery("select shipment from Shipment shipment", Shipment.class).getResultList()) {
            BigDecimal paid = entityManager.createQuery(
                    "select coalesce(sum(payment.amountPaid), 0) from Payment payment where payment.shipment.shipmentId = :id", BigDecimal.class)
                    .setParameter("id", shipment.getShipmentId()).getSingleResult();
            assertTrue(paid.compareTo(shipment.getTotalAmount()) <= 0);
            if (Boolean.TRUE.equals(shipment.getPaidAtRegistration())) assertEquals(0, paid.compareTo(shipment.getTotalAmount()));
        }
        assertEquals(EnumSet.allOf(PaymentMethod.class), EnumSet.copyOf(entityManager.createQuery(
                "select distinct payment.method from Payment payment", PaymentMethod.class).getResultList()));
        LocalDate cycle = collectionsService.calculateActiveCycleDate(LocalDate.now());
        assertTrue(collectionsService.getActiveCycleDates().containsAll(List.of(cycle, cycle.minusWeeks(1), cycle.minusWeeks(2))));
        assertNull(entityManager.createQuery("select shipment from Shipment shipment where shipment.client.clientId = 'LT-CL-0007'", Shipment.class)
                .getResultList().getFirst().getStatementId());
        for (Soa statement : entityManager.createQuery("select statement from Soa statement", Soa.class).getResultList()) {
            assertNotNull(statement.getBatch());
            assertNotNull(statement.getCollection());
            assertEquals(0, statement.getOutstandingBalance().compareTo(statement.getCurrentCharges().add(statement.getPreviousBalance())
                    .subtract(statement.getTotalPaid()).subtract(statement.getDeductions()).max(BigDecimal.ZERO)));
        }
        long printCount = count("PrintEvent");
        long statementCount = count("Soa");
        seeder.run();
        assertEquals(144, shipmentRepository.count());
        assertEquals(printCount, count("PrintEvent"));
        assertEquals(statementCount, count("Soa"));
        assertEquals(0L, ((Number) entityManager.createNativeQuery(
                "select count(*) from parcel_exception_command command left join parcel_unit parcel on parcel.tracking_id=command.target_id "
                        + "left join waybill on waybill.waybill_id=command.target_id where parcel.tracking_id is null and waybill.waybill_id is null")
                .getSingleResult()).longValue());
        assertEquals(0L, ((Number) entityManager.createNativeQuery(
                "select count(*) from print_event event join print_audit_job job on job.print_job_id=event.print_job_id "
                        + "join parcel_unit parcel on parcel.tracking_id=event.tracking_id where parcel.shipment_id <> job.shipment_id")
                .getSingleResult()).longValue());
        assertEquals(0L, ((Number) entityManager.createNativeQuery(
                "select count(*) from parcel_loss_event event left join parcel_exception_command command on command.request_id=event.request_id "
                        + "where command.request_id is null or command.target_id <> event.tracking_id")
                .getSingleResult()).longValue());
        long nextShipment = counters.next(IdentifierCounterService.IdentifierFamily.SHIPMENT, LocalDate.now().getYear());
        long maxShipment = ((Number) entityManager.createNativeQuery(
                "select max(cast(substring_index(shipment_id, '-', -1) as unsigned)) from shipment").getSingleResult()).longValue();
        assertTrue(nextShipment > maxShipment, "Normal registration must allocate beyond all bulk-generated shipments");
    }

    private long count(String entity) {
        return entityManager.createQuery("select count(record) from " + entity + " record", Long.class).getSingleResult();
    }

    private Shipment scenario(int scenario) {
        return entityManager.createQuery("select shipment from Shipment shipment where shipment.description like :prefix order by shipment.shipmentId", Shipment.class)
                .setParameter("prefix", String.format("LT%02d-%%", scenario)).getResultList().getFirst();
    }

    private List<ParcelUnit> units(Shipment shipment) {
        return entityManager.createQuery("select parcel from ParcelUnit parcel where parcel.shipment.shipmentId = :id order by parcel.seq", ParcelUnit.class)
                .setParameter("id", shipment.getShipmentId()).getResultList();
    }
}
