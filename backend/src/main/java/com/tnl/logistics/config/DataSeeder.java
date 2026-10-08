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
    private static final String SEEDED_STAFF_MOBILE_PIN = "1111";
    private static final String LEGACY_HAULER_USERNAME = "hauler1";
    private static final String LEGACY_HAULER_PASSWORD = "field123";
    private static final String SEEDED_HAULER_USERNAME = "hauler";
    private static final String SEEDED_HAULER_PASSWORD = "hauler123";

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
    private final SystemSettingRepository systemSettingRepository;
    private final WaybillReturnScanRepository waybillReturnScanRepository;
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
                      SystemSettingRepository systemSettingRepository,
                      WaybillReturnScanRepository waybillReturnScanRepository,
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
        this.systemSettingRepository = systemSettingRepository;
        this.waybillReturnScanRepository = waybillReturnScanRepository;
        this.passwordEncoder = passwordEncoder;
        this.environment = environment;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (seedMobilePins && environment.acceptsProfiles(Profiles.of("prod"))) {
            throw new IllegalStateException("app.seed.mobile-pins must not be enabled in production");
        }
        boolean shouldSeedWorkflow = seedWorkflowFixtures || (seedSampleData && environment.acceptsProfiles(Profiles.of("dev", "workflow")));
        if (shouldSeedWorkflow && environment.acceptsProfiles(Profiles.of("prod"))) {
            throw new IllegalStateException("app.seed.workflow-fixtures must not be enabled in production");
        }
        if (!shouldSeedWorkflow) {
            seedTestProfileFoundation();
            return;
        }
        seedWorkflowSystemSettings();
        if (!seedSampleData) return;
        if (seedAdmin) seedUser("U-001", "admin", "admin123", "Maria Santos", UserRole.ADMIN, null, null, null);

        String staffMobilePin = seedMobilePins ? SEEDED_STAFF_MOBILE_PIN : null;
        AppUser office = seedUser("U-002", "office", "office123", "Receiving Staff", UserRole.RECEIVING_STAFF, null, null, staffMobilePin);
        AppUser courier = seedUser("U-003", "field", "field123", "Carlos Mendoza", UserRole.COURIER_STAFF, StaffType.INTERNAL_TRUCK, null, staffMobilePin);
        AppUser hauler = seedHaulerUser("U-004", "Rogelio Aquino", "Northbound Hauling", staffMobilePin);
        AppUser hauler2 = seedUser("U-005", "hauler2", "field123", "Danilo Cruz", UserRole.DISPATCH_STAFF, StaffType.HAULER_STAFF, "Cordillera Freight", staffMobilePin);

        List<Client> clients = List.of(
                seedClient("CL-001", "Northbridge Trading", "Unit 402, Trade Tower, Binondo, Manila", "0917-555-0148", "orders@northbridge.ph", ChargeModel.PER_PARCEL, new BigDecimal("35.00")),
                seedClient("CL-002", "Sunrise Hardware", "88 Rizal St., Baguio City", "0918-555-0022", "acctg@sunrisehw.ph"),
                seedClient("CL-003", "Metro Fashion House", "Session Road, Baguio City", "0999-555-0099", "metro@fashionhouse.ph", ChargeModel.PER_PARCEL, new BigDecimal("40.00")),
                seedClient("CL-004", "Delacruz General Merchandise", "Magsaysay Ave, Baguio City", "0920-555-0077", null),
                seedClient("CL-005", "Cordillera Highlands Produce", "KM 5 La Trinidad, Benguet", "0928-555-0333", "cordillera@produce.ph", ChargeModel.PER_PARCEL, new BigDecimal("38.00")));
        Vehicle truck = seedVehicle("VH-001", "NCP-2401", "TNL line-haul vehicle");
        Vehicle reserveTruck = seedVehicle("VH-002", "NCP-2402", "TNL reserve vehicle");

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
        seedAdvancedWorkflowShipments(year, clients, office, courier, hauler, hauler2, truck, reserveTruck);
    }

    private void seedWorkflowSystemSettings() {
        var existingSetting = systemSettingRepository.findById(SystemSetting.DEFAULT_SETTING_ID);
        SystemSetting setting = existingSetting.orElseGet(SystemSetting::new);
        boolean hasChanges = existingSetting.isEmpty();

        if (setting.getVolumetricDivisor() == null) {
            setting.setVolumetricDivisor(3500);
            hasChanges = true;
        } else if (environment.acceptsProfiles(Profiles.of("dev", "workflow")) && setting.getVolumetricDivisor() == 5000) {
            setting.setVolumetricDivisor(3500);
            hasChanges = true;
        }
        if (setting.getRatePerKilo() == null) {
            setting.setRatePerKilo(new BigDecimal("45.00"));
            hasChanges = true;
        }
        if (setting.getSoaBankName() == null || setting.getSoaBankName().isBlank()) {
            setting.setSoaBankName("BDO Unibank");
            hasChanges = true;
        }
        if (setting.getSoaAccountName() == null || setting.getSoaAccountName().isBlank()) {
            setting.setSoaAccountName("TNL Workflow Demo");
            hasChanges = true;
        }
        if (setting.getSoaAccountNumber() == null || setting.getSoaAccountNumber().isBlank()) {
            setting.setSoaAccountNumber("000000000000");
            hasChanges = true;
        }

        if (hasChanges) {
            systemSettingRepository.save(setting);
        }
    }

    private void seedWorkflowSoaBankDetails() {
        seedWorkflowSystemSettings();
    }

    private void seedTestProfileFoundation() {
        if (!environment.acceptsProfiles(Profiles.of("test")) || !seedSampleData) return;

        seedUser("USR-ADMIN", "admin", "admin123", "Admin User", UserRole.ADMIN, null, null, null);
        String staffMobilePin = seedMobilePins ? SEEDED_STAFF_MOBILE_PIN : null;
        seedUser("USR-OFFICE", "office", "office123", "Receiving Staff", UserRole.RECEIVING_STAFF, null, null, staffMobilePin);
        seedUser("USR-FIELD", "field", "field123", "Carlos Mendoza", UserRole.COURIER_STAFF, StaffType.INTERNAL_TRUCK, null, staffMobilePin);
        seedHaulerUser("USR-HAULER", "Rogelio Aquino", "Northbound Hauling", staffMobilePin);
        seedUser("USR-HAULER2", "hauler2", "field123", "Danilo Cruz", UserRole.DISPATCH_STAFF, StaffType.HAULER_STAFF, "Cordillera Freight", staffMobilePin);
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

    private AppUser seedHaulerUser(String id, String fullName, String haulerCompany, String pin) {
        AppUser haulerUser = seedUser(id, SEEDED_HAULER_USERNAME, SEEDED_HAULER_PASSWORD, fullName,
                UserRole.DISPATCH_STAFF, StaffType.HAULER_STAFF, haulerCompany, pin);
        boolean hasUpdatedLegacyCredentials = false;
        if (LEGACY_HAULER_USERNAME.equals(haulerUser.getUsername())) {
            haulerUser.setUsername(SEEDED_HAULER_USERNAME);
            hasUpdatedLegacyCredentials = true;
        }
        if (passwordEncoder.matches(LEGACY_HAULER_PASSWORD, haulerUser.getPasswordHash())) {
            haulerUser.setPasswordHash(passwordEncoder.encode(SEEDED_HAULER_PASSWORD));
            hasUpdatedLegacyCredentials = true;
        }
        return hasUpdatedLegacyCredentials ? appUserRepository.save(haulerUser) : haulerUser;
    }

    private Client seedClient(String id, String name, String address, String contact, String email, ChargeModel defaultRateType, BigDecimal ratePerKilo) {
        Client client = clientRepository.findById(id).orElseGet(() -> new Client(id, name, address, contact, email));
        boolean hasChanges = false;
        if (!name.equals(client.getName())) { client.setName(name); hasChanges = true; }
        if (!address.equals(client.getAddress())) { client.setAddress(address); hasChanges = true; }
        if (!contact.equals(client.getContactNumber())) { client.setContactNumber(contact); hasChanges = true; }
        if (email != null && !email.equals(client.getEmail())) { client.setEmail(email); hasChanges = true; }
        if (defaultRateType != null && client.getDefaultRateType() != defaultRateType) { client.setDefaultRateType(defaultRateType); hasChanges = true; }
        if (ratePerKilo != null && (client.getRatePerKilo() == null || client.getRatePerKilo().compareTo(ratePerKilo) != 0)) { client.setRatePerKilo(ratePerKilo); hasChanges = true; }
        return (hasChanges || client.getCreatedAt() == null) ? clientRepository.save(client) : client;
    }

    private Client seedClient(String id, String name, String address, String contact, String email) {
        return seedClient(id, name, address, contact, email, ChargeModel.FLAT, null);
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
        Waybill waybill = waybillRepository.findById(waybillId).orElse(null);
        if (waybill != null) {
            List<ParcelUnit> existingUnits = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipment.getShipmentId());
            for (ParcelUnit unit : existingUnits) {
                if (unit.getWaybill() == null) unit.setWaybill(waybill);
            }
            parcelUnitRepository.saveAll(existingUnits);
            return;
        }
        waybill = new Waybill(waybillId, shipment, office, "Northbound Hauling");
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
        List<ParcelUnit> manifestUnits = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipment.getShipmentId());
        for (ParcelUnit unit : manifestUnits) {
            if (unit.getWaybill() == null) unit.setWaybill(waybill);
        }
        parcelUnitRepository.saveAll(manifestUnits);
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

    private void seedAdvancedWorkflowShipments(int year, List<Client> clients, AppUser office, AppUser courier, AppUser hauler, AppUser hauler2, Vehicle truck, Vehicle reserveTruck) {
        seedMultiParcelShipment7(year, clients.get(0), office);
        seedMultiParcelShipment8(year, clients.get(2), office, courier, hauler);
        seedMultiParcelShipment9(year, clients.get(1), office, courier, hauler, truck);
        seedMultiParcelShipment10(year, clients.get(4), office, courier, hauler2, reserveTruck);
        seedMultiParcelShipment11(year, clients.get(0), office, courier, hauler, truck);
        seedMultiParcelShipment12(year, clients.get(3), office, courier, hauler2, reserveTruck);
    }

    private void seedMultiParcelShipment7(int year, Client client, AppUser office) {
        String shipmentId = String.format("SHP-%d-007", year);
        if (shipmentRepository.existsById(shipmentId)) return;

        LocalDateTime registeredAt = LocalDate.now(ZoneOffset.UTC).minusDays(1).atTime(10, 30);
        Shipment shipment = new Shipment(shipmentId, client, "Highland Retailers Hub", "Baguio City", "0917-000-0007", 3,
                ChargeModel.PER_PARCEL, new BigDecimal("1242.50"), BigDecimal.ZERO, new BigDecimal("1242.50"), false, RegisteredVia.DESKTOP_OFFICE);
        shipment.setDescription("Workflow fixture 7 - Multi-unit registered shipment with unprinted labels");
        shipment.setRoute("Manila to TNL Baguio");
        shipment.setAppliedRatePerKilo(new BigDecimal("35.00"));
        shipment.setAppliedVolumetricDivisor(3500);
        shipment.setTotalActualWeight(new BigDecimal("35.50"));
        shipment.setTotalVolumetricWeight(new BigDecimal("30.71"));
        shipment.setBillableWeight(new BigDecimal("35.50"));
        shipment.setDateRegistered(registeredAt);
        shipment = shipmentRepository.saveAndFlush(shipment);

        List<ParcelUnit> parcels = List.of(
                new ParcelUnit(String.format("TRK-%d-000007", year), shipment, 1, new BigDecimal("12.00"), new BigDecimal("40.00"), new BigDecimal("25.00"), new BigDecimal("30.00"), new BigDecimal("0.0300")),
                new ParcelUnit(String.format("TRK-%d-000008", year), shipment, 2, new BigDecimal("8.50"), new BigDecimal("35.00"), new BigDecimal("20.00"), new BigDecimal("25.00"), new BigDecimal("0.0175")),
                new ParcelUnit(String.format("TRK-%d-000009", year), shipment, 3, new BigDecimal("15.00"), new BigDecimal("50.00"), new BigDecimal("30.00"), new BigDecimal("40.00"), new BigDecimal("0.0600"))
        );
        for (ParcelUnit parcel : parcels) {
            parcel.setCurrentStatus(ParcelStatus.REGISTERED);
            parcel.setLabelStatus(LabelStatus.NOT_PRINTED);
            parcelUnitRepository.save(parcel);

            TrackingEvent event = new TrackingEvent(parcel, ParcelStatus.REGISTERED, null, office, "Workflow fixture REGISTERED");
            event.setEventTimestamp(registeredAt);
            trackingEventRepository.save(event);
        }
    }

    private void seedMultiParcelShipment8(int year, Client client, AppUser office, AppUser courier, AppUser hauler) {
        String shipmentId = String.format("SHP-%d-008", year);
        if (shipmentRepository.existsById(shipmentId)) return;

        LocalDateTime registeredAt = LocalDate.now(ZoneOffset.UTC).minusDays(2).atTime(9, 15);
        Shipment shipment = new Shipment(shipmentId, client, "Session Boutique Manila Express", "Baguio City", "0917-000-0008", 5,
                ChargeModel.PER_PARCEL, new BigDecimal("1240.00"), BigDecimal.ZERO, new BigDecimal("1240.00"), true, RegisteredVia.DESKTOP_OFFICE);
        shipment.setDescription("Workflow fixture 8 - Available loading & Rapid Batch generation");
        shipment.setRoute("Manila to TNL Baguio");
        shipment.setAppliedRatePerKilo(new BigDecimal("40.00"));
        shipment.setAppliedVolumetricDivisor(3500);
        shipment.setTotalActualWeight(new BigDecimal("31.00"));
        shipment.setTotalVolumetricWeight(new BigDecimal("25.14"));
        shipment.setBillableWeight(new BigDecimal("31.00"));
        shipment.setDateRegistered(registeredAt);
        shipment = shipmentRepository.saveAndFlush(shipment);

        List<ParcelUnit> parcels = List.of(
                new ParcelUnit(String.format("TRK-%d-000010", year), shipment, 1, new BigDecimal("5.00"), new BigDecimal("30.00"), new BigDecimal("15.00"), new BigDecimal("20.00"), new BigDecimal("0.0090")),
                new ParcelUnit(String.format("TRK-%d-000011", year), shipment, 2, new BigDecimal("6.00"), new BigDecimal("35.00"), new BigDecimal("20.00"), new BigDecimal("25.00"), new BigDecimal("0.0175")),
                new ParcelUnit(String.format("TRK-%d-000012", year), shipment, 3, new BigDecimal("4.50"), new BigDecimal("25.00"), new BigDecimal("15.00"), new BigDecimal("20.00"), new BigDecimal("0.0075")),
                new ParcelUnit(String.format("TRK-%d-000013", year), shipment, 4, new BigDecimal("8.00"), new BigDecimal("40.00"), new BigDecimal("25.00"), new BigDecimal("30.00"), new BigDecimal("0.0300")),
                new ParcelUnit(String.format("TRK-%d-000014", year), shipment, 5, new BigDecimal("7.50"), new BigDecimal("40.00"), new BigDecimal("20.00"), new BigDecimal("30.00"), new BigDecimal("0.0240"))
        );
        for (int i = 0; i < parcels.size(); i++) {
            ParcelUnit parcel = parcels.get(i);
            ParcelStatus finalStatus = i < 3 ? ParcelStatus.LOADED_TO_HAULER : ParcelStatus.ARRIVED_AT_TNL;
            parcel.setCurrentStatus(finalStatus);
            parcel.setLabelStatus(LabelStatus.PRINTED);
            parcelUnitRepository.save(parcel);

            seedTrackingHistory(parcel, finalStatus, registeredAt, office, courier, hauler, null);
            seedPrintHistory(parcel, shipment, LabelStatus.PRINTED, registeredAt, office);
        }
        seedPayment(shipment, new BigDecimal("1240.00"), registeredAt.toLocalDate(), office);
    }

    private void seedMultiParcelShipment9(int year, Client client, AppUser office, AppUser courier, AppUser hauler, Vehicle truck) {
        String shipmentId = String.format("SHP-%d-009", year);
        if (shipmentRepository.existsById(shipmentId)) return;

        LocalDateTime registeredAt = LocalDate.now(ZoneOffset.UTC).minusDays(3).atTime(11, 0);
        Shipment unsaved = new Shipment(shipmentId, client, "Baguio Summit Hardware", "Baguio City", "0917-000-0009", 4,
                ChargeModel.FLAT, new BigDecimal("1800.00"), BigDecimal.ZERO, new BigDecimal("1800.00"), false, RegisteredVia.DESKTOP_OFFICE);
        unsaved.setDescription("Workflow fixture 9 - Waybill printing test fixture");
        unsaved.setRoute("Manila to TNL Baguio");
        unsaved.setDateRegistered(registeredAt);
        final Shipment shipment = shipmentRepository.saveAndFlush(unsaved);

        List<ParcelUnit> parcels = List.of(
                new ParcelUnit(String.format("TRK-%d-000015", year), shipment, 1, new BigDecimal("20.00"), new BigDecimal("50.00"), new BigDecimal("30.00"), new BigDecimal("40.00"), new BigDecimal("0.0600")),
                new ParcelUnit(String.format("TRK-%d-000016", year), shipment, 2, new BigDecimal("18.00"), new BigDecimal("45.00"), new BigDecimal("30.00"), new BigDecimal("35.00"), new BigDecimal("0.0473")),
                new ParcelUnit(String.format("TRK-%d-000017", year), shipment, 3, new BigDecimal("15.00"), new BigDecimal("40.00"), new BigDecimal("25.00"), new BigDecimal("30.00"), new BigDecimal("0.0300")),
                new ParcelUnit(String.format("TRK-%d-000018", year), shipment, 4, new BigDecimal("22.00"), new BigDecimal("55.00"), new BigDecimal("35.00"), new BigDecimal("45.00"), new BigDecimal("0.0866"))
        );
        for (ParcelUnit parcel : parcels) {
            parcel.setCurrentStatus(ParcelStatus.LOADED_TO_HAULER);
            parcel.setLabelStatus(LabelStatus.PRINTED);
            parcelUnitRepository.save(parcel);

            seedTrackingHistory(parcel, ParcelStatus.LOADED_TO_HAULER, registeredAt, office, courier, hauler, truck);
            seedPrintHistory(parcel, shipment, LabelStatus.PRINTED, registeredAt, office);
        }
        seedPayment(shipment, new BigDecimal("900.00"), registeredAt.toLocalDate(), office);

        String waybillId = String.format("WYB-%d-%04d", year, 7);
        Waybill waybill = waybillRepository.findById(waybillId).orElseGet(() -> {
            Waybill w = new Waybill(waybillId, shipment, hauler, "Northbound Hauling");
            w.setDriverName("Rogelio Aquino");
            w.setDriverContact("0917-555-1004");
            w.setVehiclePlate("NCP-2401");
            w.setStatus(WaybillStatus.GENERATED);
            w.setRemarks("Fragile hardware items - handle with care. Gate 2 delivery.");
            return waybillRepository.save(w);
        });
        for (ParcelUnit parcel : parcels) {
            parcel.setWaybill(waybill);
        }
        parcelUnitRepository.saveAll(parcels);
    }

    private void seedMultiParcelShipment10(int year, Client client, AppUser office, AppUser courier, AppUser hauler2, Vehicle reserveTruck) {
        String shipmentId = String.format("SHP-%d-010", year);
        if (shipmentRepository.existsById(shipmentId)) return;

        LocalDateTime registeredAt = LocalDate.now(ZoneOffset.UTC).minusDays(2).atTime(8, 0);
        Shipment unsaved = new Shipment(shipmentId, client, "Benguet Fresh Mart", "La Trinidad, Benguet", "0917-000-0010", 3,
                ChargeModel.PER_PARCEL, new BigDecimal("1140.00"), BigDecimal.ZERO, new BigDecimal("1140.00"), true, RegisteredVia.DESKTOP_OFFICE);
        unsaved.setDescription("Workflow fixture 10 - Returned waybill recommendation rail");
        unsaved.setRoute("Manila to La Trinidad Hub");
        unsaved.setAppliedRatePerKilo(new BigDecimal("38.00"));
        unsaved.setAppliedVolumetricDivisor(3500);
        unsaved.setTotalActualWeight(new BigDecimal("30.00"));
        unsaved.setTotalVolumetricWeight(new BigDecimal("20.37"));
        unsaved.setBillableWeight(new BigDecimal("30.00"));
        unsaved.setDateRegistered(registeredAt);
        final Shipment shipment = shipmentRepository.saveAndFlush(unsaved);

        List<ParcelUnit> parcels = List.of(
                new ParcelUnit(String.format("TRK-%d-000019", year), shipment, 1, new BigDecimal("10.00"), new BigDecimal("35.00"), new BigDecimal("25.00"), new BigDecimal("30.00"), new BigDecimal("0.0263")),
                new ParcelUnit(String.format("TRK-%d-000020", year), shipment, 2, new BigDecimal("12.00"), new BigDecimal("40.00"), new BigDecimal("25.00"), new BigDecimal("30.00"), new BigDecimal("0.0300")),
                new ParcelUnit(String.format("TRK-%d-000021", year), shipment, 3, new BigDecimal("8.00"), new BigDecimal("30.00"), new BigDecimal("20.00"), new BigDecimal("25.00"), new BigDecimal("0.0150"))
        );
        for (ParcelUnit parcel : parcels) {
            parcel.setCurrentStatus(ParcelStatus.LOADED_TO_HAULER);
            parcel.setLabelStatus(LabelStatus.PRINTED);
            parcelUnitRepository.save(parcel);

            seedTrackingHistory(parcel, ParcelStatus.LOADED_TO_HAULER, registeredAt, office, courier, hauler2, reserveTruck);
            seedPrintHistory(parcel, shipment, LabelStatus.PRINTED, registeredAt, office);
        }
        seedPayment(shipment, new BigDecimal("1140.00"), registeredAt.toLocalDate(), office);

        String waybillId = String.format("WYB-%d-%04d", year, 8);
        Waybill waybill = waybillRepository.findById(waybillId).orElseGet(() -> {
            Waybill w = new Waybill(waybillId, shipment, hauler2, "Cordillera Freight");
            w.setDriverName("Danilo Cruz");
            w.setDriverContact("0920-555-1005");
            w.setVehiclePlate("NCP-2402");
            w.setStatus(WaybillStatus.SENT_TO_HAULER);
            w.setSentBy(hauler2);
            w.setDispatchedAt(registeredAt.plusHours(6));
            w.setRemarks("Perishable produce - priority transit.");
            return waybillRepository.save(w);
        });
        for (ParcelUnit parcel : parcels) {
            parcel.setWaybill(waybill);
        }
        parcelUnitRepository.saveAll(parcels);
    }

    private void seedMultiParcelShipment11(int year, Client client, AppUser office, AppUser courier, AppUser hauler, Vehicle truck) {
        String shipmentId = String.format("SHP-%d-011", year);
        if (shipmentRepository.existsById(shipmentId)) return;

        LocalDateTime registeredAt = LocalDate.now(ZoneOffset.UTC).minusDays(1).atTime(13, 30);
        Shipment unsaved = new Shipment(shipmentId, client, "Mountain View General Store", "Baguio City", "0917-000-0011", 2,
                ChargeModel.PER_PARCEL, new BigDecimal("700.00"), BigDecimal.ZERO, new BigDecimal("700.00"), true, RegisteredVia.DESKTOP_OFFICE);
        unsaved.setDescription("Workflow fixture 11 - Returned waybill recent options rail");
        unsaved.setRoute("Manila to TNL Baguio");
        unsaved.setAppliedRatePerKilo(new BigDecimal("35.00"));
        unsaved.setAppliedVolumetricDivisor(3500);
        unsaved.setTotalActualWeight(new BigDecimal("20.00"));
        unsaved.setTotalVolumetricWeight(new BigDecimal("13.57"));
        unsaved.setBillableWeight(new BigDecimal("20.00"));
        unsaved.setDateRegistered(registeredAt);
        final Shipment shipment = shipmentRepository.saveAndFlush(unsaved);

        List<ParcelUnit> parcels = List.of(
                new ParcelUnit(String.format("TRK-%d-000022", year), shipment, 1, new BigDecimal("9.00"), new BigDecimal("35.00"), new BigDecimal("20.00"), new BigDecimal("25.00"), new BigDecimal("0.0175")),
                new ParcelUnit(String.format("TRK-%d-000023", year), shipment, 2, new BigDecimal("11.00"), new BigDecimal("40.00"), new BigDecimal("25.00"), new BigDecimal("30.00"), new BigDecimal("0.0300"))
        );
        for (ParcelUnit parcel : parcels) {
            parcel.setCurrentStatus(ParcelStatus.LOADED_TO_HAULER);
            parcel.setLabelStatus(LabelStatus.PRINTED);
            parcelUnitRepository.save(parcel);

            seedTrackingHistory(parcel, ParcelStatus.LOADED_TO_HAULER, registeredAt, office, courier, hauler, truck);
            seedPrintHistory(parcel, shipment, LabelStatus.PRINTED, registeredAt, office);
        }
        seedPayment(shipment, new BigDecimal("700.00"), registeredAt.toLocalDate(), office);

        String waybillId = String.format("WYB-%d-%04d", year, 9);
        Waybill waybill = waybillRepository.findById(waybillId).orElseGet(() -> {
            Waybill w = new Waybill(waybillId, shipment, hauler, "Northbound Hauling");
            w.setDriverName("Rogelio Aquino");
            w.setDriverContact("0917-555-1004");
            w.setVehiclePlate("NCP-2401");
            w.setStatus(WaybillStatus.SENT_TO_HAULER);
            w.setSentBy(hauler);
            w.setDispatchedAt(registeredAt.plusHours(4));
            w.setRemarks("Standard delivery - check invoice upon handover.");
            return waybillRepository.save(w);
        });
        for (ParcelUnit parcel : parcels) {
            parcel.setWaybill(waybill);
        }
        parcelUnitRepository.saveAll(parcels);
    }

    private void seedMultiParcelShipment12(int year, Client client, AppUser office, AppUser courier, AppUser hauler2, Vehicle reserveTruck) {
        String shipmentId = String.format("SHP-%d-012", year);
        if (shipmentRepository.existsById(shipmentId)) return;

        LocalDateTime registeredAt = LocalDate.now(ZoneOffset.UTC).minusDays(3).atTime(9, 0);
        Shipment unsaved = new Shipment(shipmentId, client, "La Trinidad Commercial Center", "La Trinidad, Benguet", "0917-000-0012", 4,
                ChargeModel.FLAT, new BigDecimal("1600.00"), BigDecimal.ZERO, new BigDecimal("1600.00"), true, RegisteredVia.DESKTOP_OFFICE);
        unsaved.setDescription("Workflow fixture 12 - Split waybill partial completion (2/4 Completed)");
        unsaved.setRoute("Manila to La Trinidad Hub");
        unsaved.setDateRegistered(registeredAt);
        final Shipment shipment = shipmentRepository.saveAndFlush(unsaved);

        List<ParcelUnit> parcels = List.of(
                new ParcelUnit(String.format("TRK-%d-000024", year), shipment, 1, new BigDecimal("10.00"), new BigDecimal("35.00"), new BigDecimal("25.00"), new BigDecimal("30.00"), new BigDecimal("0.0263")),
                new ParcelUnit(String.format("TRK-%d-000025", year), shipment, 2, new BigDecimal("10.00"), new BigDecimal("35.00"), new BigDecimal("25.00"), new BigDecimal("30.00"), new BigDecimal("0.0263")),
                new ParcelUnit(String.format("TRK-%d-000026", year), shipment, 3, new BigDecimal("10.00"), new BigDecimal("35.00"), new BigDecimal("25.00"), new BigDecimal("30.00"), new BigDecimal("0.0263")),
                new ParcelUnit(String.format("TRK-%d-000027", year), shipment, 4, new BigDecimal("10.00"), new BigDecimal("35.00"), new BigDecimal("25.00"), new BigDecimal("30.00"), new BigDecimal("0.0263"))
        );
        for (int i = 0; i < parcels.size(); i++) {
            ParcelUnit parcel = parcels.get(i);
            ParcelStatus finalStatus = i < 2 ? ParcelStatus.COMPLETED : ParcelStatus.LOADED_TO_HAULER;
            parcel.setCurrentStatus(finalStatus);
            parcel.setLabelStatus(LabelStatus.PRINTED);
            parcelUnitRepository.save(parcel);

            seedTrackingHistory(parcel, finalStatus, registeredAt, office, courier, hauler2, reserveTruck);
            seedPrintHistory(parcel, shipment, LabelStatus.PRINTED, registeredAt, office);
        }
        seedPayment(shipment, new BigDecimal("1600.00"), registeredAt.toLocalDate(), office);

        // Split Waybill A: WYB-%d-0010 (SIGNED_COMPLETED, Units 24 & 25)
        String waybill10Id = String.format("WYB-%d-%04d", year, 10);
        Waybill waybill10 = waybillRepository.findById(waybill10Id).orElseGet(() -> {
            Waybill w = new Waybill(waybill10Id, shipment, hauler2, "Cordillera Freight");
            w.setDriverName("Danilo Cruz");
            w.setDriverContact("0920-555-1005");
            w.setVehiclePlate("NCP-2402");
            w.setStatus(WaybillStatus.SIGNED_COMPLETED);
            w.setSentBy(hauler2);
            w.setDispatchedAt(registeredAt.plusHours(4));
            w.setCompletedBy(hauler2);
            w.setSignedBy("Juan Dela Cruz");
            w.setSignedAt(registeredAt.plusDays(2));
            w.setRemarks("Batch A delivered and signed.");
            return waybillRepository.save(w);
        });
        parcels.get(0).setWaybill(waybill10);
        parcels.get(1).setWaybill(waybill10);

        if (waybillReturnScanRepository != null) {
            for (int i = 0; i < 2; i++) {
                ParcelUnit p = parcels.get(i);
                if (!waybillReturnScanRepository.existsByWaybill_WaybillIdAndParcel_TrackingId(waybill10Id, p.getTrackingId())) {
                    waybillReturnScanRepository.save(new WaybillReturnScan(waybill10, p, hauler2));
                }
            }
        }

        // Split Waybill B: WYB-%d-0011 (SENT_TO_HAULER, Units 26 & 27)
        String waybill11Id = String.format("WYB-%d-%04d", year, 11);
        Waybill waybill11 = waybillRepository.findById(waybill11Id).orElseGet(() -> {
            Waybill w = new Waybill(waybill11Id, shipment, hauler2, "Cordillera Freight");
            w.setDriverName("Danilo Cruz");
            w.setDriverContact("0920-555-1005");
            w.setVehiclePlate("NCP-2402");
            w.setStatus(WaybillStatus.SENT_TO_HAULER);
            w.setSentBy(hauler2);
            w.setDispatchedAt(registeredAt.plusDays(1).plusHours(2));
            w.setRemarks("Batch B in transit.");
            return waybillRepository.save(w);
        });
        parcels.get(2).setWaybill(waybill11);
        parcels.get(3).setWaybill(waybill11);

        parcelUnitRepository.saveAll(parcels);
    }

    private record WorkflowFixture(int sequence, Client client, String recipient, ParcelStatus status, LabelStatus labelStatus, BigDecimal total, BigDecimal paid, WaybillStatus waybillStatus) {
    }
}
