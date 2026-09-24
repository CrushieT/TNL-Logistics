package com.tnl.logistics.config;

import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;

/** Seeds an opt-in, production-shaped development fixture set. */
@Component
public class DataSeeder implements CommandLineRunner {
    private final AppUserRepository appUserRepository;
    private final ClientRepository clientRepository;
    private final VehicleRepository vehicleRepository;
    private final ShipmentRepository shipmentRepository;
    private final ParcelUnitRepository parcelUnitRepository;
    private final TrackingEventRepository trackingEventRepository;
    private final PaymentRepository paymentRepository;
    private final PrintAuditJobRepository printAuditJobRepository;
    private final PrintEventRepository printEventRepository;
    private final WaybillRepository waybillRepository;
    private final WeeklyCollectionRepository weeklyCollectionRepository;
    private final SoaRepository soaRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final Environment environment;

    @org.springframework.beans.factory.annotation.Value("${app.seed.admin:false}")
    private boolean seedAdmin;
    @org.springframework.beans.factory.annotation.Value("${app.seed.sample-data:false}")
    private boolean seedSampleData;
    @org.springframework.beans.factory.annotation.Value("${app.seed.workflow-fixtures:false}")
    private boolean seedWorkflowFixtures;
    @org.springframework.beans.factory.annotation.Value("${app.seed.mobile-pins:false}")
    private boolean seedMobilePins;

    public DataSeeder(AppUserRepository appUserRepository, ClientRepository clientRepository,
                      VehicleRepository vehicleRepository, ShipmentRepository shipmentRepository,
                      ParcelUnitRepository parcelUnitRepository, TrackingEventRepository trackingEventRepository,
                      PaymentRepository paymentRepository, PrintAuditJobRepository printAuditJobRepository,
                      PrintEventRepository printEventRepository, WaybillRepository waybillRepository,
                      WeeklyCollectionRepository weeklyCollectionRepository, SoaRepository soaRepository,
                      BCryptPasswordEncoder passwordEncoder, Environment environment) {
        this.appUserRepository = appUserRepository;
        this.clientRepository = clientRepository;
        this.vehicleRepository = vehicleRepository;
        this.shipmentRepository = shipmentRepository;
        this.parcelUnitRepository = parcelUnitRepository;
        this.trackingEventRepository = trackingEventRepository;
        this.paymentRepository = paymentRepository;
        this.printAuditJobRepository = printAuditJobRepository;
        this.printEventRepository = printEventRepository;
        this.waybillRepository = waybillRepository;
        this.weeklyCollectionRepository = weeklyCollectionRepository;
        this.soaRepository = soaRepository;
        this.passwordEncoder = passwordEncoder;
        this.environment = environment;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (seedMobilePins && environment.acceptsProfiles(Profiles.of("prod"))) {
            throw new IllegalStateException("app.seed.mobile-pins must not be enabled in production");
        }
        if (!seedWorkflowFixtures) {
            seedTestProfileFoundation();
            return;
        }
        if (!seedSampleData) return;
        if (seedAdmin) seedUser("U-001", "admin", "admin123", "Maria Santos", UserRole.ADMIN, null, null, seedMobilePins ? "1111" : null);

        AppUser office = seedUser("U-002", "office", "office123", "Office Staff", UserRole.OFFICE_STAFF, null, null, seedMobilePins ? "2222" : null);
        AppUser courier = seedUser("U-003", "field", "field123", "Carlos Mendoza", UserRole.FIELD_STAFF, StaffType.INTERNAL_TRUCK, null, seedMobilePins ? "0001" : null);
        AppUser hauler = seedUser("U-004", "hauler1", "field123", "Rogelio Aquino", UserRole.FIELD_STAFF, StaffType.HAULER_STAFF, "Northbound Hauling", null);
        seedUser("U-005", "hauler2", "field123", "Danilo Cruz", UserRole.FIELD_STAFF, StaffType.HAULER_STAFF, "Cordillera Freight", null);

        List<Client> clients = List.of(
                seedClient("CL-001", "Northbridge Trading", "Unit 402, Trade Tower, Binondo, Manila", "0917-555-0148", "orders@northbridge.ph"),
                seedClient("CL-002", "Sunrise Hardware", "88 Rizal St., Baguio City", "0918-555-0022", "acctg@sunrisehw.ph"),
                seedClient("CL-003", "Metro Fashion House", "Session Road, Baguio City", "0999-555-0099", "metro@fashionhouse.ph"),
                seedClient("CL-004", "Delacruz General Merchandise", "Magsaysay Ave, Baguio City", "0920-555-0077", null));
        Vehicle truck = seedVehicle("VH-001", "NCP-2401", "TNL line-haul vehicle");
        seedVehicle("VH-002", "NCP-2402", "TNL reserve vehicle");

        int year = LocalDate.now(ZoneOffset.UTC).getYear();
        List<WorkflowFixture> fixtures = List.of(
                new WorkflowFixture(1, clients.get(0), "Baguio Central Mart", ParcelStatus.QR_GENERATED, LabelStatus.NOT_PRINTED, new BigDecimal("350.00"), BigDecimal.ZERO, null),
                new WorkflowFixture(2, clients.get(1), "Cordillera Builders Supply", ParcelStatus.LOADED_ON_TRUCK, LabelStatus.PRINTED, new BigDecimal("550.00"), new BigDecimal("275.00"), null),
                new WorkflowFixture(3, clients.get(2), "Pine Valley Boutique", ParcelStatus.ARRIVED_AT_TNL, LabelStatus.REPRINTED, new BigDecimal("420.00"), new BigDecimal("420.00"), null),
                new WorkflowFixture(4, clients.get(3), "Camp 7 General Store", ParcelStatus.LOADED_TO_HAULER, LabelStatus.PRINTED, new BigDecimal("600.00"), BigDecimal.ZERO, WaybillStatus.GENERATED),
                new WorkflowFixture(5, clients.get(0), "Highland Retailers Hub", ParcelStatus.LOADED_TO_HAULER, LabelStatus.PRINTED, new BigDecimal("300.00"), new BigDecimal("300.00"), WaybillStatus.SENT_TO_HAULER),
                new WorkflowFixture(6, clients.get(1), "Baguio Electrical Supply", ParcelStatus.COMPLETED, LabelStatus.REPRINTED, new BigDecimal("500.00"), new BigDecimal("500.00"), WaybillStatus.SIGNED_COMPLETED));

        Shipment collectionShipment = null;
        for (WorkflowFixture fixture : fixtures) {
            Shipment shipment = seedWorkflowShipment(year, fixture, office, courier, hauler, truck);
            if (fixture.sequence() == 4) collectionShipment = shipment;
        }
        if (collectionShipment != null) seedCollectionFixture(collectionShipment, office);
    }

