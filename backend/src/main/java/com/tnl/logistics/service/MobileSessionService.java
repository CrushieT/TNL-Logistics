package com.tnl.logistics.service;

import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.dto.LoginResponse;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.MobileDeviceBinding;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.MobileDeviceBindingRepository;
import com.tnl.logistics.service.AuthSecurityService.AuthSecurityException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class MobileSessionService {
    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;
    private static final SecureRandom RANDOM = new SecureRandom();
    private final AppUserRepository users;
    private final MobileDeviceBindingRepository bindings;
    private final BCryptPasswordEncoder encoder;
    private final AuthSecurityService security;

    public MobileSessionService(AppUserRepository users, MobileDeviceBindingRepository bindings,
            BCryptPasswordEncoder encoder, AuthSecurityService security) {
        this.users = users;
        this.bindings = bindings;
        this.encoder = encoder;
        this.security = security;
    }

    @Transactional
    public LoginResponse loginWithPassword(String userId, String password, String deviceId,
            String deviceToken, boolean confirmDeviceSwitch) {
        AppUser user = requireLockedStaff(userId);
        if (!encoder.matches(password, user.getPasswordHash())) {
            throw new AuthSecurityException(HttpStatus.UNAUTHORIZED, null, "Invalid username or password");
        }
        if (Boolean.TRUE.equals(user.getMustChangePassword())) {
            return response(user, JwtTokenProvider.generatePasswordChangeToken(userId, user.getRole().name(),
                    user.getTokenVersion()), null, null);
        }
        String effectiveDeviceId = deviceId == null || deviceId.isBlank() ? UUID.randomUUID().toString() : deviceId;
        if (!security.isValidDeviceId(effectiveDeviceId)) throw invalidDevice();

        MobileDeviceBinding binding = bindings.findByDeviceIdForUpdate(effectiveDeviceId).orElse(null);
        if (binding != null) entityManager.refresh(binding, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        boolean isDifferentActiveOwner = binding != null && Boolean.TRUE.equals(binding.getActive())
                && !userId.equals(binding.getUserId());
        if (confirmDeviceSwitch || isDifferentActiveOwner) {
            if (binding == null || !Boolean.TRUE.equals(binding.getActive())
                    || !security.hasMatchingDeviceToken(binding, deviceToken)) throw invalidDevice();
        }
        if (isDifferentActiveOwner && !confirmDeviceSwitch) {
            throw new AuthSecurityException(HttpStatus.CONFLICT, "DEVICE_SWITCH_CONFIRMATION_REQUIRED",
                    "Confirm switching this device to the account you entered.");
        }

        byte[] tokenBytes = new byte[32];
        RANDOM.nextBytes(tokenBytes);
        String rawToken = HexFormat.of().formatHex(tokenBytes);
        if (binding == null) {
            binding = new MobileDeviceBinding(effectiveDeviceId, userId, hashToken(rawToken));
        } else {
            binding.incrementBindingVersion();
            binding.setUserId(userId);
            binding.setDeviceTokenHash(hashToken(rawToken));
            binding.setActive(true);
        }
        binding.setLastAuthenticatedAt(LocalDateTime.now());
        bindings.saveAndFlush(binding);
        return response(user, JwtTokenProvider.generateMobileToken(userId, user.getRole().name(),
                user.getTokenVersion(), binding.getId(), binding.getBindingVersion()), effectiveDeviceId, rawToken);
    }

    @Transactional
    public LoginResponse loginWithPin(String userId, String pin, String deviceId, String deviceToken) {
        AppUser user = requireLockedStaff(userId);
        MobileDeviceBinding binding = bindings.findByDeviceIdForUpdate(deviceId).orElseThrow(this::invalidDevice);
        entityManager.refresh(binding, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if (!userId.equals(binding.getUserId()) || !Boolean.TRUE.equals(binding.getActive())
                || !security.hasMatchingDeviceToken(binding, deviceToken)) throw invalidDevice();
        if (Boolean.TRUE.equals(user.getMustChangePassword())) {
            throw new AuthSecurityException(HttpStatus.FORBIDDEN, "PASSWORD_CHANGE_REQUIRED", "Password change required before unlocking with PIN");
        }
        if (user.getPinHash() == null || user.getPinHash().isBlank()) {
            throw new AuthSecurityException(HttpStatus.CONFLICT, "PIN_NOT_SET", "Sign in with your password to set up a PIN.");
        }
        if (!encoder.matches(pin, user.getPinHash())) {
            throw new AuthSecurityException(HttpStatus.UNAUTHORIZED, null, "Invalid PIN");
        }
        binding.setLastAuthenticatedAt(LocalDateTime.now());
        bindings.saveAndFlush(binding);
        return response(user, JwtTokenProvider.generateMobileToken(userId, user.getRole().name(),
                user.getTokenVersion(), binding.getId(), binding.getBindingVersion()), deviceId, deviceToken);
    }

    private AppUser requireLockedStaff(String userId) {
        AppUser user = users.findByIdForUpdate(userId).orElseThrow(this::invalidDevice);
        entityManager.refresh(user, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if (!Boolean.TRUE.equals(user.getActive()) || user.getRole() == null || !user.getRole().isMobileStaffRole()) {
            throw new AuthSecurityException(HttpStatus.FORBIDDEN, null, "Account is not authorized for mobile access.");
        }
        return user;
    }

    private LoginResponse response(AppUser user, String token, String deviceId, String deviceToken) {
        return new LoginResponse(token, user.getUserId(), user.getUsername(), user.getFullName(), user.getRole().name(),
                Boolean.TRUE.equals(user.getMustChangePassword()), user.getPinHash() != null && !user.getPinHash().isBlank(),
                deviceId, deviceToken);
    }

    private AuthSecurityException invalidDevice() {
        return new AuthSecurityException(HttpStatus.UNAUTHORIZED, "INVALID_DEVICE_CREDENTIALS", "Device credentials are invalid.");
    }

    private String hashToken(String rawToken) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
