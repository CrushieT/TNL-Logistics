package com.tnl.logistics.controller;

import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.dto.FirstBootAdminRequest;
import com.tnl.logistics.dto.FirstBootStatusResponse;
import com.tnl.logistics.dto.LoginRequest;
import com.tnl.logistics.dto.LoginResponse;
import com.tnl.logistics.dto.MobilePinLoginRequest;
import com.tnl.logistics.dto.MobilePinSetupRequest;
import com.tnl.logistics.dto.PasswordChangeRequest;
import com.tnl.logistics.dto.PasswordVerificationRequest;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.MobileDeviceBinding;
import com.tnl.logistics.model.SystemSetting;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.MobileDeviceBindingRepository;
import com.tnl.logistics.repository.SystemSettingRepository;
import com.tnl.logistics.security.UsernameNormalizer;
import com.tnl.logistics.service.LoginRateLimiterService;
import com.tnl.logistics.service.SseService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Controller handling authentication endpoints (Login and Password Change).
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private static final Logger securityAuditLog = LoggerFactory.getLogger("SECURITY_AUDIT");
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final AppUserRepository appUserRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final LoginRateLimiterService rateLimiterService;
    private final SystemSettingRepository systemSettingRepository;
    private final SseService sseService;
    private final MobileDeviceBindingRepository mobileDeviceBindingRepository;

    public AuthController(
            AppUserRepository appUserRepository,
            BCryptPasswordEncoder passwordEncoder,
            LoginRateLimiterService rateLimiterService,
            SystemSettingRepository systemSettingRepository,
            SseService sseService,
            MobileDeviceBindingRepository mobileDeviceBindingRepository) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.rateLimiterService = rateLimiterService;
        this.systemSettingRepository = systemSettingRepository;
        this.sseService = sseService;
        this.mobileDeviceBindingRepository = mobileDeviceBindingRepository;
    }

    private String generateSecureDeviceToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private String hashDeviceToken(String deviceToken) {
        if (deviceToken == null || deviceToken.isBlank()) {
            return "";
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(deviceToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm unavailable", e);
        }
    }

    private boolean hasMatchingDeviceToken(MobileDeviceBinding binding, String deviceToken) {
        if (binding == null || binding.getDeviceTokenHash() == null) {
            return false;
        }

        return MessageDigest.isEqual(
                hashDeviceToken(deviceToken).getBytes(StandardCharsets.UTF_8),
                binding.getDeviceTokenHash().getBytes(StandardCharsets.UTF_8)
        );
    }

    private boolean isRateLimited(String... keys) {
        for (String key : keys) {
            if (rateLimiterService.isBlocked(key)) {
                return true;
            }
        }
        return false;
    }

    private long getMaximumRetryAfterSeconds(String... keys) {
        long retryAfter = 0;
        for (String key : keys) {
            retryAfter = Math.max(retryAfter, rateLimiterService.getRemainingBlockSeconds(key));
        }
        return retryAfter;
    }

    private void recordRateLimitFailure(String... keys) {
        for (String key : keys) {
            rateLimiterService.recordFailure(key);
        }
    }

    private void recordRateLimitSuccess(String... keys) {
        for (String key : keys) {
            rateLimiterService.recordSuccess(key);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest) {
        String clientIp = extractClientIp(servletRequest);

        if (rateLimiterService.isBlocked(clientIp)) {
            long retryAfter = rateLimiterService.getRemainingBlockSeconds(clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(retryAfter))
                    .body(Map.of(
                            "message", "Too many failed login attempts. Access is locked. Please try again in " + retryAfter + " seconds.",
                            "retryAfterSeconds", retryAfter
                    ));
        }

        AppUser user;
        try {
            user = appUserRepository.findByUsername(UsernameNormalizer.normalize(request.getUsername()))
                    .orElse(null);
        } catch (IllegalArgumentException exception) {
            user = null;
        }

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            rateLimiterService.recordFailure(clientIp);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid username or password"));
        }

        if (!user.getActive()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Account is deactivated"));
        }

        if (user.getRole() == UserRole.FIELD_STAFF) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Field staff accounts are restricted to the mobile portal."));
        }

        rateLimiterService.recordSuccess(clientIp);

        String token = JwtTokenProvider.generateToken(user.getUserId(), user.getRole().name(), user.getTokenVersion());

        boolean hasPin = user.getPinHash() != null && !user.getPinHash().isBlank();
        LoginResponse response = new LoginResponse(
                token,
                user.getUserId(),
                user.getUsername(),
                user.getFullName(),
                user.getRole().name(),
                user.getMustChangePassword(),
                hasPin
        );

        return ResponseEntity.ok(response);
    }

    @PostMapping("/mobile-login")
    public ResponseEntity<?> mobileLogin(@Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest) {
        String clientIp = extractClientIp(servletRequest);
        String endpointIpKey = "ep:mobile-login:" + clientIp;

        if (isRateLimited(endpointIpKey)) {
            long retryAfter = getMaximumRetryAfterSeconds(endpointIpKey);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(retryAfter))
                    .body(Map.of(
                            "message", "Too many failed login attempts. Access is locked. Please try again in " + retryAfter + " seconds.",
                            "retryAfterSeconds", retryAfter
                    ));
        }

        AppUser user;
        try {
            String normalizedUsername = UsernameNormalizer.normalize(request.getUsername());
            user = appUserRepository.findByUsername(normalizedUsername).orElse(null);
        } catch (IllegalArgumentException exception) {
            user = null;
        }

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            recordRateLimitFailure(endpointIpKey);
            securityAuditLog.warn("AUTH_LOGIN_FAILURE: username={} ip={} reason=invalid_credentials", request.getUsername(), clientIp);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid username or password"));
        }

        if (!user.getActive()) {
            securityAuditLog.warn("AUTH_LOGIN_FAILURE: username={} ip={} reason=account_deactivated", request.getUsername(), clientIp);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Account is deactivated"));
        }

        if (user.getRole() == UserRole.ADMIN) {
            securityAuditLog.warn("AUTH_LOGIN_FAILURE: username={} ip={} reason=admin_restricted", request.getUsername(), clientIp);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Administrator accounts are restricted to the Web Portal."));
        }

        recordRateLimitSuccess(endpointIpKey);

        String deviceId = servletRequest.getHeader("X-Device-Id");
        if (deviceId == null || deviceId.isBlank()) {
            deviceId = UUID.randomUUID().toString();
        }

        String rawDeviceToken = generateSecureDeviceToken();
        String deviceTokenHash = hashDeviceToken(rawDeviceToken);

        MobileDeviceBinding binding = mobileDeviceBindingRepository.findByDeviceId(deviceId).orElse(null);
        if (binding == null) {
            binding = new MobileDeviceBinding(deviceId, user.getUserId(), deviceTokenHash);
        } else {
            binding.setUserId(user.getUserId());
            binding.setDeviceTokenHash(deviceTokenHash);
            binding.setActive(true);
        }
        binding.setLastAuthenticatedAt(LocalDateTime.now());
        mobileDeviceBindingRepository.save(binding);

        securityAuditLog.info("AUTH_LOGIN_SUCCESS: userId={} username={} role={} deviceId={} ip={}",
                user.getUserId(), user.getUsername(), user.getRole(), deviceId, clientIp);

        String token = JwtTokenProvider.generateToken(user.getUserId(), user.getRole().name(), user.getTokenVersion());

        boolean hasPin = user.getPinHash() != null && !user.getPinHash().isBlank();
        LoginResponse response = new LoginResponse(
                token,
                user.getUserId(),
                user.getUsername(),
                user.getFullName(),
                user.getRole().name(),
                user.getMustChangePassword(),
                hasPin,
                deviceId,
                rawDeviceToken
        );

        return ResponseEntity.ok(response);
    }

    @PostMapping("/mobile-setup-pin")
    public ResponseEntity<?> mobileSetupPin(@Valid @RequestBody MobilePinSetupRequest request, HttpServletRequest servletRequest) {
        String clientIp = extractClientIp(servletRequest);
        String userId = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        AppUser user = appUserRepository.findById(userId).orElse(null);
        if (user == null || !Boolean.TRUE.equals(user.getActive())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Session invalid or account deactivated"));
        }

        if (user.getRole() == UserRole.ADMIN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Administrator accounts are restricted to the Web Portal."));
        }

        if (Boolean.TRUE.equals(user.getMustChangePassword())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                            "code", "PASSWORD_CHANGE_REQUIRED",
                            "message", "Password change required before configuring PIN"
                    ));
        }

        user.setPinHash(passwordEncoder.encode(request.getPin()));
        user.setTokenVersion((user.getTokenVersion() != null ? user.getTokenVersion() : 1) + 1);
        appUserRepository.save(user);

        String newToken = JwtTokenProvider.generateToken(user.getUserId(), user.getRole().name(), user.getTokenVersion());

        securityAuditLog.info("PIN_SETUP_SUCCESS: userId={} tokenVersion={} ip={}", user.getUserId(), user.getTokenVersion(), clientIp);

        return ResponseEntity.ok(Map.of(
                "message", "PIN configured successfully",
                "hasPinSet", true,
                "token", newToken
        ));
    }

    @PostMapping("/mobile-pin-login")
    public ResponseEntity<?> mobilePinLogin(@Valid @RequestBody MobilePinLoginRequest request, HttpServletRequest servletRequest) {
        String clientIp = extractClientIp(servletRequest);
        String endpointIpKey = "ep:pin-login:" + clientIp;

        if (isRateLimited(endpointIpKey)) {
            long retryAfter = getMaximumRetryAfterSeconds(endpointIpKey);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(retryAfter))
                    .body(Map.of(
                            "message", "Too many failed login attempts. Access is locked. Please try again in " + retryAfter + " seconds.",
                            "retryAfterSeconds", retryAfter
                    ));
        }

        String normalized;
        try {
            normalized = UsernameNormalizer.normalize(request.getUsername());
        } catch (IllegalArgumentException e) {
            recordRateLimitFailure(endpointIpKey);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid device credentials"));
        }

        MobileDeviceBinding binding = mobileDeviceBindingRepository.findByDeviceIdAndActiveTrue(request.getDeviceId()).orElse(null);
        if (!hasMatchingDeviceToken(binding, request.getDeviceToken())) {
            recordRateLimitFailure(endpointIpKey);
            securityAuditLog.warn("PIN_LOGIN_FAILURE: username={} deviceId={} ip={} reason=invalid_device_credentials",
                    normalized, request.getDeviceId(), clientIp);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid device credentials"));
        }

        AppUser target = appUserRepository.findByUsername(normalized).orElse(null);
        if (target == null || !Boolean.TRUE.equals(target.getActive())
                || target.getRole() == UserRole.ADMIN
                || !binding.getUserId().equals(target.getUserId())) {
            recordRateLimitFailure(endpointIpKey);
            securityAuditLog.warn("PIN_LOGIN_FAILURE: username={} deviceId={} ip={} reason=invalid_device_binding",
                    normalized, request.getDeviceId(), clientIp);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid device credentials"));
        }

        String accountKey = "user:" + normalized;
        String deviceKey = "device:" + binding.getDeviceId();
        if (isRateLimited(accountKey, deviceKey)) {
            long retryAfter = getMaximumRetryAfterSeconds(accountKey, deviceKey);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(retryAfter))
                    .body(Map.of(
                            "message", "Too many failed login attempts. Access is locked. Please try again in " + retryAfter + " seconds.",
                            "retryAfterSeconds", retryAfter
                    ));
        }

        if (target.getPinHash() == null || target.getPinHash().isBlank()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of(
                            "code", "PIN_NOT_SET",
                            "message", "Your PIN has been cleared by an administrator. Please sign in with your password to set up a new PIN.",
                            "hasPinSet", false
                    ));
        }

        if (!passwordEncoder.matches(request.getPin(), target.getPinHash())) {
            recordRateLimitFailure(endpointIpKey, accountKey, deviceKey);
            securityAuditLog.warn("PIN_LOGIN_FAILURE: username={} deviceId={} ip={} reason=bad_pin",
                    normalized, request.getDeviceId(), clientIp);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid PIN"));
        }

        recordRateLimitSuccess(endpointIpKey, accountKey, deviceKey);

        binding.setLastAuthenticatedAt(LocalDateTime.now());
        mobileDeviceBindingRepository.save(binding);

        securityAuditLog.info("PIN_LOGIN_SUCCESS: userId={} username={} deviceId={} ip={}",
                target.getUserId(), target.getUsername(), request.getDeviceId(), clientIp);

        String token = JwtTokenProvider.generateToken(target.getUserId(), target.getRole().name(), target.getTokenVersion());

        LoginResponse response = new LoginResponse(
                token,
                target.getUserId(),
                target.getUsername(),
                target.getFullName(),
                target.getRole().name(),
                target.getMustChangePassword(),
                true,
                request.getDeviceId(),
                request.getDeviceToken()
        );

        return ResponseEntity.ok(response);
    }

    @GetMapping("/mobile-pin-status")
    public ResponseEntity<?> getMobilePinStatus(
            @RequestParam(value = "username", required = false) String username,
            HttpServletRequest servletRequest) {
        String clientIp = extractClientIp(servletRequest);
        String endpointIpKey = "ep:pin-status:" + clientIp;

        if (isRateLimited(endpointIpKey)) {
            long retryAfter = getMaximumRetryAfterSeconds(endpointIpKey);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(retryAfter))
                    .body(Map.of(
                            "message", "Too many requests. Please try again in " + retryAfter + " seconds.",
                            "retryAfterSeconds", retryAfter
                    ));
        }

        if (username == null || username.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Username is required"));
        }
        String normalized;
        try {
            normalized = UsernameNormalizer.normalize(username);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid username format"));
        }

        String deviceId = servletRequest.getHeader("X-Device-Id");
        String deviceToken = servletRequest.getHeader("X-Device-Token");

        if (deviceId == null || deviceId.isBlank() || deviceToken == null || deviceToken.isBlank()) {
            recordRateLimitFailure(endpointIpKey);
            return ResponseEntity.ok(Map.of(
                    "username", normalized,
                    "hasPinSet", false
            ));
        }

        MobileDeviceBinding binding = mobileDeviceBindingRepository.findByDeviceIdAndActiveTrue(deviceId).orElse(null);
        if (!hasMatchingDeviceToken(binding, deviceToken)) {
            recordRateLimitFailure(endpointIpKey);
            return ResponseEntity.ok(Map.of(
                    "username", normalized,
                    "hasPinSet", false
            ));
        }

        AppUser user = appUserRepository.findByUsername(normalized).orElse(null);
        if (user == null || !Boolean.TRUE.equals(user.getActive()) || user.getRole() == UserRole.ADMIN
                || !binding.getUserId().equals(user.getUserId())) {
            recordRateLimitFailure(endpointIpKey);
            return ResponseEntity.ok(Map.of(
                    "username", normalized,
                    "hasPinSet", false
            ));
        }

        boolean hasPin = user.getPinHash() != null && !user.getPinHash().isBlank();
        return ResponseEntity.ok(Map.of(
                "username", user.getUsername(),
                "hasPinSet", hasPin
        ));
    }

    private String extractClientIp(HttpServletRequest request) {
        if (request == null) {
            return "127.0.0.1";
        }
        String remoteAddr = request.getRemoteAddr();
        return (remoteAddr != null && !remoteAddr.isBlank()) ? remoteAddr : "127.0.0.1";
    }

    @PostMapping("/password-change")
    public ResponseEntity<?> changePassword(@Valid @RequestBody PasswordChangeRequest request) {
        String userId = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        AppUser user = appUserRepository.findById(userId)
                .orElse(null);

        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "User not found"));
        }

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Incorrect current password"));
        }

        if (request.getOldPassword().equals(request.getNewPassword()) ||
                passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "New password must be different from current password."));
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setMustChangePassword(false);
        user.incrementTokenVersion();
        appUserRepository.save(user);

        String newToken = JwtTokenProvider.generateToken(user.getUserId(), user.getRole().name(), user.getTokenVersion());

        return ResponseEntity.ok(Map.of(
                "message", "Password updated successfully",
                "token", newToken,
                "userId", user.getUserId(),
                "username", user.getUsername(),
                "role", user.getRole().name(),
                "mustChangePassword", user.getMustChangePassword()
        ));
    }

    @PostMapping("/verify-password")
    public ResponseEntity<?> verifyPassword(
            @Valid @RequestBody PasswordVerificationRequest request,
            HttpServletRequest servletRequest) {
        String clientIp = extractClientIp(servletRequest);

        if (rateLimiterService.isBlocked(clientIp)) {
            long retryAfter = rateLimiterService.getRemainingBlockSeconds(clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(retryAfter))
                    .body(Map.of(
                            "message", "Too many failed attempts. Access is locked. Please try again in " + retryAfter + " seconds.",
                            "retryAfterSeconds", retryAfter
                    ));
        }

        String userId = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        AppUser user = appUserRepository.findById(userId)
                .orElse(null);

        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "User not found"));
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            rateLimiterService.recordFailure(clientIp);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Incorrect administrator password."));
        }

        rateLimiterService.recordSuccess(clientIp);

        return ResponseEntity.ok(Map.of(
                "valid", true,
                "message", "Password verified successfully"
        ));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {
        String userId = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        AppUser user = appUserRepository.findById(userId)
                .orElse(null);

        if (user == null || !user.getActive()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Session invalid or expired"));
        }

        boolean hasPinSet = user.getPinHash() != null && !user.getPinHash().isBlank();

        return ResponseEntity.ok(Map.of(
                "userId", user.getUserId(),
                "username", user.getUsername(),
                "fullName", user.getFullName(),
                "role", user.getRole().name(),
                "mustChangePassword", user.getMustChangePassword(),
                "hasPinSet", hasPinSet
        ));
    }

    @GetMapping("/first-boot-status")
    public ResponseEntity<FirstBootStatusResponse> getFirstBootStatus() {
        boolean hasAdmin = appUserRepository.existsByRole(UserRole.ADMIN);
        return ResponseEntity.ok(new FirstBootStatusResponse(!hasAdmin));
    }

    @PostMapping("/first-boot-admin")
    @Transactional
    public ResponseEntity<?> registerFirstBootAdmin(@Valid @RequestBody FirstBootAdminRequest request) {
        if (appUserRepository.existsByRole(UserRole.ADMIN)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "First boot setup has already been completed."));
        }

        if (!request.getPassword().equals(request.getConfirmPassword())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Passwords do not match."));
        }

        String normalizedUsername;
        try {
            normalizedUsername = UsernameNormalizer.normalize(request.getUsername());
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", exception.getMessage()));
        }
        if (appUserRepository.findByUsername(normalizedUsername).isPresent()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Username is already in use."));
        }

        AppUser adminUser = new AppUser(
                "USR-ADMIN",
                normalizedUsername,
                passwordEncoder.encode(request.getPassword()),
                request.getFullName().trim(),
                UserRole.ADMIN,
                null,
                null
        );
        adminUser.setActive(true);
        adminUser.setMustChangePassword(false);
        adminUser.setTokenVersion(1);

        appUserRepository.save(adminUser);

        // Update company branding in system_setting singleton
        SystemSetting setting = systemSettingRepository.findById(SystemSetting.DEFAULT_SETTING_ID)
                .orElseGet(() -> new SystemSetting(
                        SystemSetting.DEFAULT_SETTING_ID,
                        "TC & CT Integrated Logistics",
                        "Labo, Camarines Norte",
                        "0917-555-0000",
                        "billing@tnllogistics.ph",
                        java.time.DayOfWeek.THURSDAY,
                        5000,
                        "TRK",
                        "SHP"
                ));

        if (request.getCompanyName() != null && !request.getCompanyName().isBlank()) {
            setting.setCompanyName(request.getCompanyName().trim());
        }
        if (request.getCompanyAddress() != null && !request.getCompanyAddress().isBlank()) {
            setting.setCompanyAddress(request.getCompanyAddress().trim());
        }
        if (request.getCompanyContact() != null && !request.getCompanyContact().isBlank()) {
            setting.setCompanyContact(request.getCompanyContact().trim());
        }
        if (request.getBillingEmail() != null && !request.getBillingEmail().isBlank()) {
            setting.setBillingEmail(request.getBillingEmail().trim());
        }
        setting.setUpdatedBy("USR-ADMIN");
        systemSettingRepository.save(setting);

        try {
            sseService.broadcastEvent("SETTINGS_UPDATED", setting);
        } catch (Exception e) {
            // Non-blocking SSE broadcast exception shielding
        }

        String token = JwtTokenProvider.generateToken(adminUser.getUserId(), adminUser.getRole().name(), adminUser.getTokenVersion());

        LoginResponse response = new LoginResponse(
                token,
                adminUser.getUserId(),
                adminUser.getUsername(),
                adminUser.getRole().name(),
                adminUser.getMustChangePassword()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