    private void seedTestProfileFoundation() {
        if (!environment.acceptsProfiles(Profiles.of("test")) || !seedSampleData) return;

        seedUser("USR-ADMIN", "admin", "admin123", "Admin User", UserRole.ADMIN, null, null, seedMobilePins ? "1111" : null);
        seedUser("USR-OFFICE", "office", "office123", "Office Staff", UserRole.OFFICE_STAFF, null, null, seedMobilePins ? "2222" : null);
        seedUser("USR-FIELD", "field", "field123", "Carlos Mendoza", UserRole.FIELD_STAFF, StaffType.INTERNAL_TRUCK, null, seedMobilePins ? "0001" : null);
        seedUser("USR-HAULER", "hauler1", "field123", "Rogelio Aquino", UserRole.FIELD_STAFF, StaffType.HAULER_STAFF, "Northbound Hauling", null);
        seedUser("USR-HAULER2", "hauler2", "field123", "Danilo Cruz", UserRole.FIELD_STAFF, StaffType.HAULER_STAFF, "Cordillera Freight", null);
        seedClient("CL-001", "Acme Logistics Client", "Manila", "09170000000", "client@acme.com");
        seedVehicle("VH-001", "NCP-2401", "TNL line-haul vehicle");
        seedVehicle("VH-002", "NCP-2402", "TNL reserve vehicle");
    }

    private AppUser seedUser(String id, String username, String password, String fullName, UserRole role, StaffType type, String haulerCompany, String pin) {
        AppUser existingUser = appUserRepository.findById(id)
                .or(() -> appUserRepository.findByUsername(username))
                .orElse(null);
        if (existingUser != null) {
            existingUser.setMustChangePassword(false);
            existingUser.setTokenVersion(1);
            if (pin != null && (existingUser.getPinHash() == null || existingUser.getPinHash().isBlank())) {
                existingUser.setPinHash(passwordEncoder.encode(pin));
            }
            return appUserRepository.save(existingUser);
        }
        return appUserRepository.findByUsername(username).orElseGet(() -> {
            AppUser user = new AppUser(id, username, passwordEncoder.encode(password), fullName, role, type, haulerCompany);
            user.setMustChangePassword(false);
            user.setTokenVersion(1);
            if (pin != null) user.setPinHash(passwordEncoder.encode(pin));
            return appUserRepository.save(user);
        });
    }

