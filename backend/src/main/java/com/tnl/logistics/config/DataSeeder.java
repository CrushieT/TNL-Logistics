package com.tnl.logistics.config;

import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.ClientRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Seeds default accounts and test client for system roles on startup.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final ClientRepository clientRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public DataSeeder(AppUserRepository appUserRepository, ClientRepository clientRepository, BCryptPasswordEncoder passwordEncoder) {
        this.appUserRepository = appUserRepository;
        this.clientRepository = clientRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) throws Exception {
        seedUser("USR-ADMIN", "admin", "admin123", "Maria Santos", UserRole.ADMIN, null, null);
        seedUser("USR-OFFICE", "office", "office123", "Office Staff", UserRole.OFFICE_STAFF, null, null);
        seedUser("USR-FIELD", "field", "field123", "Carlos Mendoza", UserRole.FIELD_STAFF, com.tnl.logistics.model.StaffType.INTERNAL_TRUCK, null);
        seedUser("USR-FIELD-2", "hauler1", "field123", "Rogelio Aquino", UserRole.FIELD_STAFF, com.tnl.logistics.model.StaffType.HAULER_STAFF, null);
        seedUser("USR-FIELD-3", "hauler2", "field123", "Danilo Cruz", UserRole.FIELD_STAFF, com.tnl.logistics.model.StaffType.HAULER_STAFF, null);

        // Seed default prototype clients
        seedClient("CL-001", "Northbridge Trading", "Unit 402, Trade Tower, Binondo, Manila", "0917-555-0148", "orders@northbridge.ph");
        seedClient("CL-002", "Sunrise Hardware", "88 Rizal St., Baguio City", "0918-555-0022", "acctg@sunrisehw.ph");
        seedClient("CL-003", "Metro Fashion House", "Session Road, Baguio City", "0999-555-0099", "metro@fashionhouse.ph");
        seedClient("CL-004", "Delacruz General Merchandise", "Magsaysay Ave, Baguio City", "0920-555-0077", null);
    }

    private void seedUser(String id, String username, String rawPassword, String fullName, UserRole role, com.tnl.logistics.model.StaffType staffType, String haulerCompany) {
        AppUser user = appUserRepository.findByUsername(username).orElse(null);
        if (user == null) {
            user = new AppUser(
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
        } else {
            user.setFullName(fullName);
            user.setRole(role);
            user.setStaffType(staffType);
            user.setHaulerCompany(haulerCompany);
            user.setPasswordHash(passwordEncoder.encode(rawPassword));
            appUserRepository.save(user);
        }
    }

    private void seedClient(String id, String name, String address, String contactNumber, String email) {
        if (clientRepository.findById(id).isEmpty()) {
            Client client = new Client(id, name, address, contactNumber, email);
            clientRepository.save(client);
        }
    }
}
