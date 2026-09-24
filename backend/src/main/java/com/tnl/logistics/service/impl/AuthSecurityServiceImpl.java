package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.CurrentUserResponse;
import com.tnl.logistics.dto.MobileDeviceBindingSummary;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.MobileDeviceBinding;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.MobileDeviceBindingRepository;
import com.tnl.logistics.service.AuthSecurityService;
import com.tnl.logistics.service.LoginRateLimiterService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.Objects;
import java.util.regex.Pattern;

@Service
public class AuthSecurityServiceImpl implements AuthSecurityService {

    private static final Logger securityAuditLog = LoggerFactory.getLogger("SECURITY_AUDIT");
    private static final Pattern DEVICE_ID_PATTERN = Pattern.compile("^[A-Za-z0-9._:-]{1,64}$");
    private static final Pattern DEVICE_TOKEN_PATTERN = Pattern.compile("^[A-Fa-f0-9]{64}$");
    private static final long RECENT_AUTHENTICATION_SECONDS = 5 * 60;
    private static final long CLOCK_SKEW_SECONDS = 60;

    private final AppUserRepository appUserRepository;
    private final MobileDeviceBindingRepository mobileDeviceBindingRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final LoginRateLimiterService rateLimiterService;
    private final com.tnl.logistics.service.SseService sseService;

    public AuthSecurityServiceImpl(
            AppUserRepository appUserRepository,
            MobileDeviceBindingRepository mobileDeviceBindingRepository,
            BCryptPasswordEncoder passwordEncoder,
            LoginRateLimiterService rateLimiterService,
            com.tnl.logistics.service.SseService sseService) {
        this.appUserRepository = appUserRepository;
        this.mobileDeviceBindingRepository = mobileDeviceBindingRepository;
        this.passwordEncoder = passwordEncoder;
        this.rateLimiterService = rateLimiterService;
        this.sseService = sseService;
    }

    @Override
    @Transactional(readOnly = true)
    public CurrentUserResponse getCurrentUser(String userId, String deviceId, String deviceToken) {
        AppUser user = requireActiveUser(userId);
        MobileDeviceBindingSummary deviceBinding = null;

        if (deviceId != null || deviceToken != null) {
            requireValidDeviceCredentials(deviceId, deviceToken);
            MobileDeviceBinding binding = mobileDeviceBindingRepository
                    .findByDeviceIdAndUserIdAndActiveTrue(deviceId, user.getUserId())
                    .orElseThrow(this::invalidDeviceCredentials);
            if (!hasMatchingDeviceToken(binding, deviceToken)) {
                throw invalidDeviceCredentials();
            }
            deviceBinding = new MobileDeviceBindingSummary(
                    maskDeviceId(binding.getDeviceId()),
                    Boolean.TRUE.equals(binding.getActive()),
                    binding.getLastAuthenticatedAt());
        }

        return new CurrentUserResponse(
                user.getUserId(),
                user.getUsername(),
                user.getFullName(),
                user.getRole().name(),
                user.getStaffType() != null ? user.getStaffType().name() : null,
                Boolean.TRUE.equals(user.getMustChangePassword()),
                hasPinSet(user),
                deviceBinding);
    }

    @Override
    @Transactional
    public AuthenticatedUserSnapshot changePassword(
            String userId,
            Integer expectedTokenVersion,
            String oldPassword,
            String newPassword,
            String clientIp) {
        String ipKey = "ep:password-change:" + clientIp;
        String accountKey = "password-change:user:" + userId;
        requireNotRateLimited(ipKey, accountKey);

        AppUser user = requireLockedActiveUser(userId);
        requireCurrentTokenVersion(user, expectedTokenVersion);

        if (!passwordEncoder.matches(oldPassword, user.getPasswordHash())) {
            recordFailures(ipKey, accountKey);
            throw new AuthSecurityException(HttpStatus.BAD_REQUEST, null, "Incorrect current password.");
        }
        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new AuthSecurityException(
                    HttpStatus.BAD_REQUEST,
                    null,
                    "New password must be different from current password.");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false);
        user.incrementTokenVersion();
        appUserRepository.save(user);
        sseService.closeStreamsForUser(user.getUserId());
        clearFailures(ipKey, accountKey);
        auditSuccess("PASSWORD_CHANGE_SUCCESS", user, null, clientIp);

