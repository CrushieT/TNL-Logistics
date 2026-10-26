package com.tnl.logistics.support;

import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.model.MobileDeviceBinding;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.MobileDeviceBindingRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("test")
public class TestSessionTokenFactory {
    private final AppUserRepository users;
    private final MobileDeviceBindingRepository bindings;

    public TestSessionTokenFactory(AppUserRepository users, MobileDeviceBindingRepository bindings) {
        this.users = users;
        this.bindings = bindings;
    }

    public String generateToken(String userId, String role) { return generateToken(userId, role, 1); }

    public String generateToken(String userId, String role, Integer version) {
        return generateToken(userId, role, version, JwtTokenProvider.getExpirationMsForRole(role));
    }

    public String generateToken(String userId, String role, Integer version, long duration) {
        long now = System.currentTimeMillis() / 1000;
        return generateToken(userId, role, version, now, (System.currentTimeMillis() + duration) / 1000, now);
    }

    public String generateToken(String userId, String role, Integer version, long issuedAt, long expiresAt) {
        return generateToken(userId, role, version, issuedAt, expiresAt, issuedAt);
    }

    public String generateToken(String userId, String role, Integer version, long issuedAt, long expiresAt, Long authTime) {
        if (JwtTokenProvider.isAdminRole(role)) {
            return JwtTokenProvider.generateToken(userId, role, version, issuedAt, expiresAt, authTime);
        }
        var user = users.findById(userId).orElse(null);
        if (user == null) return JwtTokenProvider.generateToken(userId, role, version, issuedAt, expiresAt);
        if (Boolean.TRUE.equals(user.getMustChangePassword())) {
            return JwtTokenProvider.generatePasswordChangeToken(userId, role, version);
        }
        MobileDeviceBinding binding = bindings.findByUserIdAndActiveTrue(userId).stream().findFirst().orElse(null);
        if (binding == null) {
            binding = bindings.saveAndFlush(new MobileDeviceBinding("test-session-" + userId, userId, "0".repeat(64)));
        }
        return JwtTokenProvider.generateMobileToken(userId, role, version, binding.getId(), binding.getBindingVersion(), issuedAt, expiresAt);
    }
}
