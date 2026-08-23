package com.tnl.logistics.config;

import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.repository.AppUserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Seeds default accounts for system roles on startup.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public DataSeeder(AppUserRepository appUserRepository, BCryptPasswordEncoder passwordEncoder) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) throws Exception {
        seedUser("USR-ADMIN", "admin", "admin123", "System Administrator", UserRole.ADMIN);
        seedUser("USR-OFFICE", "office", "office123", "Office Staff", UserRole.OFFICE_STAFF);
        seedUser("USR-FIELD", "field", "field123", "Field Staff/Courier", UserRole.FIELD_STAFF);
    }

    private void seedUser(String id, String username, String rawPassword, String fullName, UserRole role) {
        if (appUserRepository.findByUsername(username).isEmpty()) {
            AppUser user = new AppUser(
                id,
                username,
                passwordEncoder.encode(rawPassword),
                fullName,
                role
            );
            user.setMustChangePassword(true); // Forces initial change
            appUserRepository.save(user);
        }
    }
}