        return snapshot(user);
    }

    @Override
    @Transactional(readOnly = true)
    public void verifyPassword(String userId, String password, String clientIp) {
        String ipKey = "ep:verify-password:" + clientIp;
        String accountKey = "verify-password:user:" + userId;
        requireNotRateLimited(ipKey, accountKey);

        AppUser user = requireActiveUser(userId);
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            recordFailures(ipKey, accountKey);
            throw new AuthSecurityException(HttpStatus.BAD_REQUEST, null, "Incorrect current password.");
        }

        clearFailures(ipKey, accountKey);
        auditSuccess("PASSWORD_VERIFY_SUCCESS", user, null, clientIp);
    }

    @Override
    @Transactional
    public PinUpdateResult updatePin(
            String userId,
            Integer expectedTokenVersion,
            Long jwtIssuedAtEpochSeconds,
            String pin,
            String currentPassword,
            String deviceId,
            String deviceToken,
            String clientIp) {
        requireValidDeviceCredentials(deviceId, deviceToken);

        AppUser user = requireLockedActiveUser(userId);
        requireCurrentTokenVersion(user, expectedTokenVersion);
        requireMobileRole(user);

        boolean isRotation = hasPinSet(user);
        String eventPrefix = isRotation ? "PIN_ROTATION" : "PIN_SETUP";
        if (Boolean.TRUE.equals(user.getMustChangePassword())) {
            throw new AuthSecurityException(
                    HttpStatus.FORBIDDEN,
                    "PASSWORD_CHANGE_REQUIRED",
                    "Password change required before configuring PIN.");
        }

        MobileDeviceBinding binding = mobileDeviceBindingRepository
                .findByDeviceIdAndUserIdForUpdate(deviceId, user.getUserId())
                .orElseThrow(this::invalidDeviceCredentials);
        if (!Boolean.TRUE.equals(binding.getActive()) || !hasMatchingDeviceToken(binding, deviceToken)) {
            throw invalidDeviceCredentials();
        }

        boolean hasCurrentPassword = currentPassword != null && !currentPassword.isEmpty();
        if (isRotation && !hasCurrentPassword) {
            throw new AuthSecurityException(
                    HttpStatus.BAD_REQUEST,
                    "PASSWORD_REAUTH_REQUIRED",
                    "Current password is required to change the PIN.");
        }

        if (hasCurrentPassword) {
            String ipKey = "ep:pin-rotation:" + clientIp;
            String accountKey = "pin-rotation:user:" + user.getUserId();
            requireNotRateLimited(ipKey, accountKey);
            if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
                recordFailures(ipKey, accountKey);
                throw new AuthSecurityException(
                        HttpStatus.BAD_REQUEST,
                        "PASSWORD_VERIFICATION_FAILED",
                        "Incorrect current password.");
            }
            clearFailures(ipKey, accountKey);
        } else if (!isRecentAuthentication(jwtIssuedAtEpochSeconds, binding.getLastAuthenticatedAt())) {
            throw new AuthSecurityException(
                    HttpStatus.FORBIDDEN,
                    "PASSWORD_REAUTH_REQUIRED",
                    "Password authentication must be renewed before configuring PIN.");
        }

        if (isRotation && passwordEncoder.matches(pin, user.getPinHash())) {
            throw new AuthSecurityException(
                    HttpStatus.BAD_REQUEST,
                    "PIN_REUSE_NOT_ALLOWED",
                    "New PIN must be different from current PIN.");
        }

        user.setPinHash(passwordEncoder.encode(pin));
        user.incrementTokenVersion();
        appUserRepository.save(user);
        sseService.closeStreamsForUser(user.getUserId());
        auditSuccess(eventPrefix + "_SUCCESS", user, deviceId, clientIp);
        return new PinUpdateResult(user.getUserId(), user.getRole().name(), user.getTokenVersion(), isRotation);
    }

    @Override
    @Transactional
    public UnbindResult unbindCurrentDevice(
            String userId,
            Integer expectedTokenVersion,
            String deviceId,
            String deviceToken,
            String clientIp) {
        requireValidDeviceCredentials(deviceId, deviceToken);

        AppUser user = requireLockedActiveUser(userId);
        requireCurrentTokenVersion(user, expectedTokenVersion);
        requireMobileRole(user);

        MobileDeviceBinding binding = mobileDeviceBindingRepository
                .findByDeviceIdAndUserIdForUpdate(deviceId, user.getUserId())
                .orElseThrow(this::invalidDeviceCredentials);
        if (!Boolean.TRUE.equals(binding.getActive()) || !hasMatchingDeviceToken(binding, deviceToken)) {
            throw invalidDeviceCredentials();
        }

        binding.setActive(false);
        mobileDeviceBindingRepository.save(binding);
        user.incrementTokenVersion();
        appUserRepository.save(user);
        sseService.closeStreamsForUser(user.getUserId());
        auditSuccess("DEVICE_UNBIND_SUCCESS", user, deviceId, clientIp);
        return new UnbindResult(maskDeviceId(deviceId), user.getTokenVersion());
    }

    @Override
    public boolean isValidDeviceId(String deviceId) {
        return deviceId != null && DEVICE_ID_PATTERN.matcher(deviceId).matches();
    }

    @Override
    public boolean isValidDeviceToken(String deviceToken) {
        return deviceToken != null && DEVICE_TOKEN_PATTERN.matcher(deviceToken).matches();
    }

    @Override
    public boolean hasMatchingDeviceToken(MobileDeviceBinding binding, String deviceToken) {
        if (binding == null || binding.getDeviceTokenHash() == null || !isValidDeviceToken(deviceToken)) {
            return false;
        }
        return MessageDigest.isEqual(
                hashDeviceToken(deviceToken).getBytes(StandardCharsets.UTF_8),
                binding.getDeviceTokenHash().getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public String maskDeviceId(String deviceId) {
        if (deviceId == null || deviceId.isBlank()) {
            return null;
        }
        int retainedLength = deviceId.length() >= 8 ? 8 : Math.min(4, deviceId.length());
        return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + deviceId.substring(deviceId.length() - retainedLength);
    }

    private void requireValidDeviceCredentials(String deviceId, String deviceToken) {
        if (!isValidDeviceId(deviceId) || !isValidDeviceToken(deviceToken)) {
            throw invalidDeviceCredentials();
        }
    }

    private AppUser requireActiveUser(String userId) {
        AppUser user = appUserRepository.findById(userId).orElse(null);
        if (user == null || !Boolean.TRUE.equals(user.getActive())) {
            throw invalidSession();
        }
        return user;
    }

    private AppUser requireLockedActiveUser(String userId) {
        AppUser user = appUserRepository.findByIdForUpdate(userId).orElse(null);
        if (user == null || !Boolean.TRUE.equals(user.getActive())) {
            throw invalidSession();
        }
        return user;
    }

    private void requireCurrentTokenVersion(AppUser user, Integer expectedTokenVersion) {
        if (expectedTokenVersion == null || !Objects.equals(user.getTokenVersion(), expectedTokenVersion)) {
            throw new AuthSecurityException(
                    HttpStatus.UNAUTHORIZED,
                    "SESSION_REAUTH_REQUIRED",
                    "Session authentication must be renewed.");
        }
    }

    private void requireMobileRole(AppUser user) {
        if (user.getRole() != UserRole.FIELD_STAFF && user.getRole() != UserRole.OFFICE_STAFF) {
            throw new AuthSecurityException(
                    HttpStatus.FORBIDDEN,
                    "MOBILE_ROLE_REQUIRED",
                    "A mobile staff role is required.");
        }
    }

    private boolean isRecentAuthentication(Long jwtIssuedAtEpochSeconds, LocalDateTime bindingAuthenticatedAt) {
        if (jwtIssuedAtEpochSeconds == null || bindingAuthenticatedAt == null) {
            return false;
        }
        long now = System.currentTimeMillis() / 1000;
        long bindingEpochSeconds = bindingAuthenticatedAt.atZone(ZoneId.systemDefault()).toEpochSecond();
        return isWithinRecentWindow(jwtIssuedAtEpochSeconds, now)
                && isWithinRecentWindow(bindingEpochSeconds, now);
    }

    private boolean isWithinRecentWindow(long timestamp, long now) {
        return timestamp <= now + CLOCK_SKEW_SECONDS
                && now - timestamp <= RECENT_AUTHENTICATION_SECONDS + CLOCK_SKEW_SECONDS;
    }

    private String hashDeviceToken(String deviceToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(deviceToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 algorithm unavailable", exception);
        }
    }

    private boolean hasPinSet(AppUser user) {
        return user.getPinHash() != null && !user.getPinHash().isBlank();
    }

    private AuthenticatedUserSnapshot snapshot(AppUser user) {
        return new AuthenticatedUserSnapshot(
                user.getUserId(),
                user.getUsername(),
                user.getFullName(),
                user.getRole().name(),
                Boolean.TRUE.equals(user.getMustChangePassword()),
                hasPinSet(user),
                user.getTokenVersion());
    }

    private void requireNotRateLimited(String... keys) {
        long retryAfterSeconds = 0;
        for (String key : keys) {
            if (rateLimiterService.isBlocked(key)) {
                retryAfterSeconds = Math.max(retryAfterSeconds, rateLimiterService.getRemainingBlockSeconds(key));
            }
        }
        if (retryAfterSeconds > 0) {
            throw new AuthSecurityException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "RATE_LIMITED",
                    "Too many failed attempts. Please try again later.",
                    retryAfterSeconds);
        }
    }

    private void recordFailures(String... keys) {
        for (String key : keys) {
            rateLimiterService.recordFailure(key);
        }
    }

    private void clearFailures(String... keys) {
        for (String key : keys) {
            rateLimiterService.recordSuccess(key);
        }
    }

    private AuthSecurityException invalidDeviceCredentials() {
        return new AuthSecurityException(
                HttpStatus.UNAUTHORIZED,
                "INVALID_DEVICE_CREDENTIALS",
                "Device credentials are invalid.");
    }

    private AuthSecurityException invalidSession() {
        return new AuthSecurityException(
                HttpStatus.UNAUTHORIZED,
                "SESSION_REAUTH_REQUIRED",
                "Session authentication must be renewed.");
    }

    private void auditSuccess(String event, AppUser user, String deviceId, String clientIp) {
        securityAuditLog.info(
                "{} userId={} role={} device={} ip={} reason=SUCCESS",
                event,
                user.getUserId(),
                user.getRole(),
                deviceId != null ? maskDeviceId(deviceId) : "-",
                clientIp);
    }

}
