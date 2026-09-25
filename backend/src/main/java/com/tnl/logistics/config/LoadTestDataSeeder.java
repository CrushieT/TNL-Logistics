package com.tnl.logistics.config;

import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.ChargeModel;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.LabelStatus;
import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.ParcelUnit;
import com.tnl.logistics.model.Payment;
import com.tnl.logistics.model.PaymentMethod;
import com.tnl.logistics.model.RegisteredVia;
import com.tnl.logistics.model.Shipment;
import com.tnl.logistics.model.StaffType;
import com.tnl.logistics.model.TrackingEvent;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.model.Vehicle;
import com.tnl.logistics.repository.ShipmentRepository;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/** Creates deterministic synthetic data only in an empty load-test database. */
@Component
@Profile("loadtest")
public class LoadTestDataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(LoadTestDataSeeder.class);
    private static final int CLIENT_COUNT = 500;
    private static final int VEHICLE_COUNT = 100;
    private static final List<ParcelStatus> TRACKING_STATES = List.of(
            ParcelStatus.REGISTERED,
            ParcelStatus.QR_GENERATED,
            ParcelStatus.LOADED_ON_TRUCK,
            ParcelStatus.ARRIVED_AT_TNL,
            ParcelStatus.LOADED_TO_HAULER,
            ParcelStatus.COMPLETED);

    private final EntityManager entityManager;
    private final ShipmentRepository shipmentRepository;
    private final TransactionTemplate transactionTemplate;
    private final BCryptPasswordEncoder passwordEncoder;
    private final boolean enabled;
    private final int shipmentTarget;
    private final long randomSeed;
    private final int batchSize;
    private final String seedPassword;

    public LoadTestDataSeeder(EntityManager entityManager, ShipmentRepository shipmentRepository,
            TransactionTemplate transactionTemplate, BCryptPasswordEncoder passwordEncoder,
            @Value("${app.loadtest.seed.enabled:false}") boolean enabled,
            @Value("${app.loadtest.seed.shipments:10000}") int shipmentTarget,
            @Value("${app.loadtest.seed.random-seed:20260925}") long randomSeed,
            @Value("${app.loadtest.seed.batch-size:250}") int batchSize,
            @Value("${app.loadtest.seed.password:}") String seedPassword) {
        this.entityManager = entityManager;
        this.shipmentRepository = shipmentRepository;
        this.transactionTemplate = transactionTemplate;
        this.passwordEncoder = passwordEncoder;
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
        if (existingShipments == shipmentTarget) {
            log.info("Load-test seeding skipped because the database already contains {} shipments (target: {})",
                    existingShipments, shipmentTarget);
            return;
        }
        if (existingShipments > 0) {
            throw new IllegalStateException(String.format(
                    "Load-test database is in an invalid/mismatched state: found %d shipments, expected %d. "
                            + "Drop or recreate the test database/volume before re-running the seed.",
                    existingShipments, shipmentTarget));
        }
        transactionTemplate.executeWithoutResult(status -> seedReferenceData());
        Random random = new Random(randomSeed);
        for (int batchStart = 1; batchStart <= shipmentTarget; batchStart += batchSize) {
            int batchEnd = Math.min(shipmentTarget, batchStart + batchSize - 1);
            int currentBatchStart = batchStart;
            int currentBatchEnd = batchEnd;
            transactionTemplate.executeWithoutResult(status -> seedShipmentBatch(currentBatchStart, currentBatchEnd, random));
            log.info("Load-test seed progress: {}/{} shipments", batchEnd, shipmentTarget);
        }
        log.info("Load-test seed complete: shipments={}, clients={}, vehicles={}, seed={}", shipmentTarget, CLIENT_COUNT, VEHICLE_COUNT, randomSeed);
    }

    private void seedReferenceData() {
        persistUser("LT-ADMIN", "loadtest-admin", "Load Test Admin", UserRole.ADMIN, null);
        persistUser("LT-OFFICE", "loadtest-office", "Load Test Office", UserRole.OFFICE_STAFF, null);
        persistUser("LT-FIELD", "loadtest-field", "Load Test Field", UserRole.FIELD_STAFF, StaffType.INTERNAL_TRUCK);
        for (int index = 1; index <= CLIENT_COUNT; index++) {
            entityManager.persist(new Client(String.format("LT-CL-%04d", index), "Synthetic Client " + index,
                    index + " Sample Avenue, Load Test City", "0917" + String.format("%07d", index), "client" + index + "@loadtest.invalid"));
        }
        for (int index = 1; index <= VEHICLE_COUNT; index++) {
            entityManager.persist(new Vehicle(String.format("LT-VH-%03d", index), String.format("LT%04d", index), "Synthetic load-test vehicle"));
        }
    }

    private void persistUser(String userId, String username, String fullName, UserRole role, StaffType staffType) {
        AppUser user = new AppUser(userId, username, passwordEncoder.encode(seedPassword), fullName, role, staffType, null);
        user.setMustChangePassword(false);
        user.setTokenVersion(1);
        entityManager.persist(user);
    }

    private void seedShipmentBatch(int batchStart, int batchEnd, Random random) {
        AppUser officeUser = entityManager.getReference(AppUser.class, "LT-OFFICE");
        AppUser fieldUser = entityManager.getReference(AppUser.class, "LT-FIELD");
        for (int index = batchStart; index <= batchEnd; index++) {
            Client client = entityManager.getReference(Client.class, resolveClientId(index, random));
            LocalDateTime registeredAt = LocalDateTime.of(2025, 1, 1, 8, 0).plusHours(index % 8760L);
            int parcelCount = index % 4 == 0 ? 2 : 1;
            BigDecimal shippingFee = BigDecimal.valueOf(150 + random.nextInt(850));
            Shipment shipment = new Shipment(String.format("SHP-LT-%08d", index), client, "Synthetic Recipient " + index,
                    (index % 200) + " Test Street, Load Test City", "0918" + String.format("%07d", index), parcelCount,
                    ChargeModel.FLAT, shippingFee, BigDecimal.ZERO, shippingFee, false, RegisteredVia.DESKTOP_OFFICE);
            shipment.setDescription("Synthetic load-test shipment");
            shipment.setRoute(index % 5 == 0 ? "Metro to TNL" : "Regional collection route");
            shipment.setDateRegistered(registeredAt);
            entityManager.persist(shipment);
            for (int parcelSequence = 1; parcelSequence <= parcelCount; parcelSequence++) {
                seedParcel(shipment, index, parcelSequence, registeredAt, officeUser, fieldUser, random);
            }
            if (index % 2 == 0) {
                Payment payment = new Payment(shipment, index % 6 == 0 ? shippingFee.divide(BigDecimal.valueOf(2)) : shippingFee,
                        PaymentMethod.CASH, registeredAt.toLocalDate(), officeUser, "Synthetic load-test payment");
                payment.setReferenceNo("LT-PAY-" + index);
                entityManager.persist(payment);
            }
        }
        entityManager.flush();
        entityManager.clear();
    }

    private void seedParcel(Shipment shipment, int shipmentIndex, int parcelSequence, LocalDateTime registeredAt,
            AppUser officeUser, AppUser fieldUser, Random random) {
        ParcelStatus finalStatus = TRACKING_STATES.get(random.nextInt(TRACKING_STATES.size()));
        ParcelUnit parcel = new ParcelUnit(String.format("TRK-LT-%08d-%02d", shipmentIndex, parcelSequence), shipment, parcelSequence,
                BigDecimal.valueOf(1 + random.nextInt(20)), BigDecimal.valueOf(20 + random.nextInt(50)),
                BigDecimal.valueOf(20 + random.nextInt(50)), BigDecimal.valueOf(20 + random.nextInt(50)),
                BigDecimal.valueOf(0.02 + random.nextDouble() / 10));
        parcel.setCurrentStatus(finalStatus);
        parcel.setLabelStatus(LabelStatus.values()[random.nextInt(LabelStatus.values().length)]);
        if (parcel.getLabelStatus() == LabelStatus.REPRINTED) parcel.setReprintCount(1 + random.nextInt(3));
        Vehicle vehicle = null;
        if (finalStatus == ParcelStatus.LOADED_ON_TRUCK) {
            vehicle = entityManager.getReference(Vehicle.class, vehicleId(shipmentIndex));
            parcel.setCurrentVehicle(vehicle);
        }
        entityManager.persist(parcel);
        for (int statusIndex = 0; statusIndex <= TRACKING_STATES.indexOf(finalStatus); statusIndex++) {
            ParcelStatus status = TRACKING_STATES.get(statusIndex);
            Vehicle eventVehicle = status == ParcelStatus.LOADED_ON_TRUCK ? vehicle != null ? vehicle
                    : entityManager.getReference(Vehicle.class, vehicleId(shipmentIndex)) : null;
            TrackingEvent event = new TrackingEvent(parcel, status, eventVehicle, statusIndex < 2 ? officeUser : fieldUser, "Synthetic load-test event");
            event.setEventTimestamp(registeredAt.plusMinutes(statusIndex * 20L));
            event.setScanSource("LOADTEST");
            entityManager.persist(event);
        }
    }

    private String resolveClientId(int shipmentIndex, Random random) {
        int clientNumber = shipmentIndex % 10 < 6 ? 1 + shipmentIndex % 50 : 51 + random.nextInt(CLIENT_COUNT - 50);
        return String.format("LT-CL-%04d", clientNumber);
    }

    private String vehicleId(int shipmentIndex) {
        return String.format("LT-VH-%03d", 1 + shipmentIndex % VEHICLE_COUNT);
    }
}