    private Client seedClient(String id, String name, String address, String contact, String email) {
        return clientRepository.findById(id).orElseGet(() -> clientRepository.save(new Client(id, name, address, contact, email)));
    }

    private Vehicle seedVehicle(String id, String plate, String description) {
        return vehicleRepository.findById(id).orElseGet(() -> vehicleRepository.save(new Vehicle(id, plate, description)));
    }

    private Shipment seedWorkflowShipment(int year, WorkflowFixture fixture, AppUser office, AppUser courier, AppUser hauler, Vehicle truck) {
        String shipmentId = String.format("SHP-%d-%03d", year, fixture.sequence());
        String trackingId = String.format("TRK-%d-%06d", year, fixture.sequence());
        Shipment existing = shipmentRepository.findById(shipmentId).orElse(null);
        if (existing != null) return existing;

        LocalDateTime registeredAt = LocalDate.now(ZoneOffset.UTC).minusDays(7L - fixture.sequence()).atTime(9, 0);
        Shipment shipment = new Shipment(shipmentId, fixture.client(), fixture.recipient(), "Baguio City", "0917-000-000" + fixture.sequence(), 1,
                ChargeModel.FLAT, fixture.total(), BigDecimal.ZERO, fixture.total(), false, RegisteredVia.DESKTOP_OFFICE);
        shipment.setDescription("Workflow fixture " + fixture.sequence());
        shipment.setRoute("Manila to TNL Baguio");
        shipment.setDateRegistered(registeredAt);
        shipment = shipmentRepository.saveAndFlush(shipment);

        ParcelUnit parcel = new ParcelUnit(trackingId, shipment, 1, new BigDecimal("10.00"), new BigDecimal("40.00"), new BigDecimal("30.00"), new BigDecimal("25.00"), new BigDecimal("0.0300"));
        parcel.setCurrentStatus(fixture.status());
        parcel.setLabelStatus(fixture.labelStatus());
        parcel.setReprintCount(fixture.labelStatus() == LabelStatus.REPRINTED ? 1 : 0);
        if (fixture.status() == ParcelStatus.LOADED_ON_TRUCK) parcel.setCurrentVehicle(truck);
        parcel = parcelUnitRepository.saveAndFlush(parcel);

        seedTrackingHistory(parcel, fixture.status(), registeredAt, office, courier, hauler, truck);
        seedPrintHistory(parcel, shipment, fixture.labelStatus(), registeredAt, office);
        seedPayment(shipment, fixture.paid(), registeredAt.toLocalDate(), office);
        if (fixture.waybillStatus() != null) seedWaybill(year, fixture.sequence(), shipment, office, fixture.waybillStatus(), registeredAt.plusHours(6));
        return shipment;
    }

    private void seedTrackingHistory(ParcelUnit parcel, ParcelStatus finalStatus, LocalDateTime startedAt, AppUser office, AppUser courier, AppUser hauler, Vehicle truck) {
        List<ParcelStatus> statuses = List.of(ParcelStatus.REGISTERED, ParcelStatus.QR_GENERATED, ParcelStatus.LOADED_ON_TRUCK, ParcelStatus.ARRIVED_AT_TNL, ParcelStatus.LOADED_TO_HAULER, ParcelStatus.COMPLETED);
        for (int index = 0; index <= statuses.indexOf(finalStatus); index++) {
            ParcelStatus status = statuses.get(index);
            AppUser actor = status == ParcelStatus.REGISTERED || status == ParcelStatus.QR_GENERATED || status == ParcelStatus.COMPLETED ? office : status == ParcelStatus.LOADED_TO_HAULER ? hauler : courier;
            TrackingEvent event = new TrackingEvent(parcel, status, status == ParcelStatus.LOADED_ON_TRUCK ? truck : null, actor, "Workflow fixture " + status.name());
            event.setEventTimestamp(startedAt.plusMinutes(index * 15L));
            event.setScanSource("ONLINE");
            trackingEventRepository.save(event);
        }
    }

