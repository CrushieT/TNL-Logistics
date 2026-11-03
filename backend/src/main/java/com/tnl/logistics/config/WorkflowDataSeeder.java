package com.tnl.logistics.config;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.*;
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
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Creates current workflow scenarios once, without resetting subsequent manual testing. */
@Component
@Profile("workflow")
public class WorkflowDataSeeder implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(WorkflowDataSeeder.class);
    private static final String SEED_MARKER_CLIENT = "CL-WF-001";
    private static final List<String> STAFF_NAMES = List.of(
            "Maria Teresa Santos", "Elena Navarro", "Carlos Mendoza", "Rogelio Aquino", "Danilo Cruz",
            "Patricia Reyes", "Miguel Bautista", "Isabel Ramos", "Adrian Flores", "Joel Mercado",
            "Liza Villanueva", "Marco Salazar", "Anna Marquez", "Paolo Reyes", "Camille Dizon",
            "Raymond Garcia", "Nicole Castillo", "Martin Soriano", "Angela Lim", "Jerome Padilla",
            "Bianca Torres", "Kevin Cruz", "Andrea Mendoza", "Vincent Lopez", "Sofia Domingo", "Gabriel Tan");
    private static final List<String> CLIENT_NAMES = List.of(
            "Northbridge Trading", "Sunrise Hardware", "Metro Fashion House", "Delacruz General Merchandise",
            "Cordillera Highlands Produce", "Bicol Home Essentials", "San Isidro Agricultural Supply",
            "Mariposa Pharmacy", "Camalig Construction Depot", "Vista Verde Office Supplies",
            "Riverton Auto Parts", "Alameda Kitchenware", "Golden Grain Food Trading", "Luntian Garden Center",
            "Santa Elena Textiles", "Blue Harbor Electronics", "Maple Leaf School Supplies",
            "San Rafael Medical Supplies", "Eastgate Furniture Depot", "Cedar Valley Farm Products",
            "Bayanihan General Store",
            "Pacific Highlands Industrial Equipment, Agricultural Supplies and Regional Distribution Services Cooperative for Northern Luzon and Bicol Provinces Co",
            "Sierra Vista Wholesale", "Mabuhay Houseware Trading", "Orchard Lane Gift Shop", "Riverbend Apparel");
    private static final List<String> DELIVERY_ADDRESSES = List.of(
            "18 Mabini Street, Barangay Centro, Labo, Camarines Norte",
            "42 Rizal Avenue, Barangay II, Daet, Camarines Norte",
            "7 Narra Street, Barangay Poblacion, Talisay, Camarines Norte",
            "26 Quezon Street, Barangay Poblacion, Vinzons, Camarines Norte",
            "15 Sampaguita Road, Barangay San Roque, Mercedes, Camarines Norte",
            "31 Bonifacio Street, Barangay Poblacion, Capalonga, Camarines Norte");
    private static final List<String> CARGO_DESCRIPTIONS = List.of(
            "Boxed notebooks and printer paper", "Canned goods and bottled cooking oil",
            "PVC fittings and plumbing valves", "Cotton shirts and school uniforms",
            "Replacement filters and motor oil", "Medical gloves and sealed first-aid kits",
            "Stainless cookware and serving utensils", "Garden hoses and seedling trays");
    private final EntityManager entityManager;
    private final ShipmentService shipmentService;
    private final TrackingService trackingService;
    private final WaybillService waybillService;
    private final ParcelExceptionService exceptionService;
    private final PaymentService paymentService;
    private final SoaService soaService;
    private final CollectionsService collectionsService;
    private final SystemSettingService systemSettingService;
    private final BCryptPasswordEncoder passwordEncoder;
    private final Validator validator;
    private final Environment environment;
    private final boolean enabled;

    public WorkflowDataSeeder(EntityManager entityManager, ShipmentService shipmentService,
            TrackingService trackingService, WaybillService waybillService, ParcelExceptionService exceptionService,
            PaymentService paymentService, SoaService soaService, CollectionsService collectionsService,
            SystemSettingService systemSettingService, BCryptPasswordEncoder passwordEncoder, Validator validator, Environment environment,
            @Value("${app.seed.workflow-fixtures:false}") boolean enabled) {
        this.entityManager = entityManager;
        this.shipmentService = shipmentService;
        this.trackingService = trackingService;
        this.waybillService = waybillService;
        this.exceptionService = exceptionService;
        this.paymentService = paymentService;
        this.soaService = soaService;
        this.collectionsService = collectionsService;
        this.systemSettingService = systemSettingService;
        this.passwordEncoder = passwordEncoder;
        this.validator = validator;
        this.environment = environment;
        this.enabled = enabled;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (!enabled) return;
        if (environment.acceptsProfiles(Profiles.of("prod"))) {
            throw new IllegalStateException("Workflow fixtures must not be enabled in production");
        }
        if (entityManager.find(Client.class, SEED_MARKER_CLIENT) != null) {
            log.info("Workflow fixtures already exist; preserving manual testing changes");
            return;
        }
        seedFoundation();
        seedOperationalScenarios();
        seedFinancialScenarios();
        seedPaginationScenarios();
        entityManager.flush();
        log.info("Created current workflow fixtures with fictional staff, clients, and cargo records");
    }

    private void seedFoundation() {
        SystemSetting settings = entityManager.find(SystemSetting.class, SystemSetting.DEFAULT_SETTING_ID);
        if (settings == null) {
            settings = new SystemSetting();
            entityManager.persist(settings);
        }
        settings.setCompanyName("TC & CT Integrated Logistics");
        settings.setVolumetricDivisor(3500);
        settings.setRatePerKilo(new BigDecimal("45.00"));
        settings.setSoaBankName("Banco de Sierra");
        settings.setSoaAccountName("TC & CT Integrated Logistics");
        settings.setSoaAccountNumber("000000000000");

        seedUser("U-001", "admin", "admin123", UserRole.ADMIN, false, false, true);
        seedUser("U-002", "office", "office123", UserRole.RECEIVING_STAFF, true, false, true);
        seedUser("U-003", "field", "field123", UserRole.COURIER_STAFF, true, false, true);
        seedUser("U-004", "hauler", "hauler123", UserRole.DISPATCH_STAFF, true, false, true);
        seedUser("U-005", "hauler2", "field123", UserRole.DISPATCH_STAFF, true, false, true);
        seedUser("U-006", "receiving2", "workflow123", UserRole.RECEIVING_STAFF, true, false, true);
        seedUser("U-007", "courier2", "workflow123", UserRole.COURIER_STAFF, true, false, true);
        seedUser("U-008", "onboarding", "workflow123", UserRole.RECEIVING_STAFF, false, true, true);
        seedUser("U-009", "nopin", "workflow123", UserRole.RECEIVING_STAFF, false, false, true);
        seedUser("U-010", "disabled", "workflow123", UserRole.COURIER_STAFF, true, false, false);
        seedUser("U-011", "bound", "workflow123", UserRole.RECEIVING_STAFF, true, false, true);
        seedUser("U-012", "revoked", "workflow123", UserRole.RECEIVING_STAFF, true, false, true);
        for (int index = 13; index <= 26; index++) {
            seedUser(String.format("U-%03d", index), "receiving" + index, "workflow123",
                    UserRole.RECEIVING_STAFF, true, false, true);
        }
        for (int index = 11; index <= 12; index++) {
            String deviceId = "workflow-device-" + index;
            if (entityManager.createQuery("select count(binding) from MobileDeviceBinding binding where binding.deviceId = :id", Long.class)
                    .setParameter("id", deviceId).getSingleResult() == 0) {
                MobileDeviceBinding binding = new MobileDeviceBinding(deviceId, String.format("U-%03d", index), "0".repeat(64));
                binding.setDeviceName(index == 11 ? "Liza's Samsung Galaxy A15" : "Marco's Redmi Note 13");
                binding.setActive(index == 11);
                entityManager.persist(binding);
            }
        }
        for (int index = 1; index <= 26; index++) {
            String id = clientId(index);
            if (entityManager.find(Client.class, id) != null) continue;
            String name = CLIENT_NAMES.get(index - 1);
            String emailName = name.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]", "");
            Client client = new Client(id, name, DELIVERY_ADDRESSES.get((index - 1) % DELIVERY_ADDRESSES.size()),
                    String.format("0917%07d", index), index == 4 ? null : "orders@" + emailName.substring(0, Math.min(30, emailName.length())) + ".example.test");
            client.setDefaultRateType(index % 2 == 0 ? ChargeModel.FLAT : ChargeModel.PER_PARCEL);
            if (index % 2 == 1) client.setRatePerKilo(new BigDecimal(index == 1 ? "35.00" : "40.00"));
            client.setActive(index != 26);
            entityManager.persist(client);
        }
        for (int index = 1; index <= 25; index++) {
            String id = String.format("VH-WF-%03d", index);
            if (entityManager.find(Vehicle.class, id) != null) continue;
            entityManager.persist(new Vehicle(id, "NGA-" + (6100 + index),
                    index % 2 == 0 ? "10-Wheeler Wing Van" : "6-Wheeler Forward",
                    index % 2 == 0 ? "Hino wing van cargo truck" : "Isuzu Forward delivery truck",
                    index >= 24 ? "Inactive" : "Active",
                    index >= 24 ? "Scheduled for preventive maintenance" : "Assigned to the Camarines Norte delivery route"));
        }
        entityManager.flush();
        systemSettingService.refreshCachedSettings();
    }

    private void seedUser(String id, String username, String password, UserRole role,
            boolean hasPin, boolean mustChangePassword, boolean isActive) {
        if (entityManager.find(AppUser.class, id) != null) return;
        AppUser user = new AppUser(id, username, passwordEncoder.encode(password), STAFF_NAMES.get(Integer.parseInt(id.substring(2)) - 1), role);
        user.setMustChangePassword(mustChangePassword);
        user.setActive(isActive);
        if (hasPin) user.setPinHash(passwordEncoder.encode("1111"));
        entityManager.persist(user);
    }

    private void seedOperationalScenarios() {
        LocalDate today = LocalDate.now();
        createShipment("WF01 Office stationery and printer paper", 1, 1, false, today, false);
        Shipment printed = createShipment("WF02 PVC pipes and galvanized fittings", 2, 2, false, today, false);
        print(printed, "first", trackingIds(printed));
        Shipment reprinted = createShipment("WF03 Replacement filters and electrical components", 1, 2, false, today, false);
        print(reprinted, "first", trackingIds(reprinted));
        print(reprinted, "second", trackingIds(reprinted));
        pay(reprinted, reprinted.getTotalAmount().divide(new BigDecimal("2"), 2, RoundingMode.HALF_UP), PaymentMethod.GCASH);
        prepared("WF04 Bagged rice and cooking oil", 2, 3, ParcelStatus.LOADED_ON_TRUCK);
        prepared("WF05 Cotton shirts and school uniforms", 3, 3, ParcelStatus.ARRIVED_AT_TNL, true);
        prepared("WF06 Roofing screws, sealants and hand tools", 1, 4, ParcelStatus.LOADED_TO_HAULER);
        Shipment generated = prepared("WF07 Circuit breakers and insulated copper wire", 2, 3, ParcelStatus.LOADED_TO_HAULER);
        manifest(generated, trackingIds(generated), "generated", false);
        Shipment sent = prepared("WF08 Blouses, trousers and textile rolls", 3, 3, ParcelStatus.LOADED_TO_HAULER);
        manifest(sent, trackingIds(sent), "sent", true);
        Shipment delivered = prepared("WF09 Industrial switches and extension cables", 2, 3, ParcelStatus.LOADED_TO_HAULER);
        Waybill closed = manifest(delivered, trackingIds(delivered), "closed", true);
        complete(closed);
        pay(delivered, delivered.getTotalAmount(), PaymentMethod.BANK);
        entityManager.persist(new WaybillReturnScan(closed, entityManager.find(ParcelUnit.class, trackingIds(delivered).getFirst()),
                entityManager.find(AppUser.class, dispatchActor(delivered))));

        Shipment split = prepared("WF10 Store fixtures and modular display shelves", 4, 5, ParcelStatus.LOADED_TO_HAULER);
        List<String> splitIds = trackingIds(split);
        complete(manifest(split, splitIds.subList(0, 2), "first", true));
        manifest(split, splitIds.subList(2, 4), "second", true);
        Shipment lostFresh = createShipment("WF11 Ballpoint pens and filing folders", 1, 1, false, today, false);
        changeLoss(trackingIds(lostFresh).getFirst(), true, "Reported missing before loading");
        Shipment lostTruck = prepared("WF12 Ceramic tiles and grouting compound", 2, 1, ParcelStatus.LOADED_ON_TRUCK);
        changeLoss(trackingIds(lostTruck).getFirst(), true, "Missing during line-haul inventory");
        Shipment lostArrived = prepared("WF13 Household linens and curtains", 3, 2, ParcelStatus.ARRIVED_AT_TNL);
        changeLoss(trackingIds(lostArrived).getFirst(), true, "Missing during receiving count");
        pay(lostArrived, new BigDecimal("100.00"), PaymentMethod.CHEQUE);

        seedLossManifest("WF14 Impact drill sets and masonry bits", false, false, false);
        seedLossManifest("WF15 Stainless cookware and serving utensils", true, false, false);
        seedLossManifest("WF16 Glass display panels and aluminum frames", true, true, false);
        seedLossManifest("WF17 LED lamps and ceiling light fittings", false, false, true);
        seedLossManifest("WF18 Plumbing valves and bathroom accessories", true, false, true);
        seedLossManifest("WF19 Boxed hand tools and measuring equipment", true, true, true);

        Shipment restored = prepared("WF20 Assorted notebooks and school bags", 4, 2, ParcelStatus.ARRIVED_AT_TNL);
        String restoredId = trackingIds(restored).getFirst();
        changeLoss(restoredId, true, "Temporarily missing in receiving area");
        changeLoss(restoredId, false, "Recovered during warehouse recount");
        Shipment reopened = prepared("WF21 Hardware cartons and replacement brackets", 4, 2, ParcelStatus.LOADED_TO_HAULER);
        Waybill reopenedManifest = manifest(reopened, trackingIds(reopened), "reopened", true);
        for (String id : trackingIds(reopened)) changeLoss(id, true, "All manifest parcels reported missing");
        closeAllLost(reopenedManifest);
        changeLoss(trackingIds(reopened).getFirst(), false, "Recovered after administrative closure");

        Shipment mixedLabels = createShipment("WF22 Packaging tape and corrugated cartons", 1, 3, false, today, false);
        print(mixedLabels, "selected", trackingIds(mixedLabels).subList(0, 2));
        Shipment boundary = createShipment("WF23 Heavy-duty warehouse shelving brackets, stainless fasteners and packing supplies for the local Daet branch delivery",
                1, 2, false, today, false);
        boundary.setRecipientAddress("Building 17, Warehouse District, Barangay San Antonio, Quezon City, Metro Manila");
        boundary.setRoute("Manila to TNL Labo C.N. via Quezon City distribution warehouse");
        createShipment("WF24 Lightweight plastic storage bins and foam organizers", 2, 2, true, today, true);
        Shipment direct = prepared("WF25 Fresh fruit crates and insulated produce boxes", 5, 1, ParcelStatus.COMPLETED);
        pay(direct, direct.getTotalAmount(), PaymentMethod.OTHER);
    }

    private Shipment prepared(String scenario, int client, int quantity, ParcelStatus target) {
        return prepared(scenario, client, quantity, target, false);
    }

    private Shipment prepared(String scenario, int client, int quantity, ParcelStatus target, boolean isPaid) {
        Shipment shipment = createShipment(scenario, client, quantity, isPaid, LocalDate.now(), false);
        print(shipment, "first", trackingIds(shipment));
        for (ParcelStatus status : List.of(ParcelStatus.LOADED_ON_TRUCK, ParcelStatus.ARRIVED_AT_TNL,
                ParcelStatus.LOADED_TO_HAULER, ParcelStatus.COMPLETED)) {
            boolean isCourierStep = status == ParcelStatus.LOADED_ON_TRUCK;
            String actor = isCourierStep ? (client % 2 == 0 ? "U-007" : "U-003") : dispatchActor(shipment);
            trackingService.processBatchScan(new BatchTrackingScanRequest(trackingIds(shipment), status,
                    status == ParcelStatus.LOADED_ON_TRUCK ? "VH-WF-001" : null, "Cargo count verified"), actor);
            if (status == target) break;
        }
        return shipment;
    }

    private Shipment createShipment(String scenario, int client, int quantity, boolean isPaid,
            LocalDate date, boolean isVolumetric) {
        ShipmentCalculationSettingsResponse pricing = shipmentService.getCalculationSettings(clientId(client));
        List<ParcelUnitRequest> units = new ArrayList<>();
        for (int index = 1; index <= quantity; index++) {
            units.add(new ParcelUnitRequest(index, new BigDecimal(isVolumetric ? "1.00" : String.valueOf(8 + index)),
                    new BigDecimal(isVolumetric ? "60.00" : "30.00"), new BigDecimal("25.00"), new BigDecimal("20.00")));
        }
        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId(clientId(client));
        Client billingClient = entityManager.find(Client.class, clientId(client));
        request.setRecipientAddress(billingClient.getAddress());
        request.setRecipientContact(billingClient.getContactNumber());
        request.setDescription(scenario);
        request.setRoute("Manila to TNL Labo C.N.");
        request.setQuantity(quantity);
        request.setParcels(units);
        request.setOtherCharges(isVolumetric ? new BigDecimal("49.85") : BigDecimal.ZERO);
        request.setPaidAtRegistration(isPaid);
        request.setRegisteredVia(client % 2 == 0 ? RegisteredVia.DESKTOP_OFFICE : RegisteredVia.MOBILE_FIELD);
        request.setExpectedRatePerKilo(pricing.getRatePerKilo());
        request.setExpectedVolumetricDivisor(pricing.getVolumetricDivisor());
        if (!validator.validate(request).isEmpty()) throw new IllegalStateException("Invalid workflow shipment: " + scenario);
        String registrar = client % 2 == 0 ? "U-006" : "U-002";
        ShipmentResponse response = shipmentService.registerShipment(request, registrar);
        Shipment shipment = entityManager.find(Shipment.class, response.getShipmentId());
        if (!date.equals(LocalDate.now())) {
            LocalDateTime registrationTime = date.atTime(9, 0);
            entityManager.flush();
            entityManager.createNativeQuery("UPDATE shipment SET date_registered = :timestamp, business_registration_date = :busDate WHERE shipment_id = :id")
                    .setParameter("timestamp", registrationTime).setParameter("busDate", date).setParameter("id", shipment.getShipmentId()).executeUpdate();
            entityManager.refresh(shipment);
            for (String trackingId : response.getTrackingIds()) {
                List<TrackingEvent> events = entityManager.createQuery(
                        "select event from TrackingEvent event where event.parcelUnit.trackingId = :id", TrackingEvent.class)
                        .setParameter("id", trackingId).getResultList();
                for (TrackingEvent event : events) {
                    entityManager.createNativeQuery("UPDATE tracking_event SET event_timestamp = :timestamp WHERE event_id = :id")
                            .setParameter("timestamp", registrationTime.plusSeconds(event.getStatus() == ParcelStatus.QR_GENERATED ? 1 : 0))
                            .setParameter("id", event.getEventId()).executeUpdate();
                    entityManager.refresh(event);
                }
            }
        }
        return shipment;
    }

    private List<String> trackingIds(Shipment shipment) {
        return entityManager.createQuery("select parcel.trackingId from ParcelUnit parcel where parcel.shipment.shipmentId = :id order by parcel.seq", String.class)
                .setParameter("id", shipment.getShipmentId()).getResultList();
    }

    private void print(Shipment shipment, String action, List<String> ids) {
        UUID jobId = UUID.nameUUIDFromBytes(("workflow:" + shipment.getShipmentId() + ":" + action).getBytes(StandardCharsets.UTF_8));
        shipmentService.recordLabelPrint(jobId, shipment.getShipmentId(), ids, "U-002", "XP470B-RECEIVING");
    }

    private void pay(Shipment shipment, BigDecimal amount, PaymentMethod method) {
        String referencePrefix = switch (method) {
            case CASH -> "OR-";
            case BANK -> "BT-";
            case GCASH -> "GC-";
            case CHEQUE -> "CHK-";
            case OTHER -> "ADJ-";
        };
        paymentService.recordPayment(new PaymentRecordRequest(shipment.getShipmentId(), amount, method,
                referencePrefix + shipment.getShipmentId(), shipment.getDateRegistered().toLocalDate(), "Delivery charge payment received"), "U-002");
    }

    private Waybill manifest(Shipment shipment, List<String> ids, String key, boolean shouldSend) {
        WaybillGenerationRequest request = new WaybillGenerationRequest();
        request.setShipmentId(shipment.getShipmentId());
        request.setTrackingIds(ids);
        request.setIdempotencyKey("workflow-" + shipment.getShipmentId() + "-" + key);
        String actor = dispatchActor(shipment);
        boolean isSecondDispatcher = actor.equals("U-005");
        request.setHaulerName(isSecondDispatcher ? "Sierra Norte Freight Services" : "Camino Real Transport");
        request.setDriverName(entityManager.find(AppUser.class, actor).getFullName());
        request.setDriverContact(isSecondDispatcher ? "09175551005" : "09175551004");
        request.setVehiclePlate(entityManager.find(Vehicle.class, isSecondDispatcher ? "VH-WF-002" : "VH-WF-001").getPlateNumber());
        request.setRemarks("Deliver to receiving bay; call consignee on arrival");
        String id = waybillService.generate(request, actor).getWaybillId();
        if (shouldSend) waybillService.sendToHauler(id, actor);
        return entityManager.find(Waybill.class, id);
    }

    private void complete(Waybill waybill) {
        WaybillStatusUpdateRequest request = new WaybillStatusUpdateRequest();
        request.setConfirmedWaybillId(waybill.getWaybillId());
        request.setManifestRevision(waybill.getManifestRevision());
        request.setSignedBy(dispatchActor(waybill.getShipment()).equals("U-005") ? "Roberto De Leon" : "Marlene Villanueva");
        request.setRemarks("Goods received and signed delivery copy returned");
        waybillService.markSignedCompleted(waybill.getWaybillId(), request, dispatchActor(waybill.getShipment()));
    }

    private String dispatchActor(Shipment shipment) {
        return shipment.getClient().getClientId().endsWith("2") || shipment.getClient().getClientId().endsWith("4") ? "U-005" : "U-004";
    }

    private void changeLoss(String trackingId, boolean isLost, String reason) {
        entityManager.flush();
        ParcelUnit parcel = entityManager.find(ParcelUnit.class, trackingId);
        exceptionService.changeLoss(trackingId, isLost, new ParcelExceptionRequest(reason, parcel.getRevision(), UUID.randomUUID().toString()), "U-001");
    }

    private void closeAllLost(Waybill waybill) {
        exceptionService.closeAllLost(waybill.getWaybillId(), new ParcelExceptionRequest(
                "All parcels confirmed lost after inventory review", waybill.getManifestRevision(), UUID.randomUUID().toString()), "U-001");
    }

    private void seedLossManifest(String scenario, boolean shouldSend, boolean shouldClose, boolean isAllLost) {
        Shipment shipment = prepared(scenario, 4, 3, ParcelStatus.LOADED_TO_HAULER);
        List<String> ids = trackingIds(shipment);
        Waybill waybill = manifest(shipment, ids, "loss", shouldSend);
        for (String id : isAllLost ? ids : ids.subList(0, 1)) changeLoss(id, true, "Parcel missing during manifest inventory check");
        if (shouldClose) {
            if (isAllLost) closeAllLost(waybill); else complete(waybill);
        }
    }

    private void seedFinancialScenarios() {
        LocalDate cycle = collectionsService.calculateActiveCycleDate(LocalDate.now());
        for (int cycleIndex = 2; cycleIndex >= 0; cycleIndex--) {
            LocalDate closingDate = cycle.minusWeeks(cycleIndex);
            LocalDate registrationDate = closingDate.minusDays(2).isAfter(LocalDate.now()) ? LocalDate.now() : closingDate.minusDays(2);
            for (int index = 1; index <= (cycleIndex == 0 ? 18 : 3); index++) {
                Shipment due = createShipment("FIN-DUE-" + cycleIndex + "-" + index + " " + CARGO_DESCRIPTIONS.get((index - 1) % CARGO_DESCRIPTIONS.size()), 23, 1, false, registrationDate, false);
                if (index % 2 == 0) pay(due, new BigDecimal("100.00"), PaymentMethod.GCASH);
                Shipment paid = createShipment("FIN-PAID-" + cycleIndex + "-" + index + " " + CARGO_DESCRIPTIONS.get(index % CARGO_DESCRIPTIONS.size()), 24, 1, false, registrationDate, false);
                pay(paid, paid.getTotalAmount(), index % 2 == 0 ? PaymentMethod.CHEQUE : PaymentMethod.BANK);
            }
            soaService.saveStatement(new SaveStatementRequest(clientId(23), closingDate, new BigDecimal("25.00"),
                    "Credit for damaged packaging", entityManager.find(AppUser.class, "U-002").getFullName()), "U-001");
            soaService.saveStatement(new SaveStatementRequest(clientId(24), closingDate, BigDecimal.ZERO, null, entityManager.find(AppUser.class, "U-002").getFullName()), "U-001");
        }
        Shipment deduction = createShipment("FIN-DEDUCT Bulk rice cartons and bottled beverages", 6, 1, false, LocalDate.now(), false);
        soaService.saveStatement(new SaveStatementRequest(clientId(6), cycle, deduction.getTotalAmount(),
                "Approved credit for damaged cartons", entityManager.find(AppUser.class, "U-002").getFullName()), "U-001");
        createShipment("FIN-UNBILLED Baking ingredients and disposable food containers", 7, 2, false, LocalDate.now(), false);
        Shipment partial = createShipment("FIN-MULTIPAY Replacement tyres and motorcycle batteries", 8, 2, false, LocalDate.now(), false);
        pay(partial, new BigDecimal("100.00"), PaymentMethod.CASH);
        pay(partial, new BigDecimal("75.00"), PaymentMethod.GCASH);
    }

    private void seedPaginationScenarios() {
        for (int index = 1; index <= 24; index++) {
            Shipment shipment = prepared("PAGE-" + index + " " + CARGO_DESCRIPTIONS.get((index - 1) % CARGO_DESCRIPTIONS.size()), 9 + index % 14, index == 24 ? 18 : 1,
                    ParcelStatus.LOADED_TO_HAULER);
            manifest(shipment, trackingIds(shipment), "page", true);
        }
    }

    private String clientId(int index) {
        return String.format("CL-WF-%03d", index);
    }
}
