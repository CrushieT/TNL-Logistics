package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.LoginRequest;
import com.tnl.logistics.dto.LoginResponse;
import com.tnl.logistics.dto.PasswordChangeRequest;
import com.tnl.logistics.dto.PasswordVerificationRequest;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.service.LoginRateLimiterService;
import com.tnl.logistics.config.JwtTokenProvider;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration Test for Security & Auth controller mappings.
 * Validates login authentication, token validation, password update, and PreAuthorize gates.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class SecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private LoginRateLimiterService rateLimiterService;

    @Autowired
    private com.tnl.logistics.repository.PaymentRepository paymentRepository;

    @Autowired
    private com.tnl.logistics.repository.TrackingEventRepository trackingEventRepository;

    @Autowired
    private com.tnl.logistics.repository.ParcelUnitRepository parcelUnitRepository;

    @Autowired
    private com.tnl.logistics.repository.ShipmentRepository shipmentRepository;

    @Autowired
    private com.tnl.logistics.repository.WaybillRepository waybillRepository;

    @BeforeEach
    public void setup() {
        rateLimiterService.reset();
        waybillRepository.deleteAll();
        trackingEventRepository.deleteAll();
        paymentRepository.deleteAll();
        parcelUnitRepository.deleteAll();
        shipmentRepository.deleteAll();

        // Ensure test admin exists with mustChangePassword = false
        AppUser adminUser = appUserRepository.findByUsername("admin").orElse(null);
        if (adminUser == null) {
            adminUser = new AppUser("USR-ADMIN", "admin", passwordEncoder.encode("admin123"), "Admin User", UserRole.ADMIN);
            adminUser.setMustChangePassword(false);
            appUserRepository.save(adminUser);
        } else {
            adminUser.setMustChangePassword(false);
            adminUser.setUsername("admin");
            adminUser.setPasswordHash(passwordEncoder.encode("admin123"));
            appUserRepository.save(adminUser);
        }
    }

    @Test
    public void testAuthenticationAndAuthorizationFlow() throws Exception {
        // 1. Unauthenticated requests to test endpoints fail (403 Forbidden)
        mockMvc.perform(get("/api/v1/test/admin"))
                .andExpect(status().isForbidden());

        // 2. Login with invalid credentials fails
        LoginRequest badRequest = new LoginRequest("admin", "wrong_password");
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badRequest)))
                .andExpect(status().isUnauthorized());

        // Ensure admin has mustChangePassword = true for this lifecycle flow
        AppUser admin = appUserRepository.findByUsername("admin").orElseThrow();
        admin.setMustChangePassword(true);
        appUserRepository.saveAndFlush(admin);

        // 3. Login with valid ADMIN credentials succeeds
        LoginRequest adminLogin = new LoginRequest("admin", "admin123");
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(adminLogin)))
                .andExpect(status().isOk())
                .andReturn();

        String responseContent = result.getResponse().getContentAsString();
        LoginResponse responseDto = objectMapper.readValue(responseContent, LoginResponse.class);
        assertNotNull(responseDto.getToken());
        assertEquals("ADMIN", responseDto.getRole());
        assertTrue(responseDto.isMustChangePassword());

        String adminToken = "Bearer " + responseDto.getToken();

        // 4. While mustChangePassword is true, accessing business/test endpoints fails (403 Forbidden with PASSWORD_CHANGE_REQUIRED)
        mockMvc.perform(get("/api/v1/test/admin")
                        .header("Authorization", adminToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"))
                .andExpect(jsonPath("$.message").value("Password change required before accessing this resource"));

        // 5. While mustChangePassword is true, GET /api/v1/auth/me is allowed
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value("USR-ADMIN"))
                .andExpect(jsonPath("$.mustChangePassword").value(true));

        // 6a. Password Change with same password fails (400 Bad Request)
        PasswordChangeRequest samePasswordRequest = new PasswordChangeRequest("admin123", "admin123");
        mockMvc.perform(post("/api/v1/auth/password-change")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(samePasswordRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("New password must be different from current password."));

        // 6b. Password Change with short password fails (400 Bad Request)
        PasswordChangeRequest shortPasswordRequest = new PasswordChangeRequest("admin123", "short");
        mockMvc.perform(post("/api/v1/auth/password-change")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(shortPasswordRequest)))
                .andExpect(status().isBadRequest());

        // 6c. Password Change with correct current password succeeds and returns refreshed token
        PasswordChangeRequest changeRequest = new PasswordChangeRequest("admin123", "newAdmin123");
        MvcResult changeResult = mockMvc.perform(post("/api/v1/auth/password-change")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(changeRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.message").value("Password updated successfully"))
                .andReturn();

        String refreshedToken = "Bearer " + objectMapper.readTree(changeResult.getResponse().getContentAsString()).get("token").asText();

        // 7. Old token is revoked (version mismatch returns 403)
        mockMvc.perform(get("/api/v1/test/admin")
                        .header("Authorization", adminToken))
                .andExpect(status().isForbidden());

        // 8. Refreshed token allows access to Admin Gated Endpoint (200 OK)
        mockMvc.perform(get("/api/v1/test/admin")
                        .header("Authorization", refreshedToken))
                .andExpect(status().isOk());

        // 9. Access Field Gated Endpoint with refreshed Admin Token fails (403 Forbidden due to role gate)
        mockMvc.perform(get("/api/v1/test/field")
                        .header("Authorization", refreshedToken))
                .andExpect(status().isForbidden());

        // 10. Verify login with new password works and mustChangePassword is false
        LoginRequest newLogin = new LoginRequest("admin", "newAdmin123");
        MvcResult newLoginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newLogin)))
                .andExpect(status().isOk())
                .andReturn();

        LoginResponse newResponseDto = objectMapper.readValue(newLoginResult.getResponse().getContentAsString(), LoginResponse.class);
        assertFalse(newResponseDto.isMustChangePassword()); // Changed to false on successful update

        // Reset admin back to initial baseline so subsequent test classes are unaffected
        admin.setMustChangePassword(false);
        admin.setTokenVersion(1);
        admin.setPasswordHash(passwordEncoder.encode("admin123"));
        appUserRepository.saveAndFlush(admin);
    }

    @org.junit.jupiter.api.AfterEach
    public void cleanup() {
        AppUser admin = appUserRepository.findByUsername("admin").orElse(null);
        if (admin != null) {
            admin.setMustChangePassword(false);
            admin.setTokenVersion(1);
            admin.setPasswordHash(passwordEncoder.encode("admin123"));
            appUserRepository.save(admin);
        }
        AppUser office = appUserRepository.findByUsername("office").orElse(null);
        if (office != null) {
            office.setMustChangePassword(false);
            office.setTokenVersion(1);
            office.setPasswordHash(passwordEncoder.encode("office123"));
            appUserRepository.save(office);
        }
        appUserRepository.deleteById("USR-FLAGGED-OFFICE");
    }

    @Test
    public void testFlaggedOfficeStaffBlockedFromBusinessEndpointsUntilPasswordChanged() throws Exception {
        AppUser flaggedUser = new AppUser("USR-FLAGGED-OFFICE", "flagged_office", passwordEncoder.encode("flagged123"), "Flagged Staff", UserRole.OFFICE_STAFF);
        flaggedUser.setMustChangePassword(true);
        flaggedUser.setTokenVersion(1);
        appUserRepository.saveAndFlush(flaggedUser);

        // Login as flagged office user
        LoginRequest loginRequest = new LoginRequest("flagged_office", "flagged123");
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        LoginResponse loginResponse = objectMapper.readValue(loginResult.getResponse().getContentAsString(), LoginResponse.class);
        assertTrue(loginResponse.isMustChangePassword());
        String officeToken = "Bearer " + loginResponse.getToken();

        // Blocked on client endpoints
        mockMvc.perform(get("/api/v1/clients")
                        .header("Authorization", officeToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));

        // Blocked on shipment endpoints
        mockMvc.perform(get("/api/v1/shipments")
                        .header("Authorization", officeToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));

        // Blocked on verify password endpoint
        mockMvc.perform(post("/api/v1/auth/verify-password")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PasswordVerificationRequest("flagged123"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));

        // Allowed on GET /api/v1/auth/me
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value("USR-FLAGGED-OFFICE"))
                .andExpect(jsonPath("$.mustChangePassword").value(true));

        // Change password
        PasswordChangeRequest changeRequest = new PasswordChangeRequest("flagged123", "newFlagged123");
        MvcResult changeResult = mockMvc.perform(post("/api/v1/auth/password-change")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(changeRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andReturn();

        String refreshedToken = "Bearer " + objectMapper.readTree(changeResult.getResponse().getContentAsString()).get("token").asText();

        // Now allowed on client endpoints
        mockMvc.perform(get("/api/v1/clients")
                        .header("Authorization", refreshedToken))
                .andExpect(status().isOk());
    }

    @Test
    public void testVerifyPasswordEndpoint() throws Exception {
        LoginRequest loginRequest = new LoginRequest("admin", "admin123");
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        LoginResponse loginResponse = objectMapper.readValue(loginResult.getResponse().getContentAsString(), LoginResponse.class);
        String adminToken = "Bearer " + loginResponse.getToken();

        // 1. Unauthenticated call fails with 403
        mockMvc.perform(post("/api/v1/auth/verify-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PasswordVerificationRequest("admin123"))))
                .andExpect(status().isForbidden());

        // 2. Incorrect password returns 400 Bad Request
        mockMvc.perform(post("/api/v1/auth/verify-password")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PasswordVerificationRequest("wrongPassword"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Incorrect administrator password."));

        // 3. Blank password returns 400 Bad Request via @NotBlank
        mockMvc.perform(post("/api/v1/auth/verify-password")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PasswordVerificationRequest(""))))
                .andExpect(status().isBadRequest());

        // 4. Correct password returns 200 OK with valid: true
        mockMvc.perform(post("/api/v1/auth/verify-password")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PasswordVerificationRequest("admin123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.message").value("Password verified successfully"));

        // 5. Rate limiter blocks after 5 failed verification attempts from same IP
        String testIp = "192.168.1.99";
        for (int i = 1; i <= 5; i++) {
            mockMvc.perform(post("/api/v1/auth/verify-password")
                            .header("Authorization", adminToken)
                            .with(req -> { req.setRemoteAddr(testIp); return req; })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new PasswordVerificationRequest("wrongPassword"))))
                    .andExpect(status().isBadRequest());
        }

        // 6th attempt is blocked with 429 Too Many Requests
        mockMvc.perform(post("/api/v1/auth/verify-password")
                        .header("Authorization", adminToken)
                        .with(req -> { req.setRemoteAddr(testIp); return req; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PasswordVerificationRequest("admin123"))))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.retryAfterSeconds").exists());
    }

    @Test
    public void testLoginRateLimiterBlocksAfterFiveFailures() throws Exception {
        String testIp = "192.168.1.55";
        LoginRequest badRequest = new LoginRequest("admin", "invalid_password");

        // First 5 attempts fail with 401 Unauthorized
        for (int attempt = 1; attempt <= 5; attempt++) {
            mockMvc.perform(post("/api/v1/auth/login")
                            .with(req -> { req.setRemoteAddr(testIp); return req; })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(badRequest)))
                    .andExpect(status().isUnauthorized());
        }

        // 6th attempt with valid credentials is blocked with 429 Too Many Requests
        LoginRequest validRequest = new LoginRequest("admin", "admin123");
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> { req.setRemoteAddr(testIp); return req; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRequest)))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));

        // Different IP is not blocked and can authenticate successfully
        String cleanIp = "192.168.1.99";
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> { req.setRemoteAddr(cleanIp); return req; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRequest)))
                .andExpect(status().isOk());
    }

    @Test
    public void testLoginRateLimiterResetsOnSuccess() throws Exception {
        String testIp = "10.0.0.88";
        LoginRequest badRequest = new LoginRequest("admin", "wrong_credentials");
        LoginRequest validRequest = new LoginRequest("admin", "admin123");

        // 2 failed attempts
        for (int attempt = 1; attempt <= 2; attempt++) {
            mockMvc.perform(post("/api/v1/auth/login")
                            .with(req -> { req.setRemoteAddr(testIp); return req; })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(badRequest)))
                    .andExpect(status().isUnauthorized());
        }

        // Successful login resets the counter for testIp
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> { req.setRemoteAddr(testIp); return req; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRequest)))
                .andExpect(status().isOk());

        // Subsequent 4 failed attempts should not trigger block (threshold is 5)
        for (int attempt = 1; attempt <= 4; attempt++) {
            mockMvc.perform(post("/api/v1/auth/login")
                            .with(req -> { req.setRemoteAddr(testIp); return req; })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(badRequest)))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Test
    public void testSpoofedForwardedHeaderDoesNotBypassRateLimiter() throws Exception {
        String realIp = "192.168.1.55";
        LoginRequest badRequest = new LoginRequest("admin", "invalid_password");

        // 5 failed attempts from realIp, each sending a spoofed/randomized X-Forwarded-For header
        for (int attempt = 1; attempt <= 5; attempt++) {
            mockMvc.perform(post("/api/v1/auth/login")
                            .with(req -> { req.setRemoteAddr(realIp); return req; })
                            .header("X-Forwarded-For", "10.0.0." + attempt)
                            .header("X-Real-IP", "172.16.0." + attempt)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(badRequest)))
                    .andExpect(status().isUnauthorized());
        }

        // 6th attempt from realIp with valid credentials is blocked because rate limiter tracked realIp
        LoginRequest validRequest = new LoginRequest("admin", "admin123");
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> { req.setRemoteAddr(realIp); return req; })
                        .header("X-Forwarded-For", "10.0.0.99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRequest)))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));

        // Different real socket IP is not blocked
        String otherRealIp = "192.168.1.77";
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> { req.setRemoteAddr(otherRealIp); return req; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRequest)))
                .andExpect(status().isOk());
    }

    @Test
    public void testDeactivatedUserTokenIsRejected() throws Exception {
        // Create an office user and mark as deactivated
        AppUser inactiveUser = new AppUser("USR-INACTIVE", "inactive_user", passwordEncoder.encode("pass123"), "Inactive Staff", UserRole.OFFICE_STAFF);
        inactiveUser.setActive(false);
        appUserRepository.save(inactiveUser);

        // Generate a cryptographically valid token for the inactive user
        String token = "Bearer " + com.tnl.logistics.config.JwtTokenProvider.generateToken("USR-INACTIVE", "OFFICE_STAFF");

        // Attempting to access protected office endpoint must be rejected (403 Forbidden)
        mockMvc.perform(get("/api/v1/test/office")
                        .header("Authorization", token))
                .andExpect(status().isForbidden());
    }

    @Test
    public void testLegacyUsernameTokenIsRejected() throws Exception {
        String legacyToken = createLegacyUsernameToken("admin", "ADMIN", 1);

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + legacyToken))
                .andExpect(status().isForbidden());
    }

    @Test
    public void testFutureTokenVersionIsRejected() throws Exception {
        AppUser adminUser = appUserRepository.findById("USR-ADMIN").orElseThrow();
        String futureVersionToken = JwtTokenProvider.generateToken(
                adminUser.getUserId(), adminUser.getRole().name(), adminUser.getTokenVersion() + 1);

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + futureVersionToken))
                .andExpect(status().isForbidden());
    }

    @Test
    public void testTokenContinuesToResolveUserAfterUsernameRename() throws Exception {
        AppUser adminUser = appUserRepository.findById("USR-ADMIN").orElseThrow();
        String token = JwtTokenProvider.generateToken(
                adminUser.getUserId(), adminUser.getRole().name(), adminUser.getTokenVersion());

        adminUser.setUsername("renamed-admin");
        appUserRepository.saveAndFlush(adminUser);

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value("USR-ADMIN"))
                .andExpect(jsonPath("$.username").value("renamed-admin"));
    }

    private String createLegacyUsernameToken(String username, String role, int tokenVersion) throws Exception {
        Map<String, Object> header = Map.of("alg", "HS256", "typ", "JWT");
        Map<String, Object> payload = new HashMap<>();
        payload.put("sub", username);
        payload.put("role", role);
        payload.put("ver", tokenVersion);
        payload.put("iat", System.currentTimeMillis() / 1000);
        payload.put("exp", (System.currentTimeMillis() / 1000) + 3600);

        String encodedHeader = Base64.getUrlEncoder().withoutPadding().encodeToString(
                objectMapper.writeValueAsString(header).getBytes(StandardCharsets.UTF_8));
        String encodedPayload = Base64.getUrlEncoder().withoutPadding().encodeToString(
                objectMapper.writeValueAsString(payload).getBytes(StandardCharsets.UTF_8));

        Field secretField = JwtTokenProvider.class.getDeclaredField("secret");
        secretField.setAccessible(true);
        Method signMethod = JwtTokenProvider.class.getDeclaredMethod("sign", String.class, String.class);
        signMethod.setAccessible(true);
        String signingInput = encodedHeader + "." + encodedPayload;
        String signature = (String) signMethod.invoke(null, signingInput, secretField.get(null));
        return signingInput + "." + signature;
    }

    @Test
    public void testCorsPreflightAllowedOrigin() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options("/api/v1/auth/login")
                        .header("Origin", "http://localhost:3000")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }
}
