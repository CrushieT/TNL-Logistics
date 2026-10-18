package com.tnl.logistics.config;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.ShipmentRepository;
import com.tnl.logistics.service.*;
import jakarta.persistence.EntityManager;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/** Seeds current workflows, then expands their snapshots with bounded bulk inserts. */
@Component
@Profile("loadtest")
public class LoadTestDataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(LoadTestDataSeeder.class);
    private static final int CLIENT_COUNT = 500;
    private static final int VEHICLE_COUNT = 100;
    private static final String COMPLETION_USER_ID = "LT-DISABLED";

    private final EntityManager entityManager;
    private final ShipmentRepository shipmentRepository;
    private final TransactionTemplate transactionTemplate;
    private final BCryptPasswordEncoder passwordEncoder;
    private final ShipmentService shipmentService;
    private final TrackingService trackingService;
    private final PaymentService paymentService;
    private final WaybillService waybillService;
    private final ParcelExceptionService exceptionService;
    private final SoaService soaService;
    private final CollectionsService collectionsService;
    private final SystemSettingService systemSettingService;
    private final Validator validator;
    private final IdentifierCounterService counters;
    private final boolean enabled;
    private final int shipmentTarget;
    private final long randomSeed;
    private final int batchSize;
    private final String seedPassword;

    public LoadTestDataSeeder(EntityManager entityManager, ShipmentRepository shipmentRepository,
            TransactionTemplate transactionTemplate, BCryptPasswordEncoder passwordEncoder,
            ShipmentService shipmentService, TrackingService trackingService, PaymentService paymentService,
            WaybillService waybillService, ParcelExceptionService exceptionService, SoaService soaService,
            CollectionsService collectionsService, SystemSettingService systemSettingService, Validator validator, IdentifierCounterService counters,
            @Value("${app.loadtest.seed.enabled:false}") boolean enabled,
            @Value("${app.loadtest.seed.shipments:50000}") int shipmentTarget,
            @Value("${app.loadtest.seed.random-seed:20260925}") long randomSeed,
            @Value("${app.loadtest.seed.batch-size:250}") int batchSize,
            @Value("${app.loadtest.seed.password:}") String seedPassword) {
        this.entityManager = entityManager;
        this.shipmentRepository = shipmentRepository;
        this.transactionTemplate = transactionTemplate;
        this.passwordEncoder = passwordEncoder;
        this.shipmentService = shipmentService;
        this.trackingService = trackingService;
        this.paymentService = paymentService;
        this.waybillService = waybillService;
        this.exceptionService = exceptionService;
        this.soaService = soaService;
        this.collectionsService = collectionsService;
        this.systemSettingService = systemSettingService;
        this.validator = validator;
        this.counters = counters;
        this.enabled = enabled;
        this.shipmentTarget = shipmentTarget;
        this.randomSeed = randomSeed;
        this.batchSize = batchSize;
        this.seedPassword = seedPassword;
    }

    @Override
    public void run(String... args) {
        if (!enabled) return;
        if (shipmentTarget < 1 || batchSize < 1 || seedPassword.isBlank()) {
            throw new IllegalStateException("Load-test seeding requires positive targets and LOADTEST_SEED_PASSWORD");
        }
        long existingShipments = shipmentRepository.count();
        boolean hasCompletedSeed = Boolean.TRUE.equals(transactionTemplate.execute(status ->
                entityManager.find(AppUser.class, COMPLETION_USER_ID) != null));
        if (existingShipments == shipmentTarget && hasCompletedSeed) {
            log.info("Load-test seeding skipped because the database already contains {} shipments (target: {})",
                    existingShipments, shipmentTarget);
            return;
        }
        if (existingShipments > 0 || hasCompletedSeed) {
            throw new IllegalStateException(String.format(
                    "Load-test database is in an invalid/mismatched state: found %d shipments, expected %d. "
                            + "The seed may be outdated or incomplete. Use an empty test database/volume before re-running the seed.",
                    existingShipments, shipmentTarget));
        }
        transactionTemplate.executeWithoutResult(status -> seedReferenceData());
        systemSettingService.refreshCachedSettings();
        Random random = new Random(randomSeed);
        LocalDate cycleDate = collectionsService.calculateActiveCycleDate(LocalDate.now());
        int effectiveBatchSize = Math.min(batchSize, 250);
        int templateTarget = Math.min(shipmentTarget, 72);
        for (int batchStart = 1; batchStart <= templateTarget; batchStart += effectiveBatchSize) {
            int batchEnd = Math.min(templateTarget, batchStart + effectiveBatchSize - 1);
            int currentBatchStart = batchStart;
            int currentBatchEnd = batchEnd;
            transactionTemplate.executeWithoutResult(status -> seedShipmentBatch(currentBatchStart, currentBatchEnd, random, cycleDate));
            log.info("Load-test seed progress: {}/{} shipments", batchEnd, shipmentTarget);
        }
        if (shipmentTarget > templateTarget) {
            LoadTestFixtureWriter writer = new LoadTestFixtureWriter(entityManager, counters);
            transactionTemplate.executeWithoutResult(status -> writer.captureTemplates());
            for (long batchStart = templateTarget + 1L; batchStart <= shipmentTarget; batchStart += effectiveBatchSize) {
                int batchEnd = (int) Math.min(shipmentTarget, batchStart + effectiveBatchSize - 1);
                List<String> clientIds = new ArrayList<>();
                for (long index = batchStart; index <= batchEnd; index++) clientIds.add(resolveClientId((int) index, random));
                int currentBatchStart = (int) batchStart;
                transactionTemplate.executeWithoutResult(status -> writer.expandBatch(currentBatchStart, clientIds));
                log.info("Load-test bulk seed progress: {}/{} shipments", batchEnd, shipmentTarget);
            }
        }
        seedStatements(cycleDate);
        // Persist the disabled-account fixture last to detect an interrupted financial seed on restart.
        transactionTemplate.executeWithoutResult(status -> {
            AppUser disabled = persistUser(COMPLETION_USER_ID, "loadtest-disabled", "Load Test Disabled", UserRole.COURIER_STAFF);
            disabled.setActive(false);
        });
        log.info("Load-test seed complete: shipments={}, clients={}, vehicles={}, seed={}", shipmentTarget, CLIENT_COUNT, VEHICLE_COUNT, randomSeed);
    }

    private void seedReferenceData() {
        if (entityManager.find(AppUser.class, "LT-ADMIN") != null) {
            throw new IllegalStateException("Load-test reference data already exists; use an empty test database/volume");
        }
        SystemSetting settings = entityManager.find(SystemSetting.class, SystemSetting.DEFAULT_SETTING_ID);
        if (settings == null) {
            settings = new SystemSetting();
            entityManager.persist(settings);
        }
        settings.setCompanyName("TC & CT Integrated Logistics");
        settings.setVolumetricDivisor(3500);
        settings.setRatePerKilo(new BigDecimal("45.00"));
        settings.setSoaBankName("Synthetic Load Test Bank");
        settings.setSoaAccountName("TC & CT Integrated Logistics");
        settings.setSoaAccountNumber("000000000000");
        persistUser("LT-ADMIN", "loadtest-admin", "Load Test Admin", UserRole.ADMIN);
        AppUser receiving = persistUser("LT-OFFICE", "loadtest-office", "Load Test Receiving", UserRole.RECEIVING_STAFF);
        AppUser courier = persistUser("LT-FIELD", "loadtest-field", "Load Test Courier", UserRole.COURIER_STAFF);
        AppUser dispatcher = persistUser("LT-DISPATCH", "loadtest-dispatch", "Load Test Dispatcher", UserRole.DISPATCH_STAFF);
        String pinHash = passwordEncoder.encode("1111");
        for (AppUser user : List.of(receiving, courier, dispatcher)) user.setPinHash(pinHash);
        AppUser onboarding = persistUser("LT-ONBOARD", "loadtest-onboarding", "Load Test Onboarding", UserRole.RECEIVING_STAFF);
        onboarding.setMustChangePassword(true);
        persistUser("LT-NOPIN", "loadtest-nopin", "Load Test No PIN", UserRole.RECEIVING_STAFF);
        for (int index = 1; index <= CLIENT_COUNT; index++) {
            Client client = new Client(String.format("LT-CL-%04d", index), "Synthetic Client " + index,
                    index + " Sample Avenue, Load Test City", "0917" + String.format("%07d", index), "client" + index + "@loadtest.invalid");
            if (index % 2 == 1) client.setRatePerKilo(new BigDecimal("35.00"));
            client.setActive(index != CLIENT_COUNT);
            entityManager.persist(client);
        }
        for (int index = 1; index <= VEHICLE_COUNT; index++) {
            entityManager.persist(new Vehicle(vehicleId(index), String.format("LT%04d", index), "6-Wheeler Forward",
                    "Synthetic load-test vehicle", index == VEHICLE_COUNT ? "Inactive" : "Active",
                    index == VEHICLE_COUNT ? "Scheduled maintenance" : "Load-test delivery route"));
        }
    }

    private AppUser persistUser(String userId, String username, String fullName, UserRole role) {
        AppUser user = new AppUser(userId, username, passwordEncoder.encode(seedPassword), fullName, role);
        user.setMustChangePassword(false);
        user.setTokenVersion(1);
        entityManager.persist(user);
        return user;
    }

    private void seedShipmentBatch(int batchStart, int batchEnd, Random random, LocalDate cycleDate) {
        for (int index = batchStart; index <= batchEnd; index++) {
            int scenario = (index - 1) % 24;
            ShipmentResponse response = registerShipment(index, scenario, random);
            Shipment shipment = entityManager.find(Shipment.class, response.getShipmentId());
            LocalDate registeredDate = cycleDate.minusWeeks((index - 1) / 24 % 3).minusDays(2);
            if (registeredDate.isAfter(LocalDate.now())) registeredDate = LocalDate.now();
            backdateRegistration(shipment, registeredDate);
            seedOperations(shipment, response.getTrackingIds(), scenario, index);
            seedPayments(shipment, index);
            entityManager.flush();
            entityManager.clear();
        }
    }

    private ShipmentResponse registerShipment(int index, int scenario, Random random) {
        String clientId = resolveClientId(index, random);
        Client client = entityManager.find(Client.class, clientId);
        ShipmentCalculationSettingsResponse pricing = shipmentService.getCalculationSettings(clientId);
        int quantity = scenario == 23 ? 18 : scenario == 9 ? 5 : scenario == 20 ? 3 : 1 + index % 3;
        List<ParcelUnitRequest> parcels = new ArrayList<>();
        for (int sequence = 1; sequence <= quantity; sequence++) {
            parcels.add(new ParcelUnitRequest(sequence, BigDecimal.valueOf(index % 5 == 0 ? 1 : 8 + random.nextInt(12)),
                    BigDecimal.valueOf(index % 5 == 0 ? 60 : 30), new BigDecimal("25.00"), new BigDecimal("20.00")));
        }
        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId(clientId);
        request.setRecipientAddress(client.getAddress());
        request.setRecipientContact(client.getContactNumber());
        request.setDescription(String.format("LT%02d-%08d Synthetic cargo and delivery supplies", scenario + 1, index));
        request.setRoute("Manila to TNL Labo C.N.");
        request.setQuantity(quantity);
        request.setParcels(parcels);
        request.setOtherCharges(index % 5 == 0 ? new BigDecimal("49.85") : BigDecimal.ZERO);
        request.setPaidAtRegistration(index % 10 == 0);
        request.setRegisteredVia(index % 2 == 0 ? RegisteredVia.DESKTOP_OFFICE : RegisteredVia.MOBILE_FIELD);
        request.setExpectedRatePerKilo(pricing.getRatePerKilo());
        request.setExpectedVolumetricDivisor(pricing.getVolumetricDivisor());
        if (!validator.validate(request).isEmpty()) throw new IllegalStateException("Invalid load-test shipment: " + index);
        return shipmentService.registerShipment(request, "LT-OFFICE");
    }

    private void backdateRegistration(Shipment shipment, LocalDate date) {
        LocalDateTime registeredAt = date.atTime(9, 0);
        entityManager.flush();
        entityManager.createNativeQuery("UPDATE shipment SET date_registered = :timestamp WHERE shipment_id = :id")
                .setParameter("timestamp", registeredAt).setParameter("id", shipment.getShipmentId()).executeUpdate();
        entityManager.refresh(shipment);
        if (Boolean.TRUE.equals(shipment.getPaidAtRegistration())) {
            List<Payment> payments = entityManager.createQuery(
                    "select payment from Payment payment where payment.shipment.shipmentId = :id", Payment.class)
                    .setParameter("id", shipment.getShipmentId()).getResultList();
            for (Payment payment : payments) payment.setPaymentDate(date);
        }
        List<TrackingEvent> events = entityManager.createQuery(
                "select event from TrackingEvent event where event.parcelUnit.shipment.shipmentId = :id", TrackingEvent.class)
                .setParameter("id", shipment.getShipmentId()).getResultList();
        for (TrackingEvent event : events) {
            entityManager.createNativeQuery("UPDATE tracking_event SET event_timestamp = :timestamp WHERE event_id = :id")
                    .setParameter("timestamp", registeredAt.plusSeconds(event.getStatus() == ParcelStatus.QR_GENERATED ? 1 : 0))
                    .setParameter("id", event.getEventId()).executeUpdate();
            entityManager.refresh(event);
        }
    }

    private void seedOperations(Shipment shipment, List<String> ids, int scenario, int index) {
        if (scenario == 0 || scenario == 10) {
            if (scenario == 10) changeLoss(ids.getFirst(), true, index, "missing");
            return;
        }
        print(shipment, scenario == 21 ? ids.subList(0, ids.size() - 1) : ids, "first");
        if (scenario == 2) print(shipment, ids, "reprint");
        if (scenario <= 2) return;
        if (scenario == 21) {
            // Keep one unprinted parcel in the mixed-label scenario.
            return;
        }
        advance(ids, ParcelStatus.LOADED_ON_TRUCK, index);
        if (scenario == 3 || scenario == 11) {
            if (scenario == 11) changeLoss(ids.getFirst(), true, index, "missing");
            return;
        }
        advance(ids, ParcelStatus.ARRIVED_AT_TNL, index);
        if (scenario == 4 || scenario == 12 || scenario == 19) {
            if (scenario == 12 || scenario == 19) changeLoss(ids.getFirst(), true, index, "missing");
            if (scenario == 19) changeLoss(ids.getFirst(), false, index, "recovered");
            return;
        }
        advance(ids, ParcelStatus.LOADED_TO_HAULER, index);
        if (scenario == 5) return;
        if (scenario == 22) {
            advance(ids, ParcelStatus.COMPLETED, index);
            return;
        }
        if (scenario == 9) {
            complete(manifest(shipment, ids.subList(0, 2), "split-first", true));
            manifest(shipment, ids.subList(2, 4), "split-second", true);
            return;
        }
        boolean shouldSend = scenario != 6 && scenario != 13 && scenario != 16;
        Waybill waybill = manifest(shipment, ids, "manifest", shouldSend);
        if ((scenario >= 13 && scenario <= 18) || scenario == 20) {
            boolean isAllLost = scenario >= 16;
            for (String trackingId : isAllLost ? ids : ids.subList(0, 1)) changeLoss(trackingId, true, index, "missing");
            if (scenario == 18 || scenario == 20) {
                exceptionService.closeAllLost(waybill.getWaybillId(), new ParcelExceptionRequest(
                        "Synthetic all-lost reconciliation", waybill.getManifestRevision(), "loadtest-close-" + shipment.getShipmentId()), "LT-ADMIN");
            } else if (scenario == 15) complete(waybill);
            if (scenario == 20) changeLoss(ids.getFirst(), false, index, "recovered");
        } else if (scenario == 8) {
            complete(waybill);
            entityManager.persist(new WaybillReturnScan(waybill, entityManager.find(ParcelUnit.class, ids.getFirst()),
                    entityManager.find(AppUser.class, "LT-DISPATCH")));
        }
    }

    private void print(Shipment shipment, List<String> ids, String action) {
        UUID jobId = UUID.nameUUIDFromBytes(("loadtest:" + shipment.getShipmentId() + ":" + action).getBytes(StandardCharsets.UTF_8));
        shipmentService.recordLabelPrint(jobId, shipment.getShipmentId(), ids, "LT-OFFICE", "LOADTEST-PRINTER");
    }

    private void advance(List<String> ids, ParcelStatus status, int index) {
        boolean isCourierStep = status == ParcelStatus.LOADED_ON_TRUCK || status == ParcelStatus.ARRIVED_AT_TNL;
        trackingService.processBatchScan(new BatchTrackingScanRequest(ids, status,
                status == ParcelStatus.LOADED_ON_TRUCK ? vehicleId(1 + index % (VEHICLE_COUNT - 1)) : null,
                "Synthetic load-test scan"), isCourierStep ? "LT-FIELD" : "LT-DISPATCH");
    }

    private Waybill manifest(Shipment shipment, List<String> ids, String key, boolean shouldSend) {
        WaybillGenerationRequest request = new WaybillGenerationRequest();
        request.setShipmentId(shipment.getShipmentId());
        request.setTrackingIds(ids);
        request.setIdempotencyKey("loadtest-" + shipment.getShipmentId() + "-" + key);
        request.setHaulerName("Synthetic Load Test Freight");
        request.setDriverName("Load Test Dispatcher");
        request.setDriverContact("09175551004");
        request.setVehiclePlate("LT0001");
        request.setRemarks("Synthetic delivery manifest");
        String waybillId = waybillService.generate(request, "LT-DISPATCH").getWaybillId();
        if (shouldSend) waybillService.sendToHauler(waybillId, "LT-DISPATCH");
        return entityManager.find(Waybill.class, waybillId);
    }

    private void complete(Waybill waybill) {
        WaybillStatusUpdateRequest request = new WaybillStatusUpdateRequest();
        request.setConfirmedWaybillId(waybill.getWaybillId());
        request.setManifestRevision(waybill.getManifestRevision());
        request.setSignedBy("Synthetic Recipient");
        request.setRemarks("Synthetic signed delivery copy returned");
        waybillService.markSignedCompleted(waybill.getWaybillId(), request, "LT-DISPATCH");
    }

    private void changeLoss(String trackingId, boolean isLost, int index, String action) {
        entityManager.flush();
        ParcelUnit parcel = entityManager.find(ParcelUnit.class, trackingId);
        exceptionService.changeLoss(trackingId, isLost, new ParcelExceptionRequest("Synthetic parcel " + action,
                parcel.getRevision(), "loadtest-" + index + "-" + trackingId + "-" + action), "LT-ADMIN");
    }

    private void seedPayments(Shipment shipment, int index) {
        if (Boolean.TRUE.equals(shipment.getPaidAtRegistration()) || index % 3 == 0) return;
        BigDecimal amount = index % 3 == 1 ? shipment.getTotalAmount().divide(new BigDecimal("2"), 2, RoundingMode.HALF_UP)
                : shipment.getTotalAmount();
        PaymentMethod method = PaymentMethod.values()[index % PaymentMethod.values().length];
        paymentService.recordPayment(new PaymentRecordRequest(shipment.getShipmentId(), amount, method,
                "LT-PAY-" + index, shipment.getDateRegistered().toLocalDate(), "Synthetic load-test payment"), "LT-OFFICE");
        if (index % 7 == 0 && index % 3 == 1) {
            paymentService.recordPayment(new PaymentRecordRequest(shipment.getShipmentId(), new BigDecimal("25.00"), PaymentMethod.GCASH,
                    "LT-PAY-SECOND-" + index, shipment.getDateRegistered().toLocalDate(), "Synthetic second payment"), "LT-OFFICE");
        }
    }

    private void seedStatements(LocalDate cycleDate) {
        for (int cycleIndex = 2; cycleIndex >= 0; cycleIndex--) {
            LocalDate closingDate = cycleDate.minusWeeks(cycleIndex);
            List<String> clientIds = transactionTemplate.execute(status -> entityManager.createQuery(
                    "select distinct shipment.client.clientId from Shipment shipment where shipment.dateRegistered >= :start "
                            + "and shipment.dateRegistered < :end and shipment.client.clientId <> 'LT-CL-0007' order by shipment.client.clientId", String.class)
                    .setParameter("start", closingDate.minusDays(6).atStartOfDay())
                    .setParameter("end", closingDate.plusDays(1).atStartOfDay()).getResultList());
            for (String clientId : clientIds) {
                transactionTemplate.executeWithoutResult(status -> {
                    boolean hasDeduction = clientId.equals("LT-CL-0002");
                    BigDecimal deduction = hasDeduction ? soaService.getStatementPreview(clientId, closingDate).getAmountDue()
                            .min(new BigDecimal("25.00")) : BigDecimal.ZERO;
                    soaService.saveStatement(new SaveStatementRequest(clientId, closingDate,
                            deduction,
                            deduction.signum() > 0 ? "Synthetic approved packaging credit" : null,
                            "Load Test Receiving"), "LT-ADMIN");
                    entityManager.flush();
                    entityManager.clear();
                });
            }
        }
    }

    private String resolveClientId(int shipmentIndex, Random random) {
        if (shipmentIndex % 24 == 6) return "LT-CL-0007";
        int clientNumber = shipmentIndex % 10 < 6 ? 1 + shipmentIndex % 50 : 51 + random.nextInt(CLIENT_COUNT - 51);
        return String.format("LT-CL-%04d", clientNumber);
    }

    private String vehicleId(int index) {
        return String.format("LT-VH-%03d", index);
    }
}
