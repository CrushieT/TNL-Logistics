package com.tnl.logistics.repository;

import com.tnl.logistics.model.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Repository Integration Test.
 * Verifies JPA entity schema mappings and CRUD repository actions under dev profile.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class RepositoryIntegrationTest {

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private ShipmentRepository shipmentRepository;

    @Autowired
    private ParcelUnitRepository parcelUnitRepository;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private VehicleRepository vehicleRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Test
    public void testCrudOperations() {
        // 1. AppUser CRUD
        AppUser user = new AppUser("USR-001", "office_staff", "hashed_pwd", "Juan Dela Cruz", UserRole.OFFICE_STAFF);
        appUserRepository.save(user);
        Optional<AppUser> foundUser = appUserRepository.findByUsername("office_staff");
        assertTrue(foundUser.isPresent());
        assertEquals("Juan Dela Cruz", foundUser.get().getFullName());

        // 2. Vehicle CRUD
        Vehicle vehicle = new Vehicle("VEH-001", "ABC-1234", "TNL Truck Alpha");
        vehicleRepository.save(vehicle);
        Optional<Vehicle> foundVehicle = vehicleRepository.findById("VEH-001");
        assertTrue(foundVehicle.isPresent());
        assertEquals("ABC-1234", foundVehicle.get().getPlateNumber());

        // 3. Client CRUD
        Client client = new Client("CL-REPO-001", "Client A", "Address A", "09171234567", "clienta@example.com");
        clientRepository.save(client);
        Optional<Client> foundClient = clientRepository.findById("CL-REPO-001");
        assertTrue(foundClient.isPresent());
        assertEquals("Client A", foundClient.get().getName());

        // 4. Shipment CRUD
        Shipment shipment = new Shipment("SHP-2026-001", client, "Recipient A", "Address B", "09187654321",
                1, ChargeModel.FLAT, new BigDecimal("100.00"), BigDecimal.ZERO, new BigDecimal("100.00"),
                false, RegisteredVia.DESKTOP_OFFICE);
        shipmentRepository.save(shipment);
        Optional<Shipment> foundShipment = shipmentRepository.findById("SHP-2026-001");
        assertTrue(foundShipment.isPresent());

        // 5. ParcelUnit CRUD
        ParcelUnit unit = new ParcelUnit("TRK-2026-0001", shipment, 1, new BigDecimal("2.50"),
                new BigDecimal("10.00"), new BigDecimal("10.00"), new BigDecimal("10.00"), new BigDecimal("0.0010"));
        unit.setCurrentVehicle(vehicle);
        parcelUnitRepository.save(unit);
        Optional<ParcelUnit> foundUnit = parcelUnitRepository.findById("TRK-2026-0001");
        assertTrue(foundUnit.isPresent());
        assertEquals("TRK-2026-0001", foundUnit.get().getTrackingId());
        assertEquals(ParcelStatus.REGISTERED, foundUnit.get().getCurrentStatus());

        // 6. Payment CRUD
        Payment payment = new Payment(shipment, new BigDecimal("100.00"), PaymentMethod.CASH, LocalDate.now());
        paymentRepository.save(payment);
        assertNotNull(payment.getPaymentId());
    }
}