    private void seedPrintHistory(ParcelUnit parcel, Shipment shipment, LabelStatus status, LocalDateTime printedAt, AppUser office) {
        if (status == LabelStatus.NOT_PRINTED) return;
        PrintAuditJob job = createPrintJob(shipment, parcel.getTrackingId(), "print", office);
        printAuditJobRepository.save(job);
        PrintEvent print = new PrintEvent(parcel, PrintKind.PRINT, 1, office, "SYSTEM-PDF", job);
        print.setPrintTimestamp(printedAt.plusMinutes(5));
        printEventRepository.save(print);
        if (status == LabelStatus.REPRINTED) {
            PrintAuditJob reprintJob = createPrintJob(shipment, parcel.getTrackingId(), "reprint", office);
            printAuditJobRepository.save(reprintJob);
            PrintEvent reprint = new PrintEvent(parcel, PrintKind.REPRINT, 1, office, "SYSTEM-PDF", reprintJob);
            reprint.setPrintTimestamp(printedAt.plusMinutes(10));
            printEventRepository.save(reprint);
        }
    }

    private PrintAuditJob createPrintJob(Shipment shipment, String trackingId, String action, AppUser office) {
        String jobId = UUID.nameUUIDFromBytes(("workflow-" + action + "-" + trackingId).getBytes(StandardCharsets.UTF_8)).toString();
        return new PrintAuditJob(jobId, shipment, office, "SYSTEM-PDF", "0".repeat(64));
    }

    private void seedPayment(Shipment shipment, BigDecimal paid, LocalDate date, AppUser office) {
        if (paid.signum() == 0) return;
        Payment payment = new Payment(shipment, paid, PaymentMethod.BANK, date, office, "Workflow fixture payment");
        payment.setReferenceNo("WF-" + shipment.getShipmentId());
        paymentRepository.save(payment);
    }

    private void seedWaybill(int year, int sequence, Shipment shipment, AppUser office, WaybillStatus status, LocalDateTime timestamp) {
        String waybillId = String.format("WYB-%d-%04d", year, sequence);
        if (waybillRepository.existsById(waybillId)) return;
        Waybill waybill = new Waybill(waybillId, shipment, office, "Northbound Hauling");
        waybill.setDriverName("Rogelio Aquino");
        waybill.setDriverContact("0917-555-1004");
        waybill.setVehiclePlate("NCP-2401");
        waybill.setStatus(status);
        if (status != WaybillStatus.GENERATED) waybill.setDispatchedAt(timestamp);
        if (status == WaybillStatus.SIGNED_COMPLETED) {
            waybill.setSignedBy(shipment.getRecipientName());
            waybill.setSignedAt(timestamp.plusDays(1));
        }
        waybillRepository.save(waybill);
    }

    private void seedCollectionFixture(Shipment shipment, AppUser office) {
        LocalDate collectionDate = LocalDate.now(ZoneOffset.UTC).with(TemporalAdjusters.previousOrSame(DayOfWeek.THURSDAY));
        String collectionId = "COL-" + shipment.getClient().getClientId() + "-" + collectionDate;
        WeeklyCollection collection = weeklyCollectionRepository.findById(collectionId).orElseGet(() -> weeklyCollectionRepository.save(new WeeklyCollection(
                collectionId, shipment.getClient(), collectionDate.minusDays(6), collectionDate, shipment.getTotalAmount(), BigDecimal.ZERO, shipment.getTotalAmount(), "FOR_COLLECTION")));
        String soaNo = String.format("SOA-%d-%s-W%02d", collectionDate.getYear(), shipment.getClient().getClientId().replace("CL-", ""), collectionDate.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR));
        if (!soaRepository.existsById(soaNo)) soaRepository.save(new Soa(soaNo, null, collection, shipment.getClient(), BigDecimal.ZERO, shipment.getTotalAmount(), BigDecimal.ZERO, null, BigDecimal.ZERO, shipment.getTotalAmount(), office.getFullName(), collectionDate, null));
        shipment.setStatementId(soaNo);
        shipmentRepository.save(shipment);
    }

    private record WorkflowFixture(int sequence, Client client, String recipient, ParcelStatus status, LabelStatus labelStatus, BigDecimal total, BigDecimal paid, WaybillStatus waybillStatus) {
    }
}
