package com.tnl.logistics.controller;

import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.dto.FirstBootAdminRequest;
import com.tnl.logistics.dto.FirstBootStatusResponse;
import com.tnl.logistics.dto.LoginRequest;
import com.tnl.logistics.dto.MobileLoginRequest;
import com.tnl.logistics.service.MobileSessionService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
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
import com.tnl.logistics.service.AuthSecurityService;
import com.tnl.logistics.service.AuthSecurityService.AuthSecurityException;
import com.tnl.logistics.service.SseService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Controller handling authentication endpoints (Login and Password Change).
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private static final Logger securityAuditLog = LoggerFactory.getLogger("SECURITY_AUDIT");

    private final AppUserRepository appUserRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final LoginRateLimiterService rateLimiterService;
    private final SystemSettingRepository systemSettingRepository;
    private final SseService sseService;
    private final MobileDeviceBindingRepository mobileDeviceBindingRepository;
    private final AuthSecurityService authSecurityService;
    private final MobileSessionService mobileSessionService;

    public AuthController(
            AppUserRepository appUserRepository,
            BCryptPasswordEncoder passwordEncoder,
            LoginRateLimiterService rateLimiterService,
            SystemSettingRepository systemSettingRepository,
            SseService sseService,
            MobileDeviceBindingRepository mobileDeviceBindingRepository,
            AuthSecurityService authSecurityService,
            MobileSessionService mobileSessionService) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.rateLimiterService = rateLimiterService;
        this.systemSettingRepository = systemSettingRepository;
        this.sseService = sseService;
        this.mobileDeviceBindingRepository = mobileDeviceBindingRepository;
        this.authSecurityService = authSecurityService;
        this.mobileSessionService = mobileSessionService;
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

        if (user.getRole() != UserRole.ADMIN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Staff accounts must use the mobile application."));
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
    public ResponseEntity<?> mobileLogin(@Valid @RequestBody MobileLoginRequest request, HttpServletRequest servletRequest) {
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
            securityAuditLog.warn("AUTH_LOGIN_FAILURE userId=- role=- device=- ip={} reason=INVALID_CREDENTIALS", clientIp);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid username or password"));
        }

        if (!user.getActive()) {
            securityAuditLog.warn("AUTH_LOGIN_FAILURE userId={} role={} device=- ip={} reason=ACCOUNT_DEACTIVATED",
                    user.getUserId(), user.getRole(), clientIp);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Account is deactivated"));
        }

        if (user.getRole() == UserRole.ADMIN) {
            securityAuditLog.warn("AUTH_LOGIN_FAILURE userId={} role={} device=- ip={} reason=ADMIN_RESTRICTED",
                    user.getUserId(), user.getRole(), clientIp);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Administrator accounts are restricted to the Web Portal."));
        }
        if (user.getRole() == null || !user.getRole().isMobileStaffRole()) {
            securityAuditLog.warn("AUTH_LOGIN_FAILURE userId={} role={} device=- ip={} reason=ROLE_NOT_SUPPORTED",
                    user.getUserId(), user.getRole(), clientIp);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Account role is not supported. Contact an administrator."));
        }

        recordRateLimitSuccess(endpointIpKey);

        try {
            LoginResponse response = mobileSessionService.loginWithPassword(user.getUserId(), request.getPassword(),
                    servletRequest.getHeader("X-Device-Id"), servletRequest.getHeader("X-Device-Token"),
                    request.isConfirmDeviceSwitch());
            securityAuditLog.info("AUTH_LOGIN_SUCCESS userId={} role={} device={} ip={} reason={}",
                    user.getUserId(), user.getRole(), authSecurityService.maskDeviceId(response.getDeviceId()), clientIp,
                    request.isConfirmDeviceSwitch() ? "CONFIRMED_SWITCH" : "SUCCESS");
            return ResponseEntity.ok(response);
        } catch (AuthSecurityException exception) {
            securityAuditLog.warn("AUTH_LOGIN_FAILURE userId={} role={} device=- ip={} reason={}",
                    user.getUserId(), user.getRole(), clientIp, exception.getCode());
            return authSecurityErrorResponse(exception);
        } catch (DataIntegrityViolationException | PessimisticLockingFailureException exception) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("code", "DEVICE_BINDING_CHANGED",
                    "message", "Device binding changed. Sign in again."));
        }
    }

    @PostMapping("/mobile-setup-pin")
    @PreAuthorize("hasAnyRole('RECEIVING_STAFF', 'COURIER_STAFF', 'DISPATCH_STAFF')")
    public ResponseEntity<?> mobileSetupPin(
            @Valid @RequestBody MobilePinSetupRequest request,
            @RequestHeader(value = "X-Device-Id", required = false) String deviceId,
            @RequestHeader(value = "X-Device-Token", required = false) String deviceToken,
            HttpServletRequest servletRequest) {
        try {
            String userId = authenticatedUserId();
            String bearerToken = extractBearerToken(servletRequest);
            AuthSecurityService.PinUpdateResult result = authSecurityService.updatePin(
                    userId,
                    JwtTokenProvider.getTokenVersionFromToken(bearerToken),
                    JwtTokenProvider.getIssuedAtFromToken(bearerToken),
                    request.getPin(),
                    request.getCurrentPassword(),
                    deviceId,
                    deviceToken,
                    extractClientIp(servletRequest));
            String newToken = JwtTokenProvider.replaceSessionToken(
                    bearerToken, result.userId(), result.role(), result.tokenVersion());
            return ResponseEntity.ok(Map.of(
                    "message", "PIN updated successfully",
                    "hasPinSet", true,
                    "token", newToken));
        } catch (AuthSecurityException exception) {
            String userId = authenticatedUserId();
            auditAuthSecurityFailure(resolvePinFailureEvent(userId), userId, deviceId,
                    extractClientIp(servletRequest), exception);
            return authSecurityErrorResponse(exception);
        }
    }

    @PostMapping("/mobile-pin-login")
    public ResponseEntity<?> mobilePinLogin(@Valid @RequestBody MobilePinLoginRequest request, HttpServletRequest servletRequest) {
        String clientIp = extractClientIp(servletRequest);
        String endpointIpKey = "ep:pin-login:" + clientIp;

        if (!authSecurityService.isValidDeviceId(request.getDeviceId())
                || !authSecurityService.isValidDeviceToken(request.getDeviceToken())) {
            recordRateLimitFailure(endpointIpKey);
            return invalidDeviceCredentialsResponse();
        }

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
        if (!authSecurityService.hasMatchingDeviceToken(binding, request.getDeviceToken())) {
            recordRateLimitFailure(endpointIpKey);
            securityAuditLog.warn("PIN_LOGIN_FAILURE userId=- role=- device={} ip={} reason=INVALID_DEVICE_CREDENTIALS",
                    authSecurityService.maskDeviceId(request.getDeviceId()), clientIp);
            return invalidDeviceCredentialsResponse();
        }

        AppUser target = appUserRepository.findByUsername(normalized).orElse(null);
        if (target == null || !Boolean.TRUE.equals(target.getActive())
                || target.getRole() == null
                || !target.getRole().isMobileStaffRole()
                || !binding.getUserId().equals(target.getUserId())) {
            recordRateLimitFailure(endpointIpKey);
            securityAuditLog.warn("PIN_LOGIN_FAILURE userId=- role=- device={} ip={} reason=INVALID_DEVICE_CREDENTIALS",
                    authSecurityService.maskDeviceId(request.getDeviceId()), clientIp);
            return invalidDeviceCredentialsResponse();
        }

        if (Boolean.TRUE.equals(target.getMustChangePassword())) {
            securityAuditLog.info("PIN_LOGIN_PASSWORD_CHANGE_REQUIRED userId={} role={} device={} ip={} reason=PASSWORD_CHANGE_REQUIRED",
                    target.getUserId(), target.getRole(), authSecurityService.maskDeviceId(request.getDeviceId()), clientIp);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                            "code", "PASSWORD_CHANGE_REQUIRED",
                            "message", "Password change required before unlocking with PIN"
                    ));
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
            securityAuditLog.warn("PIN_LOGIN_FAILURE userId={} role={} device={} ip={} reason=INVALID_PIN",
                    target.getUserId(), target.getRole(), authSecurityService.maskDeviceId(request.getDeviceId()), clientIp);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid PIN"));
        }

        recordRateLimitSuccess(endpointIpKey, accountKey, deviceKey);

        try {
            LoginResponse response = mobileSessionService.loginWithPin(target.getUserId(), request.getPin(),
                    request.getDeviceId(), request.getDeviceToken());
            securityAuditLog.info("PIN_LOGIN_SUCCESS userId={} role={} device={} ip={} reason=SUCCESS",
                    target.getUserId(), target.getRole(), authSecurityService.maskDeviceId(request.getDeviceId()), clientIp);
            return ResponseEntity.ok(response);
        } catch (AuthSecurityException exception) {
            return authSecurityErrorResponse(exception);
        } catch (PessimisticLockingFailureException exception) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("code", "DEVICE_BINDING_CHANGED",
                    "message", "Device binding changed. Sign in again."));
        }
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

        if (!authSecurityService.isValidDeviceId(deviceId) || !authSecurityService.isValidDeviceToken(deviceToken)) {
            recordRateLimitFailure(endpointIpKey);
            return ResponseEntity.ok(Map.of(
                    "username", normalized,
                    "hasPinSet", false
            ));
        }

        MobileDeviceBinding binding = mobileDeviceBindingRepository.findByDeviceIdAndActiveTrue(deviceId).orElse(null);
        if (!authSecurityService.hasMatchingDeviceToken(binding, deviceToken)) {
            recordRateLimitFailure(endpointIpKey);
            return ResponseEntity.ok(Map.of(
                    "username", normalized,
                    "hasPinSet", false
            ));
        }

        AppUser user = appUserRepository.findByUsername(normalized).orElse(null);
        if (user == null || !Boolean.TRUE.equals(user.getActive()) || user.getRole() == null
                || !user.getRole().isMobileStaffRole()
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

    private String authenticatedUserId() {
        return (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    private String extractBearerToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return "";
        }
        return authorization.substring(7);
    }

    private ResponseEntity<?> invalidDeviceCredentialsResponse() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "code", "INVALID_DEVICE_CREDENTIALS",
                "message", "Device credentials are invalid."));
    }

    private ResponseEntity<?> authSecurityErrorResponse(AuthSecurityException exception) {
        Map<String, Object> body = new LinkedHashMap<>();
        if (exception.getCode() != null) {
            body.put("code", exception.getCode());
        }
        body.put("message", exception.getMessage());
        if (exception.getRetryAfterSeconds() > 0) {
            body.put("retryAfterSeconds", exception.getRetryAfterSeconds());
            return ResponseEntity.status(exception.getStatus())
                    .header("Retry-After", String.valueOf(exception.getRetryAfterSeconds()))
                    .body(body);
        }
        return ResponseEntity.status(exception.getStatus()).body(body);
    }

    @PostMapping("/password-change")
    public ResponseEntity<?> changePassword(
            @Valid @RequestBody PasswordChangeRequest request,
            HttpServletRequest servletRequest) {
        try {
            String bearerToken = extractBearerToken(servletRequest);
            AuthSecurityService.AuthenticatedUserSnapshot result = authSecurityService.changePassword(
                    authenticatedUserId(),
                    JwtTokenProvider.getTokenVersionFromToken(bearerToken),
                    request.getOldPassword(),
                    request.getNewPassword(),
                    extractClientIp(servletRequest));
            String newToken = JwtTokenProvider.replaceSessionToken(
                    bearerToken, result.userId(), result.role(), result.tokenVersion());

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("message", "Password updated successfully");
            response.put("token", newToken);
            response.put("userId", result.userId());
            response.put("username", result.username());
            response.put("fullName", result.fullName());
            response.put("role", result.role());
            response.put("mustChangePassword", result.mustChangePassword());
            response.put("hasPinSet", result.hasPinSet());
            return ResponseEntity.ok(response);
        } catch (AuthSecurityException exception) {
            auditAuthSecurityFailure("PASSWORD_CHANGE_FAILURE", authenticatedUserId(), null,
                    extractClientIp(servletRequest), exception);
            return authSecurityErrorResponse(exception);
        }
    }

    @PostMapping("/verify-password")
    public ResponseEntity<?> verifyPassword(
            @Valid @RequestBody PasswordVerificationRequest request,
            HttpServletRequest servletRequest) {
        try {
            authSecurityService.verifyPassword(
                    authenticatedUserId(),
                    request.getPassword(),
                    extractClientIp(servletRequest));
            return ResponseEntity.ok(Map.of(
                    "valid", true,
                    "message", "Password verified successfully"));
        } catch (AuthSecurityException exception) {
            auditAuthSecurityFailure("PASSWORD_VERIFY_FAILURE", authenticatedUserId(), null,
                    extractClientIp(servletRequest), exception);
            return authSecurityErrorResponse(exception);
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(
            @RequestHeader(value = "X-Device-Id", required = false) String deviceId,
            @RequestHeader(value = "X-Device-Token", required = false) String deviceToken) {
        try {
            return ResponseEntity.ok(authSecurityService.getCurrentUser(
                    authenticatedUserId(), deviceId, deviceToken));
        } catch (AuthSecurityException exception) {
            return authSecurityErrorResponse(exception);
        }
    }

    private String resolvePinFailureEvent(String userId) {
        AppUser user = appUserRepository.findById(userId).orElse(null);
        return user != null && user.getPinHash() != null && !user.getPinHash().isBlank()
                ? "PIN_ROTATION_FAILURE"
                : "PIN_SETUP_FAILURE";
    }

    private void auditAuthSecurityFailure(
            String event,
            String userId,
            String deviceId,
            String clientIp,
            AuthSecurityException exception) {
        AppUser user = appUserRepository.findById(userId).orElse(null);
        String role = user != null && user.getRole() != null ? user.getRole().name() : "-";
        String maskedDeviceId = authSecurityService.isValidDeviceId(deviceId)
                ? authSecurityService.maskDeviceId(deviceId)
                : "-";
        securityAuditLog.warn(
                "{} userId={} role={} device={} ip={} reason={}",
                event,
                userId != null ? userId : "-",
                role,
                maskedDeviceId,
                clientIp,
                resolveAuditReason(exception));
    }

    private String resolveAuditReason(AuthSecurityException exception) {
        if (exception.getCode() != null) {
            return exception.getCode();
        }
        if ("Incorrect current password.".equals(exception.getMessage())) {
            return "INVALID_CURRENT_PASSWORD";
        }
        if ("New password must be different from current password.".equals(exception.getMessage())) {
            return "PASSWORD_REUSE_NOT_ALLOWED";
        }
        return "REQUEST_REJECTED";
    }

    @PostMapping("/mobile-unbind")
    @PreAuthorize("hasAnyRole('RECEIVING_STAFF', 'COURIER_STAFF', 'DISPATCH_STAFF')")
    public ResponseEntity<?> unbindCurrentDevice(
            @RequestHeader(value = "X-Device-Id", required = false) String deviceId,
            @RequestHeader(value = "X-Device-Token", required = false) String deviceToken,
            HttpServletRequest servletRequest) {
        try {
            String bearerToken = extractBearerToken(servletRequest);
            authSecurityService.unbindCurrentDevice(
                    authenticatedUserId(),
                    JwtTokenProvider.getTokenVersionFromToken(bearerToken),
                    deviceId,
                    deviceToken,
                    extractClientIp(servletRequest));
            return ResponseEntity.ok(Map.of(
                    "message", "Device unbound successfully",
                    "unbound", true));
        } catch (AuthSecurityException exception) {
            auditAuthSecurityFailure("DEVICE_UNBIND_FAILURE", authenticatedUserId(), deviceId,
                    extractClientIp(servletRequest), exception);
            return authSecurityErrorResponse(exception);
        }
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
                UserRole.ADMIN
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
