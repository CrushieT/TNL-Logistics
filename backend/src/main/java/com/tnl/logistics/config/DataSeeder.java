package com.tnl.logistics.config;

import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.ClientRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.Timestamp;

/**
 * Seeds default accounts, clients, and sample past Thursday cycles on startup.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final ClientRepository clientRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    public DataSeeder(AppUserRepository appUserRepository,
                      ClientRepository clientRepository,
                      BCryptPasswordEncoder passwordEncoder,
                      JdbcTemplate jdbcTemplate) {
        this.appUserRepository = appUserRepository;
        this.clientRepository = clientRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) throws Exception {
        if (appUserRepository.count() == 0) {
            seedUser("USR-ADMIN", "admin", "admin123", "Maria Santos", UserRole.ADMIN, null, null);
            seedUser("USR-OFFICE", "office", "office123", "Office Staff", UserRole.OFFICE_STAFF, null, null);
            seedUser("USR-FIELD", "field", "field123", "Carlos Mendoza", UserRole.FIELD_STAFF, com.tnl.logistics.model.StaffType.INTERNAL_TRUCK, null);
            seedUser("USR-FIELD-2", "hauler1", "field123", "Rogelio Aquino", UserRole.FIELD_STAFF, com.tnl.logistics.model.StaffType.HAULER_STAFF, null);
            seedUser("USR-FIELD-3", "hauler2", "field123", "Danilo Cruz", UserRole.FIELD_STAFF, com.tnl.logistics.model.StaffType.HAULER_STAFF, null);
        }

        if (clientRepository.count() == 0) {
            seedClient("CL-001", "Northbridge Trading", "Unit 402, Trade Tower, Binondo, Manila", "0917-555-0148", "orders@northbridge.ph");
            seedClient("CL-002", "Sunrise Hardware", "88 Rizal St., Baguio City", "0918-555-0022", "acctg@sunrisehw.ph");
            seedClient("CL-003", "Metro Fashion House", "Session Road, Baguio City", "0999-555-0099", "metro@fashionhouse.ph");
            seedClient("CL-004", "Delacruz General Merchandise", "Magsaysay Ave, Baguio City", "0920-555-0077", null);
        }

        seedPastCycleShipments();
    }

    private void seedUser(String id, String username, String rawPassword, String fullName, UserRole role, com.tnl.logistics.model.StaffType staffType, String haulerCompany) {
        if (appUserRepository.findByUsername(username).isEmpty()) {
            AppUser user = new AppUser(
                id,
                username,
                passwordEncoder.encode(rawPassword),
                fullName,
                role,
                staffType,
                haulerCompany
            );
            user.setMustChangePassword(true);
            appUserRepository.save(user);
        }
    }

    private void seedClient(String id, String name, String address, String contactNumber, String email) {
        if (clientRepository.findById(id).isEmpty()) {
            Client client = new Client(id, name, address, contactNumber, email);
            clientRepository.save(client);
        }
    }

    private void seedPastCycleShipments() {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM shipment WHERE shipment_id LIKE 'SHP-SAMPLE-%'",
            Integer.class
        );
        if (count != null && count > 0) {
            return;
        }

        // Ensure clients CL-001 to CL-004 are present before inserting sample shipments
        seedClient("CL-001", "Northbridge Trading", "Unit 402, Trade Tower, Binondo, Manila", "0917-555-0148", "orders@northbridge.ph");
        seedClient("CL-002", "Sunrise Hardware", "88 Rizal St., Baguio City", "0918-555-0022", "acctg@sunrisehw.ph");
        seedClient("CL-003", "Metro Fashion House", "Session Road, Baguio City", "0999-555-0099", "metro@fashionhouse.ph");
        seedClient("CL-004", "Delacruz General Merchandise", "Magsaysay Ave, Baguio City", "0920-555-0077", null);

        // Cycle 1: 2026-08-27
        insertSampleCycle(
            "SHP-SAMPLE-001", "CL-001", "Baguio Central Mart", "12 Session Road, Baguio City", "0917-111-2233",
            "Assorted Dry Goods", 1, new BigDecimal("350.00"), BigDecimal.ZERO, new BigDecimal("350.00"),
            "2026-08-27 10:00:00", "TRK-SAMPLE-001", new BigDecimal("15.50"), new BigDecimal("40.00"),
            new BigDecimal("30.00"), new BigDecimal("25.00"), new BigDecimal("0.0300")
        );

        // Cycle 2: 2026-08-20
        insertSampleCycle(
            "SHP-SAMPLE-002", "CL-002", "Cordillera Builders Supply", "45 Magsaysay Ave, Baguio City", "0918-222-3344",
            "Hardware Tools and Fittings", 1, new BigDecimal("500.00"), new BigDecimal("50.00"), new BigDecimal("550.00"),
            "2026-08-20 10:00:00", "TRK-SAMPLE-002", new BigDecimal("22.00"), new BigDecimal("50.00"),
            new BigDecimal("40.00"), new BigDecimal("30.00"), new BigDecimal("0.0600")
        );

        // Cycle 3: 2026-08-13
        insertSampleCycle(
            "SHP-SAMPLE-003", "CL-003", "Pine Valley Boutique", "Unit 3, Upper Session Rd, Baguio City", "0999-333-4455",
            "Textiles and Apparel", 1, new BigDecimal("420.00"), BigDecimal.ZERO, new BigDecimal("420.00"),
            "2026-08-13 10:00:00", "TRK-SAMPLE-003", new BigDecimal("12.00"), new BigDecimal("35.00"),
            new BigDecimal("25.00"), new BigDecimal("20.00"), new BigDecimal("0.0175")
        );

        // Cycle 4: 2026-08-06
        insertSampleCycle(
            "SHP-SAMPLE-004", "CL-004", "Camp 7 General Store", "Camp 7, Kennon Road, Baguio City", "0920-444-5566",
            "Commercial Kitchen Supplies", 1, new BigDecimal("600.00"), BigDecimal.ZERO, new BigDecimal("600.00"),
            "2026-08-06 10:00:00", "TRK-SAMPLE-004", new BigDecimal("18.00"), new BigDecimal("45.00"),
            new BigDecimal("35.00"), new BigDecimal("30.00"), new BigDecimal("0.0473")
        );

        // Cycle 5: 2026-07-30
        insertSampleCycle(
            "SHP-SAMPLE-005", "CL-001", "Highland Retailers Hub", "Harrison Rd, Baguio City", "0917-555-6677",
            "Office Stationary and Paper Packs", 1, new BigDecimal("300.00"), BigDecimal.ZERO, new BigDecimal("300.00"),
            "2026-07-30 10:00:00", "TRK-SAMPLE-005", new BigDecimal("10.00"), new BigDecimal("30.00"),
            new BigDecimal("20.00"), new BigDecimal("20.00"), new BigDecimal("0.0120")
        );

        // Cycle 6: 2026-07-23
        insertSampleCycle(
            "SHP-SAMPLE-006", "CL-002", "Baguio Electrical Supply", "Governor Pack Rd, Baguio City", "0918-666-7788",
            "Electrical Conduits and Wiring", 1, new BigDecimal("480.00"), new BigDecimal("20.00"), new BigDecimal("500.00"),
            "2026-07-23 10:00:00", "TRK-SAMPLE-006", new BigDecimal("14.50"), new BigDecimal("40.00"),
            new BigDecimal("30.00"), new BigDecimal("25.00"), new BigDecimal("0.0300")
        );
    }

    private void insertSampleCycle(
            String shipmentId,
            String clientId,
            String recipientName,
            String recipientAddress,
            String recipientContact,
            String description,
            int quantity,
            BigDecimal shippingFee,
            BigDecimal otherCharges,
            BigDecimal totalAmount,
            String dateRegisteredStr,
            String trackingId,
            BigDecimal weightKg,
            BigDecimal lengthCm,
            BigDecimal heightCm,
            BigDecimal widthCm,
            BigDecimal volumeCbm
    ) {
        jdbcTemplate.update(
            "INSERT INTO shipment (" +
                "shipment_id, client_id, recipient_name, recipient_address, recipient_contact, " +
                "description, quantity, charge_model, shipping_fee, other_charges, total_amount, " +
                "paid_at_registration, route, registered_via, date_registered, statement_id" +
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            shipmentId,
            clientId,
            recipientName,
            recipientAddress,
            recipientContact,
            description,
            quantity,
            "FLAT",
            shippingFee,
            otherCharges,
            totalAmount,
            false,
            "MANILA_TO_BAGUIO",
            "DESKTOP_OFFICE",
            Timestamp.valueOf(dateRegisteredStr),
            null
        );

        jdbcTemplate.update(
            "INSERT INTO parcel_unit (" +
                "tracking_id, shipment_id, seq, weight_kg, length_cm, height_cm, width_cm, " +
                "volume_cbm, current_status, label_status, reprint_count" +
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            trackingId,
            shipmentId,
            1,
            weightKg,
            lengthCm,
            heightCm,
            widthCm,
            volumeCbm,
            "COMPLETED",
            "PRINTED",
            0
        );
    }
}
