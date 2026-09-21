package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.LoginRequest;
import com.tnl.logistics.dto.MobilePinLoginRequest;
import com.tnl.logistics.dto.MobilePinSetupRequest;
import com.tnl.logistics.dto.PasswordChangeRequest;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.MobileDeviceBinding;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.MobileDeviceBindingRepository;
import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.service.LoginRateLimiterService;
import com.tnl.logistics.service.AuthSecurityService;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.transaction.TestTransaction;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class MobileAuthIntegrationTest {

    private static final String OFFICE_DEVICE_TOKEN = "a".repeat(64);
    private static final String FIELD_DEVICE_TOKEN = "b".repeat(64);
    private static final String HAULER_DEVICE_TOKEN = "c".repeat(64);
    private static final String WRONG_DEVICE_TOKEN = "d".repeat(64);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private MobileDeviceBindingRepository mobileDeviceBindingRepository;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    @Autowired
    private LoginRateLimiterService rateLimiterService;

    @Autowired
    private AuthSecurityService authSecurityService;

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @BeforeEach
    void setUp() {
        rateLimiterService.reset();
        mobileDeviceBindingRepository.deleteAllInBatch();

        AppUser officeUser = appUserRepository.findByUsername("office").orElse(null);
        if (officeUser != null) {
            officeUser.setPinHash(passwordEncoder.encode("2222"));
            officeUser.setPasswordHash(passwordEncoder.encode("office123"));
            officeUser.setFullName("Office Staff");
            officeUser.setMustChangePassword(false);
            officeUser.setActive(true);
            officeUser.setTokenVersion(1);
            appUserRepository.save(officeUser);
            mobileDeviceBindingRepository.save(createBinding("dev-office-device", officeUser.getUserId(), OFFICE_DEVICE_TOKEN));
        }

        AppUser fieldUser = appUserRepository.findByUsername("field").orElse(null);
        if (fieldUser != null) {
            fieldUser.setPinHash(passwordEncoder.encode("0001"));
            fieldUser.setPasswordHash(passwordEncoder.encode("field123"));
            fieldUser.setFullName("Carlos Mendoza");
            fieldUser.setMustChangePassword(false);
            fieldUser.setActive(true);
            fieldUser.setTokenVersion(1);
            appUserRepository.save(fieldUser);
            mobileDeviceBindingRepository.save(createBinding("dev-field-device", fieldUser.getUserId(), FIELD_DEVICE_TOKEN));
        }

        AppUser haulerUser = appUserRepository.findByUsername("hauler1").orElse(null);
        if (haulerUser != null) {
            haulerUser.setPinHash(null);
            haulerUser.setPasswordHash(passwordEncoder.encode("field123"));
            haulerUser.setMustChangePassword(false);
            haulerUser.setActive(true);
            haulerUser.setTokenVersion(1);
            appUserRepository.save(haulerUser);
            mobileDeviceBindingRepository.save(createBinding("dev-hauler-device", haulerUser.getUserId(), HAULER_DEVICE_TOKEN));
        }
    }

    @AfterEach
    void restoreFixturesAfterNonTransactionalTest() {
        if (!TestTransaction.isActive()) {
            setUp();
        }
    }

    private MobileDeviceBinding createBinding(String deviceId, String userId, String rawToken) {
        MobileDeviceBinding binding = new MobileDeviceBinding(deviceId, userId, hashToken(rawToken));
        binding.setLastAuthenticatedAt(java.time.LocalDateTime.now());
        return binding;
    }

    @Test
    void testMobileLoginOfficeStaffSuccess() throws Exception {
        LoginRequest request = new LoginRequest("office", "office123");

        mockMvc.perform(post("/api/v1/auth/mobile-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.userId").value("USR-OFFICE"))
                .andExpect(jsonPath("$.username").value("office"))
                .andExpect(jsonPath("$.fullName").value("Office Staff"))
                .andExpect(jsonPath("$.role").value("OFFICE_STAFF"))
                .andExpect(jsonPath("$.hasPinSet").value(true))
                .andExpect(jsonPath("$.deviceId").isString())
                .andExpect(jsonPath("$.deviceToken").isString());
    }

    @Test
    void testMobileLoginFieldStaffSuccess() throws Exception {
        LoginRequest request = new LoginRequest("field", "field123");

        mockMvc.perform(post("/api/v1/auth/mobile-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.userId").value("USR-FIELD"))
                .andExpect(jsonPath("$.username").value("field"))
                .andExpect(jsonPath("$.fullName").value("Carlos Mendoza"))
                .andExpect(jsonPath("$.role").value("FIELD_STAFF"))
                .andExpect(jsonPath("$.hasPinSet").value(true))
                .andExpect(jsonPath("$.deviceId").isString())
                .andExpect(jsonPath("$.deviceToken").isString());
    }

    @Test
    void testMobileLoginFieldStaffWithoutPinRequiresSetup() throws Exception {
        LoginRequest request = new LoginRequest("hauler1", "field123");

        mockMvc.perform(post("/api/v1/auth/mobile-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.username").value("hauler1"))
                .andExpect(jsonPath("$.hasPinSet").value(false))
                .andExpect(jsonPath("$.deviceId").isString())
                .andExpect(jsonPath("$.deviceToken").isString());
    }

    @Test
    void testMobileLoginInvalidPasswordReturnsUnauthorized() throws Exception {
        LoginRequest request = new LoginRequest("field", "wrongpassword");

        mockMvc.perform(post("/api/v1/auth/mobile-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }

    @Test
    void testMobileLoginPasswordChangeRequiredDoesNotCreateDeviceBinding() throws Exception {
        AppUser fieldUser = appUserRepository.findByUsername("field").orElseThrow();
        fieldUser.setMustChangePassword(true);
        appUserRepository.saveAndFlush(fieldUser);

        LoginRequest request = new LoginRequest("field", "field123");

        mockMvc.perform(post("/api/v1/auth/mobile-login")
                        .header("X-Device-Id", "rotation-pending-device")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mustChangePassword").value(true))
                .andExpect(jsonPath("$.token").isString());

        org.junit.jupiter.api.Assertions.assertTrue(
                mobileDeviceBindingRepository.findByDeviceId("rotation-pending-device").isEmpty(),
                "A password-rotation session must not bind a device"
        );
    }

    @Test
    void testMobilePinLoginPasswordChangeRequiredReturnsForbidden() throws Exception {
        AppUser fieldUser = appUserRepository.findByUsername("field").orElseThrow();
        fieldUser.setMustChangePassword(true);
        appUserRepository.saveAndFlush(fieldUser);

        MobilePinLoginRequest request = new MobilePinLoginRequest("0001", "field", "dev-field-device", FIELD_DEVICE_TOKEN);

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));
    }

    @Test
    void testPasswordChangeThenFreshMobileLoginReturnsDeviceCredentials() throws Exception {
        AppUser fieldUser = appUserRepository.findByUsername("field").orElseThrow();
        fieldUser.setMustChangePassword(true);
        appUserRepository.saveAndFlush(fieldUser);

        LoginRequest loginRequest = new LoginRequest("field", "field123");
        String provisionalToken = objectMapper.readTree(mockMvc.perform(post("/api/v1/auth/mobile-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mustChangePassword").value(true))
                .andReturn().getResponse().getContentAsString()).get("token").asText();

        PasswordChangeRequest passwordChangeRequest = new PasswordChangeRequest("field123", "newField123");
        mockMvc.perform(post("/api/v1/auth/password-change")
                        .header("Authorization", "Bearer " + provisionalToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(passwordChangeRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mustChangePassword").value(false));

        LoginRequest freshLoginRequest = new LoginRequest("field", "newField123");
        mockMvc.perform(post("/api/v1/auth/mobile-login")
                        .header("X-Device-Id", "rotation-complete-device")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(freshLoginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mustChangePassword").value(false))
                .andExpect(jsonPath("$.deviceId").value("rotation-complete-device"))
                .andExpect(jsonPath("$.deviceToken").isString());
    }

    @Test
    void testMobileSetupPinSuccess() throws Exception {
        AppUser haulerUser = appUserRepository.findByUsername("hauler1").orElseThrow();
        String token = JwtTokenProvider.generateToken(haulerUser.getUserId(), haulerUser.getRole().name(), haulerUser.getTokenVersion());

        MobilePinSetupRequest setupRequest = new MobilePinSetupRequest("7777");

        mockMvc.perform(post("/api/v1/auth/mobile-setup-pin")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Device-Id", "dev-hauler-device")
                        .header("X-Device-Token", HAULER_DEVICE_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(setupRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("PIN updated successfully"))
                .andExpect(jsonPath("$.hasPinSet").value(true))
                .andExpect(jsonPath("$.token").isString());

        // Subsequent PIN login should succeed with bound device
        MobilePinLoginRequest loginRequest = new MobilePinLoginRequest("7777", "hauler1", "dev-hauler-device", HAULER_DEVICE_TOKEN);
        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("hauler1"));
    }

    @Test
    void testMobileSetupPinIncrementsTokenVersionAndRevokesOldToken() throws Exception {
        AppUser haulerUser = appUserRepository.findByUsername("hauler1").orElseThrow();
        String oldToken = JwtTokenProvider.generateToken(haulerUser.getUserId(), haulerUser.getRole().name(), haulerUser.getTokenVersion());

        // Pre-check: old token works
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isOk());

        MobilePinSetupRequest setupRequest = new MobilePinSetupRequest("8888");

        String responseJson = mockMvc.perform(post("/api/v1/auth/mobile-setup-pin")
                        .header("Authorization", "Bearer " + oldToken)
                        .header("X-Device-Id", "dev-hauler-device")
                        .header("X-Device-Token", HAULER_DEVICE_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(setupRequest)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode root = objectMapper.readTree(responseJson);
        String newToken = root.get("token").asText();
        assertNotNull(newToken);

        // Old token must now require session renewal.
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));

        // New token must authenticate cleanly (HTTP 200)
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + newToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("hauler1"));
    }

    @Test
    void testMobileSetupPinRequiresPasswordChangeFirst() throws Exception {
        AppUser haulerUser = appUserRepository.findByUsername("hauler1").orElseThrow();
        haulerUser.setMustChangePassword(true);
        appUserRepository.save(haulerUser);

        String token = JwtTokenProvider.generateToken(haulerUser.getUserId(), haulerUser.getRole().name(), haulerUser.getTokenVersion());
        MobilePinSetupRequest setupRequest = new MobilePinSetupRequest("4444");

        mockMvc.perform(post("/api/v1/auth/mobile-setup-pin")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Device-Id", "dev-hauler-device")
                        .header("X-Device-Token", HAULER_DEVICE_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(setupRequest)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));
    }

    @Test
    void testMobileSetupPinInvalidFormatReturnsBadRequest() throws Exception {
        AppUser haulerUser = appUserRepository.findByUsername("hauler1").orElseThrow();
        String token = JwtTokenProvider.generateToken(haulerUser.getUserId(), haulerUser.getRole().name(), haulerUser.getTokenVersion());

        MobilePinSetupRequest setupRequest = new MobilePinSetupRequest("12"); // < 4 digits

        mockMvc.perform(post("/api/v1/auth/mobile-setup-pin")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Device-Id", "dev-hauler-device")
                        .header("X-Device-Token", HAULER_DEVICE_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(setupRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testMobilePinLoginOfficeStaffSuccess() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("2222", "office", "dev-office-device", OFFICE_DEVICE_TOKEN);

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.userId").value("USR-OFFICE"))
                .andExpect(jsonPath("$.username").value("office"))
                .andExpect(jsonPath("$.fullName").value("Office Staff"))
                .andExpect(jsonPath("$.role").value("OFFICE_STAFF"))
                .andExpect(jsonPath("$.deviceId").value("dev-office-device"))
                .andExpect(jsonPath("$.deviceToken").value(OFFICE_DEVICE_TOKEN));
    }

    @Test
    void testMobilePinLoginFieldStaffSuccess() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("0001", "field", "dev-field-device", FIELD_DEVICE_TOKEN);

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.userId").value("USR-FIELD"))
                .andExpect(jsonPath("$.username").value("field"))
                .andExpect(jsonPath("$.fullName").value("Carlos Mendoza"))
                .andExpect(jsonPath("$.role").value("FIELD_STAFF"));
    }

    @Test
    void testMobilePinLoginMissingDeviceCredentialsReturnsUnauthorized() throws Exception {
        // Missing deviceId and deviceToken use the generic device-credential response.
        MobilePinLoginRequest request = new MobilePinLoginRequest("0001", "field");

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_DEVICE_CREDENTIALS"));
    }

    @Test
    void testMobilePinLoginRejectsUnboundDevice() throws Exception {
        // Unknown deviceId not found in DB must be rejected with 401
        MobilePinLoginRequest request = new MobilePinLoginRequest("0001", "field", "unregistered-device-id", WRONG_DEVICE_TOKEN);

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_DEVICE_CREDENTIALS"));
    }

    @Test
    void testMobilePinLoginRejectsDeviceMismatch() throws Exception {
        // dev-office-device is bound to USR-OFFICE, attempting to log in as 'field' must be rejected
        MobilePinLoginRequest request = new MobilePinLoginRequest("0001", "field", "dev-office-device", OFFICE_DEVICE_TOKEN);

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_DEVICE_CREDENTIALS"));
    }

    @Test
    void testMobilePinLoginRejectsTokenMismatch() throws Exception {
        // Correct deviceId but wrong token secret must fail with 401
        MobilePinLoginRequest request = new MobilePinLoginRequest("0001", "field", "dev-field-device", WRONG_DEVICE_TOKEN);

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_DEVICE_CREDENTIALS"));
    }

    @Test
    void testMobilePinLoginTargetedWrongPinReturnsUnauthorized() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("9999", "field", "dev-field-device", FIELD_DEVICE_TOKEN);

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid PIN"));
    }

    @Test
    void testMobilePinLoginInvalidPinReturnsUnauthorized() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("9999", "office", "dev-office-device", OFFICE_DEVICE_TOKEN);

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid PIN"));
    }

    @Test
    void testMobilePinLoginInvalidFormatReturnsBadRequest() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("12", "office", "dev-office-device", OFFICE_DEVICE_TOKEN); // less than 4 digits

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testMobilePinLoginRateLimiterLockout() throws Exception {
        MobilePinLoginRequest badRequest = new MobilePinLoginRequest("9999", "office", "dev-office-device", OFFICE_DEVICE_TOKEN);

        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(badRequest)))
                    .andExpect(status().isUnauthorized());
        }

        // 6th attempt should be blocked with 429
        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badRequest)))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.retryAfterSeconds").isNumber());
    }

    @Test
    void testRateLimiterIsolatesStatusFromLogin() throws Exception {
        rateLimiterService.reset();

        // 5 failed calls on /mobile-pin-status lock out status probes
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(get("/api/v1/auth/mobile-pin-status")
                            .param("username", "ghostuser" + i))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.hasPinSet").value(false));
        }

        // 6th status probe is blocked
        mockMvc.perform(get("/api/v1/auth/mobile-pin-status")
                        .param("username", "office"))
                .andExpect(status().isTooManyRequests());

        // But PIN login and password login for office remain completely accessible and succeed!
        MobilePinLoginRequest loginRequest = new MobilePinLoginRequest("2222", "office", "dev-office-device", OFFICE_DEVICE_TOKEN);
        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("office"));
    }

    @Test
    void testRateLimiterBlocksAccountAcrossRotatedIps() throws Exception {
        rateLimiterService.reset();

        // Target 'office' account with bad PIN attempts across rotating client IPs
        for (int i = 1; i <= 5; i++) {
            final String remoteIp = "10.0.0." + i;
            MobilePinLoginRequest badRequest = new MobilePinLoginRequest("9999", "office", "dev-office-device", OFFICE_DEVICE_TOKEN);
            mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                            .with(request -> {
                                request.setRemoteAddr(remoteIp);
                                return request;
                            })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(badRequest)))
                    .andExpect(status().isUnauthorized());
        }

        // Even with a completely new 6th IP, the account-level bucket locks out attacks against 'office'
        MobilePinLoginRequest badRequest = new MobilePinLoginRequest("9999", "office", "dev-office-device", OFFICE_DEVICE_TOKEN);
        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .with(request -> {
                            request.setRemoteAddr("10.0.0.99");
                            return request;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badRequest)))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    void testRateLimiterKeepsMobilePasswordFailuresSeparateFromPinUnlock() throws Exception {
        rateLimiterService.reset();
        LoginRequest badPasswordRequest = new LoginRequest("office", "wrongpassword");

        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/v1/auth/mobile-login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(badPasswordRequest)))
                    .andExpect(status().isUnauthorized());
        }

        MobilePinLoginRequest pinLoginRequest = new MobilePinLoginRequest(
                "2222", "office", "dev-office-device", OFFICE_DEVICE_TOKEN
        );
        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pinLoginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("office"));
    }

    @Test
    void testRateLimiterKeepsPinFailuresSeparateFromMobilePasswordLogin() throws Exception {
        rateLimiterService.reset();
        MobilePinLoginRequest badPinRequest = new MobilePinLoginRequest(
                "9999", "office", "dev-office-device", OFFICE_DEVICE_TOKEN
        );

        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(badPinRequest)))
                    .andExpect(status().isUnauthorized());
        }

        LoginRequest passwordLoginRequest = new LoginRequest("office", "office123");
        mockMvc.perform(post("/api/v1/auth/mobile-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(passwordLoginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("office"));
    }

    @Test
    void testMobilePinStatusDoesNotEnumerateAccounts() throws Exception {
        // Nonexistent user returns uniform 200 hasPinSet=false
        mockMvc.perform(get("/api/v1/auth/mobile-pin-status")
                        .param("username", "doesnotexist"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("doesnotexist"))
                .andExpect(jsonPath("$.hasPinSet").value(false));

        // Admin account returns uniform 200 hasPinSet=false
        mockMvc.perform(get("/api/v1/auth/mobile-pin-status")
                        .param("username", "admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("admin"))
                .andExpect(jsonPath("$.hasPinSet").value(false));
    }

    @Test
    void testMobilePinStatusRequiresMatchingDeviceCredential() throws Exception {
        mockMvc.perform(get("/api/v1/auth/mobile-pin-status")
                        .param("username", "office"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("office"))
                .andExpect(jsonPath("$.hasPinSet").value(false));

        mockMvc.perform(get("/api/v1/auth/mobile-pin-status")
                        .param("username", "office")
                        .header("X-Device-Id", "dev-office-device")
                        .header("X-Device-Token", WRONG_DEVICE_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("office"))
                .andExpect(jsonPath("$.hasPinSet").value(false));

        mockMvc.perform(get("/api/v1/auth/mobile-pin-status")
                        .param("username", "field")
                        .header("X-Device-Id", "dev-office-device")
                        .header("X-Device-Token", OFFICE_DEVICE_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("field"))
                .andExpect(jsonPath("$.hasPinSet").value(false));
    }

    @Test
    void testGetCurrentUserIncludesHasPinSet() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseThrow();
        String token = JwtTokenProvider.generateToken(officeUser.getUserId(), officeUser.getRole().name(), officeUser.getTokenVersion());

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("office"))
                .andExpect(jsonPath("$.hasPinSet").value(true));
    }

    @Test
    void testMobileLoginAdminRestrictedReturnsForbidden() throws Exception {
        LoginRequest request = new LoginRequest("admin", "admin123");

        mockMvc.perform(post("/api/v1/auth/mobile-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Administrator accounts are restricted to the Web Portal."));
    }

    @Test
    void testMobilePinLoginAdminTargetedWithInvalidDeviceReturnsUnauthorized() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("1111", "admin", "dev-office-device", OFFICE_DEVICE_TOKEN);

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_DEVICE_CREDENTIALS"));
    }

    @Test
    void testMobilePinLoginMissingUsernameReturnsBadRequest() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("1111", null, "dev-office-device", OFFICE_DEVICE_TOKEN);

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testMobileSetupPinAdminRestrictedReturnsForbidden() throws Exception {
        AppUser adminUser = appUserRepository.findByUsername("admin").orElseThrow();
        String token = JwtTokenProvider.generateToken(adminUser.getUserId(), adminUser.getRole().name(), adminUser.getTokenVersion());

        MobilePinSetupRequest setupRequest = new MobilePinSetupRequest("5555");

        mockMvc.perform(post("/api/v1/auth/mobile-setup-pin")
                        .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(setupRequest)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("MOBILE_ROLE_REQUIRED"));

        mockMvc.perform(post("/api/v1/auth/mobile-unbind")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Device-Id", "dev-office-device")
                        .header("X-Device-Token", OFFICE_DEVICE_TOKEN))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("MOBILE_ROLE_REQUIRED"));
    }

    @Test
    void testMobilePinLoginWhenPinClearedReturnsConflictPinNotSet() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("0000", "hauler1", "dev-hauler-device", HAULER_DEVICE_TOKEN);

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PIN_NOT_SET"))
                .andExpect(jsonPath("$.hasPinSet").value(false))
                .andExpect(jsonPath("$.message").value("Your PIN has been cleared by an administrator. Please sign in with your password to set up a new PIN."));
    }

    @Test
    void testMobilePinLoginWhenPinClearedDoesNotTriggerRateLimitLockout() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("0000", "hauler1", "dev-hauler-device", HAULER_DEVICE_TOKEN);

        for (int i = 0; i < 6; i++) {
            mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("PIN_NOT_SET"));
        }
    }

    @Test
    void testMobilePinStatusReturnsHasPinSetFalseWhenCleared() throws Exception {
        mockMvc.perform(get("/api/v1/auth/mobile-pin-status")
                        .param("username", "hauler1")
                        .header("X-Device-Id", "dev-hauler-device")
                        .header("X-Device-Token", HAULER_DEVICE_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("hauler1"))
                .andExpect(jsonPath("$.hasPinSet").value(false))
                .andExpect(jsonPath("$.role").doesNotExist())
                .andExpect(jsonPath("$.fullName").doesNotExist());
    }

    @Test
    void testMobilePinStatusReturnsHasPinSetTrueWhenConfigured() throws Exception {
        mockMvc.perform(get("/api/v1/auth/mobile-pin-status")
                        .param("username", "office")
                        .header("X-Device-Id", "dev-office-device")
                        .header("X-Device-Token", OFFICE_DEVICE_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("office"))
                .andExpect(jsonPath("$.hasPinSet").value(true))
                .andExpect(jsonPath("$.role").doesNotExist())
                .andExpect(jsonPath("$.fullName").doesNotExist());
    }

    @Test
    void testCurrentUserReturnsCanonicalMaskedMobileProfileWithoutSecrets() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseThrow();
        String token = JwtTokenProvider.generateToken(
                officeUser.getUserId(), officeUser.getRole().name(), officeUser.getTokenVersion());

        String response = mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Device-Id", "dev-office-device")
                        .header("X-Device-Token", OFFICE_DEVICE_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value("USR-OFFICE"))
                .andExpect(jsonPath("$.username").value("office"))
                .andExpect(jsonPath("$.fullName").value("Office Staff"))
                .andExpect(jsonPath("$.role").value("OFFICE_STAFF"))
                .andExpect(jsonPath("$.mustChangePassword").value(false))
                .andExpect(jsonPath("$.hasPinSet").value(true))
                .andExpect(jsonPath("$.deviceBinding.maskedDeviceId").value("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022e-device"))
                .andExpect(jsonPath("$.deviceBinding.active").value(true))
                .andExpect(jsonPath("$.deviceBinding.lastAuthenticatedAt").isString())
                .andReturn().getResponse().getContentAsString();

        assertFalse(response.contains("dev-office-device"));
        assertFalse(response.contains(OFFICE_DEVICE_TOKEN));
        assertFalse(response.contains(officeUser.getPasswordHash()));
        assertFalse(response.contains(officeUser.getPinHash()));
        assertFalse(response.contains("deviceTokenHash"));
        assertFalse(response.contains("\"id\""));
    }

    @Test
    void testCurrentUserSupportsFieldProfileAndWebSession() throws Exception {
        AppUser fieldUser = appUserRepository.findByUsername("field").orElseThrow();
        String fieldToken = JwtTokenProvider.generateToken(
                fieldUser.getUserId(), fieldUser.getRole().name(), fieldUser.getTokenVersion());

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + fieldToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("FIELD_STAFF"))
                .andExpect(jsonPath("$.deviceBinding").doesNotExist());

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + fieldToken)
                        .header("X-Device-Id", "dev-field-device")
                        .header("X-Device-Token", FIELD_DEVICE_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deviceBinding.active").value(true));
    }

    @Test
    void testCurrentUserRejectsIncompleteMalformedAndMismatchedDeviceCredentials() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseThrow();
        String token = JwtTokenProvider.generateToken(
                officeUser.getUserId(), officeUser.getRole().name(), officeUser.getTokenVersion());

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Device-Id", "dev-office-device"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_DEVICE_CREDENTIALS"));

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Device-Id", "bad device")
                        .header("X-Device-Token", OFFICE_DEVICE_TOKEN))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_DEVICE_CREDENTIALS"));

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Device-Id", "dev-office-device")
                        .header("X-Device-Token", WRONG_DEVICE_TOKEN))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_DEVICE_CREDENTIALS"));
    }

    @Test
    void testPasswordRotationReturnsReplacementTokenAndPreservesBindings() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseThrow();
        mobileDeviceBindingRepository.save(createBinding(
                "dev-office-secondary", officeUser.getUserId(), "e".repeat(64)));
        int originalVersion = officeUser.getTokenVersion();
        String oldToken = JwtTokenProvider.generateToken(
                officeUser.getUserId(), officeUser.getRole().name(), originalVersion);

        String response = mockMvc.perform(post("/api/v1/auth/password-change")
                        .header("Authorization", "Bearer " + oldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new PasswordChangeRequest("office123", "office456"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Office Staff"))
                .andExpect(jsonPath("$.hasPinSet").value(true))
                .andReturn().getResponse().getContentAsString();

        String replacementToken = objectMapper.readTree(response).get("token").asText();
        AppUser updatedUser = appUserRepository.findById(officeUser.getUserId()).orElseThrow();
        assertEquals(originalVersion + 1, updatedUser.getTokenVersion());
        assertEquals(2, mobileDeviceBindingRepository.findByUserIdAndActiveTrue(officeUser.getUserId()).size());

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + replacementToken))
                .andExpect(status().isOk());
    }

    @Test
    void testPasswordRotationRejectsInvalidInputsWithoutMutation() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseThrow();
        int originalVersion = officeUser.getTokenVersion();
        String originalHash = officeUser.getPasswordHash();
        String token = JwtTokenProvider.generateToken(
                officeUser.getUserId(), officeUser.getRole().name(), originalVersion);

        List<PasswordChangeRequest> requests = List.of(
                new PasswordChangeRequest("wrong-password", "validNew123"),
                new PasswordChangeRequest("office123", "office123"),
                new PasswordChangeRequest("office123", "short"),
                new PasswordChangeRequest("office123", "x".repeat(129)),
                new PasswordChangeRequest("", "validNew123"));

        for (PasswordChangeRequest request : requests) {
            mockMvc.perform(post("/api/v1/auth/password-change")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }

        AppUser unchangedUser = appUserRepository.findById(officeUser.getUserId()).orElseThrow();
        assertEquals(originalVersion, unchangedUser.getTokenVersion());
        assertEquals(originalHash, unchangedUser.getPasswordHash());
    }

    @Test
    void testPasswordAndVerificationRateLimitsAreIsolated() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseThrow();
        String token = JwtTokenProvider.generateToken(
                officeUser.getUserId(), officeUser.getRole().name(), officeUser.getTokenVersion());

        for (int attempt = 0; attempt < 5; attempt++) {
            mockMvc.perform(post("/api/v1/auth/verify-password")
                            .header("Authorization", "Bearer " + token)
                            .with(request -> { request.setRemoteAddr("10.20.30.40"); return request; })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"password\":\"wrong-password\"}"))
                    .andExpect(status().isBadRequest());
        }

        mockMvc.perform(post("/api/v1/auth/password-change")
                        .header("Authorization", "Bearer " + token)
                        .with(request -> { request.setRemoteAddr("10.20.30.40"); return request; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new PasswordChangeRequest("office123", "office456"))))
                .andExpect(status().isOk());

        MobilePinLoginRequest pinLogin = new MobilePinLoginRequest(
                "2222", "office", "dev-office-device", OFFICE_DEVICE_TOKEN);
        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pinLogin)))
                .andExpect(status().isOk());
    }

    @Test
    void testInitialPinRequiresRecentJwtAndBindingWithClockSkewAllowance() throws Exception {
        AppUser haulerUser = appUserRepository.findByUsername("hauler1").orElseThrow();
        MobileDeviceBinding binding = mobileDeviceBindingRepository.findByDeviceId("dev-hauler-device").orElseThrow();
        long now = System.currentTimeMillis() / 1000;

        binding.setLastAuthenticatedAt(LocalDateTime.now().plusSeconds(50));
        mobileDeviceBindingRepository.saveAndFlush(binding);
        String skewedToken = JwtTokenProvider.generateToken(
                haulerUser.getUserId(), haulerUser.getRole().name(), haulerUser.getTokenVersion(),
                now + 50, now + 3600);
        mockMvc.perform(post("/api/v1/auth/mobile-setup-pin")
                        .header("Authorization", "Bearer " + skewedToken)
                        .header("X-Device-Id", "dev-hauler-device")
                        .header("X-Device-Token", HAULER_DEVICE_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pin\":\"4821\"}"))
                .andExpect(status().isOk());

        haulerUser = appUserRepository.findByUsername("hauler1").orElseThrow();
        haulerUser.setPinHash(null);
        haulerUser.setTokenVersion(1);
        appUserRepository.saveAndFlush(haulerUser);
        binding.setLastAuthenticatedAt(LocalDateTime.now().minusMinutes(7));
        mobileDeviceBindingRepository.saveAndFlush(binding);
        String freshToken = JwtTokenProvider.generateToken(
                haulerUser.getUserId(), haulerUser.getRole().name(), 1);
        mockMvc.perform(post("/api/v1/auth/mobile-setup-pin")
                        .header("Authorization", "Bearer " + freshToken)
                        .header("X-Device-Id", "dev-hauler-device")
                        .header("X-Device-Token", HAULER_DEVICE_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pin\":\"4821\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_REAUTH_REQUIRED"));

        AppUser unchangedUser = appUserRepository.findByUsername("hauler1").orElseThrow();
        assertNull(unchangedUser.getPinHash());
        assertEquals(1, unchangedUser.getTokenVersion());
    }

    @Test
    void testPinRotationRequiresPasswordRejectsReuseAndPreservesOtherBindings() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseThrow();
        mobileDeviceBindingRepository.save(createBinding(
                "dev-office-secondary", officeUser.getUserId(), "e".repeat(64)));
        String token = JwtTokenProvider.generateToken(
                officeUser.getUserId(), officeUser.getRole().name(), officeUser.getTokenVersion());

        mockMvc.perform(post("/api/v1/auth/mobile-setup-pin")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Device-Id", "dev-office-device")
                        .header("X-Device-Token", OFFICE_DEVICE_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pin\":\"3333\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_REAUTH_REQUIRED"));

        mockMvc.perform(post("/api/v1/auth/mobile-setup-pin")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Device-Id", "dev-office-device")
                        .header("X-Device-Token", OFFICE_DEVICE_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pin\":\"2222\",\"currentPassword\":\"office123\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PIN_REUSE_NOT_ALLOWED"));

        String response = mockMvc.perform(post("/api/v1/auth/mobile-setup-pin")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Device-Id", "dev-office-device")
                        .header("X-Device-Token", OFFICE_DEVICE_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pin\":\"3333\",\"currentPassword\":\"office123\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        String replacementToken = objectMapper.readTree(response).get("token").asText();
        assertEquals(2, appUserRepository.findById(officeUser.getUserId()).orElseThrow().getTokenVersion());
        assertEquals(2, mobileDeviceBindingRepository.findByUserIdAndActiveTrue(officeUser.getUserId()).size());

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new MobilePinLoginRequest(
                                "2222", "office", "dev-office-device", OFFICE_DEVICE_TOKEN))))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .header("Authorization", "Bearer " + replacementToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new MobilePinLoginRequest(
                                "3333", "office", "dev-office-device", OFFICE_DEVICE_TOKEN))))
                .andExpect(status().isOk());
    }

    @Test
    void testPinValidationRejectsEveryNonFourAsciiDigitShape() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseThrow();
        String token = JwtTokenProvider.generateToken(
                officeUser.getUserId(), officeUser.getRole().name(), officeUser.getTokenVersion());
        List<String> invalidPins = java.util.Arrays.asList(
                "123", "12345", "123456", "12a4", "\u0661\u0662\u0663\u0664", "+123", "12.3", " 123", "", null);

        for (String pin : invalidPins) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("pin", pin);
            payload.put("currentPassword", "office123");
            mockMvc.perform(post("/api/v1/auth/mobile-setup-pin")
                            .header("Authorization", "Bearer " + token)
                            .header("X-Device-Id", "dev-office-device")
                            .header("X-Device-Token", OFFICE_DEVICE_TOKEN)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(payload)))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void testCurrentDeviceUnbindIsAtomicAndLeavesOtherBindingsActive() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseThrow();
        mobileDeviceBindingRepository.save(createBinding(
                "dev-office-secondary", officeUser.getUserId(), "e".repeat(64)));
        int originalVersion = officeUser.getTokenVersion();
        String token = JwtTokenProvider.generateToken(
                officeUser.getUserId(), officeUser.getRole().name(), originalVersion);

        mockMvc.perform(post("/api/v1/auth/mobile-unbind")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Device-Id", "dev-office-device")
                        .header("X-Device-Token", OFFICE_DEVICE_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unbound").value(true));

        assertFalse(Boolean.TRUE.equals(mobileDeviceBindingRepository
                .findByDeviceId("dev-office-device").orElseThrow().getActive()));
        assertTrue(Boolean.TRUE.equals(mobileDeviceBindingRepository
                .findByDeviceId("dev-office-secondary").orElseThrow().getActive()));
        assertEquals(originalVersion + 1,
                appUserRepository.findById(officeUser.getUserId()).orElseThrow().getTokenVersion());
    }

    @Test
    void testFailedUnbindDoesNotMutateBindingOrTokenVersion() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseThrow();
        int originalVersion = officeUser.getTokenVersion();
        String token = JwtTokenProvider.generateToken(
                officeUser.getUserId(), officeUser.getRole().name(), originalVersion);

        mockMvc.perform(post("/api/v1/auth/mobile-unbind")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Device-Id", "dev-office-device")
                        .header("X-Device-Token", WRONG_DEVICE_TOKEN))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_DEVICE_CREDENTIALS"));

        assertTrue(Boolean.TRUE.equals(mobileDeviceBindingRepository
                .findByDeviceId("dev-office-device").orElseThrow().getActive()));
        assertEquals(originalVersion,
                appUserRepository.findById(officeUser.getUserId()).orElseThrow().getTokenVersion());
    }

    @Test
    void testObsoleteBearerDoesNotBlockPublicPinLogin() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseThrow();
        String obsoleteToken = JwtTokenProvider.generateToken(
                officeUser.getUserId(), officeUser.getRole().name(), officeUser.getTokenVersion() + 20);

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .header("Authorization", "Bearer " + obsoleteToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new MobilePinLoginRequest(
                                "2222", "office", "dev-office-device", OFFICE_DEVICE_TOKEN))))
                .andExpect(status().isOk());
    }

    @Test
    void testSecurityAuditEventsNeverContainSubmittedSecrets() throws Exception {
        Logger logger = (Logger) org.slf4j.LoggerFactory.getLogger("SECURITY_AUDIT");
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        String submittedPassword = "secret-wrong-password";
        String submittedPin = "3333";
        String malformedDeviceId = "bad device identifier";

        try {
            AppUser officeUser = appUserRepository.findByUsername("office").orElseThrow();
            String token = JwtTokenProvider.generateToken(
                    officeUser.getUserId(), officeUser.getRole().name(), officeUser.getTokenVersion());

            mockMvc.perform(post("/api/v1/auth/verify-password")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new com.tnl.logistics.dto.PasswordVerificationRequest(submittedPassword))))
                    .andExpect(status().isBadRequest());

            for (int attempt = 0; attempt < 4; attempt++) {
                mockMvc.perform(post("/api/v1/auth/verify-password")
                                .header("Authorization", "Bearer " + token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(
                                        new com.tnl.logistics.dto.PasswordVerificationRequest(submittedPassword))))
                        .andExpect(status().isBadRequest());
            }
            mockMvc.perform(post("/api/v1/auth/verify-password")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new com.tnl.logistics.dto.PasswordVerificationRequest(submittedPassword))))
                    .andExpect(status().isTooManyRequests());

            mockMvc.perform(post("/api/v1/auth/password-change")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new PasswordChangeRequest("office123", "short"))))
                    .andExpect(status().isBadRequest());
            mockMvc.perform(post("/api/v1/auth/password-change")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"oldPassword\":\"malformed-secret\",\"newPassword\":"))
                    .andExpect(status().isBadRequest());

            mockMvc.perform(post("/api/v1/auth/mobile-setup-pin")
                            .header("Authorization", "Bearer " + token)
                            .header("X-Device-Id", malformedDeviceId)
                            .header("X-Device-Token", OFFICE_DEVICE_TOKEN)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"pin\":\"" + submittedPin + "\",\"currentPassword\":\"office123\"}"))
                    .andExpect(status().isUnauthorized());

            String staleToken = JwtTokenProvider.generateToken(
                    officeUser.getUserId(), officeUser.getRole().name(), officeUser.getTokenVersion() + 1);
            mockMvc.perform(post("/api/v1/auth/mobile-unbind")
                            .header("Authorization", "Bearer " + staleToken)
                            .header("X-Device-Id", "dev-office-device")
                            .header("X-Device-Token", OFFICE_DEVICE_TOKEN))
                    .andExpect(status().isUnauthorized());

            AppUser adminUser = appUserRepository.findById("USR-ADMIN").orElseThrow();
            String adminToken = JwtTokenProvider.generateToken(
                    adminUser.getUserId(), adminUser.getRole().name(), adminUser.getTokenVersion());
            mockMvc.perform(post("/api/v1/auth/mobile-unbind")
                            .header("Authorization", "Bearer " + adminToken)
                            .header("X-Device-Id", "dev-office-device")
                            .header("X-Device-Token", OFFICE_DEVICE_TOKEN))
                    .andExpect(status().isForbidden());

            mockMvc.perform(post("/api/v1/auth/mobile-setup-pin")
                            .header("Authorization", "Bearer " + token)
                            .header("X-Device-Id", "dev-office-device")
                            .header("X-Device-Token", OFFICE_DEVICE_TOKEN)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"pin\":\"" + submittedPin + "\",\"currentPassword\":\"office123\"}"))
                    .andExpect(status().isOk());

            String auditText = appender.list.stream()
                    .map(ILoggingEvent::getFormattedMessage)
                    .reduce("", (left, right) -> left + "\n" + right);
            assertTrue(auditText.contains("PASSWORD_VERIFY_FAILURE"));
            assertTrue(auditText.contains("reason=RATE_LIMITED"));
            assertTrue(auditText.contains("PASSWORD_CHANGE_FAILURE"));
            assertTrue(auditText.contains("reason=VALIDATION_FAILED"));
            assertTrue(auditText.contains("reason=MALFORMED_REQUEST"));
            assertTrue(auditText.contains("PIN_ROTATION_FAILURE"));
            assertTrue(auditText.contains("reason=INVALID_DEVICE_CREDENTIALS"));
            assertTrue(auditText.contains("DEVICE_UNBIND_FAILURE"));
            assertTrue(auditText.contains("reason=SESSION_REAUTH_REQUIRED"));
            assertTrue(auditText.contains("reason=MOBILE_ROLE_REQUIRED"));
            assertTrue(auditText.contains("PIN_ROTATION_SUCCESS"));
            assertFalse(auditText.contains(submittedPassword));
            assertFalse(auditText.contains(submittedPin));
            assertFalse(auditText.contains(malformedDeviceId));
            assertFalse(auditText.contains("malformed-secret"));
            assertFalse(auditText.contains(OFFICE_DEVICE_TOKEN));
            assertFalse(auditText.contains("Bearer"));
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void testConcurrentPasswordChangesSerializeWithoutLostUpdate() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseThrow();
        List<Object> results = runConcurrently(
                () -> authSecurityService.changePassword(
                        officeUser.getUserId(), 1, "office123", "office456", "10.0.1.1"),
                () -> authSecurityService.changePassword(
                        officeUser.getUserId(), 1, "office123", "office789", "10.0.1.2"));

        assertEquals(1, results.stream().filter(AuthSecurityService.AuthenticatedUserSnapshot.class::isInstance).count());
        assertEquals(1, results.stream().filter(Throwable.class::isInstance).count());
        assertEquals(2, appUserRepository.findById(officeUser.getUserId()).orElseThrow().getTokenVersion());
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void testConcurrentPasswordAndPinRotationSerializeWithoutLostUpdateOrDeadlock() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseThrow();
        long issuedAt = System.currentTimeMillis() / 1000;
        List<Object> results = runConcurrently(
                () -> authSecurityService.changePassword(
                        officeUser.getUserId(), 1, "office123", "office456", "10.0.4.1"),
                () -> authSecurityService.updatePin(
                        officeUser.getUserId(), 1, issuedAt, "3333", "office123",
                        "dev-office-device", OFFICE_DEVICE_TOKEN, "10.0.4.2"));

        assertEquals(1, results.stream().filter(
                result -> result instanceof AuthSecurityService.AuthenticatedUserSnapshot
                        || result instanceof AuthSecurityService.PinUpdateResult).count());
        assertEquals(1, results.stream().filter(Throwable.class::isInstance).count());
        assertEquals(2, appUserRepository.findById(officeUser.getUserId()).orElseThrow().getTokenVersion());
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void testConcurrentPinRotationAndUnbindCannotReactivateDeviceOrDeadlock() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseThrow();
        long issuedAt = System.currentTimeMillis() / 1000;
        List<Object> results = runConcurrently(
                () -> authSecurityService.updatePin(
                        officeUser.getUserId(), 1, issuedAt, "3333", "office123",
                        "dev-office-device", OFFICE_DEVICE_TOKEN, "10.0.2.1"),
                () -> authSecurityService.unbindCurrentDevice(
                        officeUser.getUserId(), 1, "dev-office-device", OFFICE_DEVICE_TOKEN, "10.0.2.2"));

        assertTrue(results.stream().anyMatch(AuthSecurityService.UnbindResult.class::isInstance));
        assertFalse(Boolean.TRUE.equals(mobileDeviceBindingRepository
                .findByDeviceId("dev-office-device").orElseThrow().getActive()));
        assertTrue(appUserRepository.findById(officeUser.getUserId()).orElseThrow().getTokenVersion() >= 2);
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void testConcurrentUnbindRequestsCannotLoseVersionUpdateOrDeadlock() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseThrow();
        List<Object> results = runConcurrently(
                () -> authSecurityService.unbindCurrentDevice(
                        officeUser.getUserId(), 1, "dev-office-device", OFFICE_DEVICE_TOKEN, "10.0.3.1"),
                () -> authSecurityService.unbindCurrentDevice(
                        officeUser.getUserId(), 1, "dev-office-device", OFFICE_DEVICE_TOKEN, "10.0.3.2"));

        assertEquals(1, results.stream().filter(AuthSecurityService.UnbindResult.class::isInstance).count());
        assertEquals(1, results.stream().filter(Throwable.class::isInstance).count());
        assertEquals(2, appUserRepository.findById(officeUser.getUserId()).orElseThrow().getTokenVersion());
        assertFalse(Boolean.TRUE.equals(mobileDeviceBindingRepository
                .findByDeviceId("dev-office-device").orElseThrow().getActive()));
    }

    private List<Object> runConcurrently(Callable<Object> first, Callable<Object> second) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            Callable<Object> synchronizedFirst = synchronize(ready, start, first);
            Callable<Object> synchronizedSecond = synchronize(ready, start, second);
            Future<Object> firstFuture = executor.submit(synchronizedFirst);
            Future<Object> secondFuture = executor.submit(synchronizedSecond);
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();
            return List.of(
                    firstFuture.get(10, TimeUnit.SECONDS),
                    secondFuture.get(10, TimeUnit.SECONDS));
        } finally {
            executor.shutdownNow();
        }
    }

    private Callable<Object> synchronize(
            CountDownLatch ready,
            CountDownLatch start,
            Callable<Object> operation) {
        return () -> {
            ready.countDown();
            start.await(5, TimeUnit.SECONDS);
            try {
                return operation.call();
            } catch (Throwable throwable) {
                return throwable;
            }
        };
    }
}
