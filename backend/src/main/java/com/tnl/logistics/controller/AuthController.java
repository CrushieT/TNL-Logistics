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
import com.tnl.logistics.model.SystemSetting;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.SystemSettingRepository;
import com.tnl.logistics.security.UsernameNormalizer;
import com.tnl.logistics.service.LoginRateLimiterService;
import com.tnl.logistics.service.SseService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller handling authentication endpoints (Login and Password Change).
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AppUserRepository appUserRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final LoginRateLimiterService rateLimiterService;
    private final SystemSettingRepository systemSettingRepository;
    private final SseService sseService;

    public AuthController(
            AppUserRepository appUserRepository,
            BCryptPasswordEncoder passwordEncoder,
            LoginRateLimiterService rateLimiterService,
            SystemSettingRepository systemSettingRepository,
            SseService sseService) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.rateLimiterService = rateLimiterService;
        this.systemSettingRepository = systemSettingRepository;
        this.sseService = sseService;
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
            String normalizedUsername = UsernameNormalizer.normalize(request.getUsername());
            user = appUserRepository.findByUsername(normalizedUsername).orElse(null);
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

        if (user.getRole() == UserRole.ADMIN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Administrator accounts are restricted to the Web Portal."));
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

    @PostMapping("/mobile-setup-pin")
    public ResponseEntity<?> mobileSetupPin(@Valid @RequestBody MobilePinSetupRequest request) {
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

        user.setPinHash(passwordEncoder.encode(request.getPin()));
        appUserRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "message", "PIN configured successfully",
                "hasPinSet", true
        ));
    }

    @PostMapping("/mobile-pin-login")
    public ResponseEntity<?> mobilePinLogin(@Valid @RequestBody MobilePinLoginRequest request, HttpServletRequest servletRequest) {
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

        AppUser matchedUser = null;
        if (request.getUsername() != null && !request.getUsername().isBlank()) {
            try {
                String normalized = UsernameNormalizer.normalize(request.getUsername());
                AppUser target = appUserRepository.findByUsername(normalized).orElse(null);
                if (target != null && Boolean.TRUE.equals(target.getActive()) && target.getPinHash() != null) {
                    if (target.getRole() == UserRole.ADMIN) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(Map.of("message", "Administrator accounts are restricted to the Web Portal."));
                    }
                    if (passwordEncoder.matches(request.getPin(), target.getPinHash())) {
                        matchedUser = target;
                    }
                }
            } catch (IllegalArgumentException ignored) {}
        }

        if (matchedUser == null) {
            List<AppUser> activeUsersWithPin = appUserRepository.findByActiveTrueAndPinHashIsNotNull();
            matchedUser = activeUsersWithPin.stream()
                    .filter(user -> user.getRole() != UserRole.ADMIN)
                    .filter(user -> passwordEncoder.matches(request.getPin(), user.getPinHash()))
                    .findFirst()
                    .orElse(null);
        }

        if (matchedUser == null) {
            rateLimiterService.recordFailure(clientIp);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid PIN"));
        }

        rateLimiterService.recordSuccess(clientIp);

        String token = JwtTokenProvider.generateToken(matchedUser.getUserId(), matchedUser.getRole().name(), matchedUser.getTokenVersion());

        LoginResponse response = new LoginResponse(
                token,
                matchedUser.getUserId(),
                matchedUser.getUsername(),
                matchedUser.getFullName(),
                matchedUser.getRole().name(),
                matchedUser.getMustChangePassword(),
                true
        );

        return ResponseEntity.ok(response);
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
