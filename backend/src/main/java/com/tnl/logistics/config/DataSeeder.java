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
        seedUser("USR-ADMIN", "admin", "admin123", "Maria Santos", UserRole.ADMIN);
        seedUser("USR-OFFICE", "office", "office123", "Office Staff", UserRole.OFFICE_STAFF);
        seedUser("USR-FIELD", "field", "field123", "Field Staff/Courier", UserRole.FIELD_STAFF);

        // Seed default prototype client
        if (clientRepository.findById("CL-001").isEmpty()) {
            clientRepository.save(new Client(
                    "CL-001",
                    "Northbridge Trading",
                    "Unit 402, Trade Tower, Binondo, Manila",
                    "0917-555-0148",
                    "accounts@northbridgetrading.ph"
            ));
        }
    }

    private void seedUser(String id, String username, String rawPassword, String fullName, UserRole role) {
        AppUser user = appUserRepository.findByUsername(username).orElse(null);
        if (user == null) {
            user = new AppUser(
                id,
                username,
                passwordEncoder.encode(rawPassword),
                fullName,
                role
            );
            user.setMustChangePassword(true);
            appUserRepository.save(user);
        } else {
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
