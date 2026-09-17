package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.LoginRequest;
import com.tnl.logistics.dto.MobilePinLoginRequest;
import com.tnl.logistics.dto.MobilePinSetupRequest;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.MobileDeviceBinding;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.MobileDeviceBindingRepository;
import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.service.LoginRateLimiterService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.assertNotNull;
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
        mobileDeviceBindingRepository.deleteAll();

        AppUser officeUser = appUserRepository.findByUsername("office").orElse(null);
        if (officeUser != null) {
            officeUser.setPinHash(passwordEncoder.encode("2222"));
            officeUser.setFullName("Office Staff");
            officeUser.setMustChangePassword(false);
            appUserRepository.save(officeUser);
            mobileDeviceBindingRepository.save(new MobileDeviceBinding("dev-office-device", officeUser.getUserId(), hashToken("office-token-123")));
        }

        AppUser fieldUser = appUserRepository.findByUsername("field").orElse(null);
        if (fieldUser != null) {
            fieldUser.setPinHash(passwordEncoder.encode("0001"));
            fieldUser.setFullName("Carlos Mendoza");
            fieldUser.setMustChangePassword(false);
            appUserRepository.save(fieldUser);
            mobileDeviceBindingRepository.save(new MobileDeviceBinding("dev-field-device", fieldUser.getUserId(), hashToken("field-token-123")));
        }

        AppUser haulerUser = appUserRepository.findByUsername("hauler1").orElse(null);
        if (haulerUser != null) {
            haulerUser.setPinHash(null);
            haulerUser.setPasswordHash(passwordEncoder.encode("field123"));
            haulerUser.setMustChangePassword(false);
            appUserRepository.save(haulerUser);
            mobileDeviceBindingRepository.save(new MobileDeviceBinding("dev-hauler-device", haulerUser.getUserId(), hashToken("hauler-token-123")));
        }
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
    void testMobileSetupPinSuccess() throws Exception {
        AppUser haulerUser = appUserRepository.findByUsername("hauler1").orElseThrow();
        String token = JwtTokenProvider.generateToken(haulerUser.getUserId(), haulerUser.getRole().name(), haulerUser.getTokenVersion());

        MobilePinSetupRequest setupRequest = new MobilePinSetupRequest("7777");

        mockMvc.perform(post("/api/v1/auth/mobile-setup-pin")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(setupRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("PIN configured successfully"))
                .andExpect(jsonPath("$.hasPinSet").value(true))
                .andExpect(jsonPath("$.token").isString());

        // Subsequent PIN login should succeed with bound device
        MobilePinLoginRequest loginRequest = new MobilePinLoginRequest("7777", "hauler1", "dev-hauler-device", "hauler-token-123");
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
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(setupRequest)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode root = objectMapper.readTree(responseJson);
        String newToken = root.get("token").asText();
        assertNotNull(newToken);

        // Old token must now be revoked (HTTP 403 Access Denied)
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isForbidden());

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
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(setupRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testMobilePinLoginOfficeStaffSuccess() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("2222", "office", "dev-office-device", "office-token-123");

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
                .andExpect(jsonPath("$.deviceToken").value("office-token-123"));
    }

    @Test
    void testMobilePinLoginFieldStaffSuccess() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("0001", "field", "dev-field-device", "field-token-123");

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
    void testMobilePinLoginMissingDeviceCredentialsReturnsBadRequest() throws Exception {
        // Missing deviceId and deviceToken must fail validation with 400
        MobilePinLoginRequest request = new MobilePinLoginRequest("0001", "field");

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testMobilePinLoginRejectsUnboundDevice() throws Exception {
        // Unknown deviceId not found in DB must be rejected with 401
        MobilePinLoginRequest request = new MobilePinLoginRequest("0001", "field", "unregistered-device-id", "some-token");

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid device credentials"));
    }

    @Test
    void testMobilePinLoginRejectsDeviceMismatch() throws Exception {
        // dev-office-device is bound to USR-OFFICE, attempting to log in as 'field' must be rejected
        MobilePinLoginRequest request = new MobilePinLoginRequest("0001", "field", "dev-office-device", "office-token-123");

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid device credentials"));
    }

    @Test
    void testMobilePinLoginRejectsTokenMismatch() throws Exception {
        // Correct deviceId but wrong token secret must fail with 401
        MobilePinLoginRequest request = new MobilePinLoginRequest("0001", "field", "dev-field-device", "incorrect-token-secret");

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid device credentials"));
    }

    @Test
    void testMobilePinLoginTargetedWrongPinReturnsUnauthorized() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("9999", "field", "dev-field-device", "field-token-123");

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid PIN"));
    }

    @Test
    void testMobilePinLoginInvalidPinReturnsUnauthorized() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("9999", "office", "dev-office-device", "office-token-123");

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid PIN"));
    }

    @Test
    void testMobilePinLoginInvalidFormatReturnsBadRequest() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("12", "office", "dev-office-device", "office-token-123"); // less than 4 digits

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testMobilePinLoginRateLimiterLockout() throws Exception {
        MobilePinLoginRequest badRequest = new MobilePinLoginRequest("9999", "office", "dev-office-device", "office-token-123");

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
        MobilePinLoginRequest loginRequest = new MobilePinLoginRequest("2222", "office", "dev-office-device", "office-token-123");
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
            MobilePinLoginRequest badRequest = new MobilePinLoginRequest("9999", "office", "dev-office-device", "office-token-123");
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
        MobilePinLoginRequest badRequest = new MobilePinLoginRequest("9999", "office", "dev-office-device", "office-token-123");
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
                "2222", "office", "dev-office-device", "office-token-123"
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
                "9999", "office", "dev-office-device", "office-token-123"
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
                        .header("X-Device-Token", "invalid-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("office"))
                .andExpect(jsonPath("$.hasPinSet").value(false));

        mockMvc.perform(get("/api/v1/auth/mobile-pin-status")
                        .param("username", "field")
                        .header("X-Device-Id", "dev-office-device")
                        .header("X-Device-Token", "office-token-123"))
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
        MobilePinLoginRequest request = new MobilePinLoginRequest("1111", "admin", "dev-office-device", "office-token-123");

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid device credentials"));
    }

    @Test
    void testMobilePinLoginMissingUsernameReturnsBadRequest() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("1111", null, "dev-office-device", "office-token-123");

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
                .andExpect(jsonPath("$.message").value("Administrator accounts are restricted to the Web Portal."));
    }

    @Test
    void testMobilePinLoginWhenPinClearedReturnsConflictPinNotSet() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("0000", "hauler1", "dev-hauler-device", "hauler-token-123");

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
        MobilePinLoginRequest request = new MobilePinLoginRequest("0000", "hauler1", "dev-hauler-device", "hauler-token-123");

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
                        .header("X-Device-Token", "hauler-token-123"))
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
                        .header("X-Device-Token", "office-token-123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("office"))
                .andExpect(jsonPath("$.hasPinSet").value(true))
                .andExpect(jsonPath("$.role").doesNotExist())
                .andExpect(jsonPath("$.fullName").doesNotExist());
    }
}
