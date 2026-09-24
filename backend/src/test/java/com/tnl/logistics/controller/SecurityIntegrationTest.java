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
import com.tnl.logistics.config.JwtAuthenticationFilter;
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
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
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
        // 1. Unauthenticated requests to test endpoints fail (401 Unauthorized)
        mockMvc.perform(get("/api/v1/test/admin"))
                .andExpect(status().isUnauthorized());

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

        // 7. Old token is revoked and requires session renewal.
        mockMvc.perform(get("/api/v1/test/admin")
                        .header("Authorization", adminToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));

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

    @Test
    public void testStaffWebLoginIsDeniedWhileMobileLoginRemainsAvailable() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseGet(() -> {
            AppUser user = new AppUser("USR-OFFICE", "office", passwordEncoder.encode("office123"), "Office Staff", UserRole.OFFICE_STAFF);
            user.setActive(true);
            user.setTokenVersion(1);
            return appUserRepository.saveAndFlush(user);
        });
        officeUser.setActive(true);
        officeUser.setMustChangePassword(false);
        officeUser.setPasswordHash(passwordEncoder.encode("office123"));
        appUserRepository.saveAndFlush(officeUser);

        LoginRequest officeLogin = new LoginRequest("office", "office123");
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(officeLogin)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Staff accounts must use the mobile application."))
                .andExpect(jsonPath("$.token").doesNotExist());

        mockMvc.perform(post("/api/v1/auth/mobile-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(officeLogin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("OFFICE_STAFF"))
                .andExpect(jsonPath("$.token").isNotEmpty());
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
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/mobile-login")
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

        // 1. Unauthenticated call fails with 401
        mockMvc.perform(post("/api/v1/auth/verify-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PasswordVerificationRequest("admin123"))))
                .andExpect(status().isUnauthorized());

        // 2. Incorrect password returns 400 Bad Request
        mockMvc.perform(post("/api/v1/auth/verify-password")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PasswordVerificationRequest("wrongPassword"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Incorrect current password."));

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

        // Attempting to access protected office endpoint must require session renewal.
        mockMvc.perform(get("/api/v1/test/office")
                        .header("Authorization", token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
    }

    @Test
    public void testLegacyUsernameTokenIsRejected() throws Exception {
        String legacyToken = createLegacyUsernameToken("admin", "ADMIN", 1);

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + legacyToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
    }

    @Test
    public void testFutureTokenVersionIsRejected() throws Exception {
        AppUser adminUser = appUserRepository.findById("USR-ADMIN").orElseThrow();
        String futureVersionToken = JwtTokenProvider.generateToken(
                adminUser.getUserId(), adminUser.getRole().name(), adminUser.getTokenVersion() + 1);

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + futureVersionToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
    }

    @Test
    public void testMalformedAndForgedTokensRequireSessionRenewal() throws Exception {
        AppUser adminUser = appUserRepository.findById("USR-ADMIN").orElseThrow();
        String validToken = JwtTokenProvider.generateToken(
                adminUser.getUserId(), adminUser.getRole().name(), adminUser.getTokenVersion());
        char replacement = validToken.charAt(validToken.length() - 1) == 'a' ? 'b' : 'a';
        String forgedToken = validToken.substring(0, validToken.length() - 1) + replacement;

        for (String invalidToken : java.util.List.of("not-a-jwt", forgedToken)) {
            mockMvc.perform(get("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + invalidToken))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
        }
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
    public void testAdminLoginGeneratesConfiguredExpiration() throws Exception {
        LoginRequest adminLogin = new LoginRequest("admin", "admin123");
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(adminLogin)))
                .andExpect(status().isOk())
                .andReturn();

        LoginResponse responseDto = objectMapper.readValue(result.getResponse().getContentAsString(), LoginResponse.class);
        String token = responseDto.getToken();
        assertNotNull(token);

        Long exp = JwtTokenProvider.getExpirationFromToken(token);
        assertNotNull(exp);

        long nowSeconds = System.currentTimeMillis() / 1000;
        long expectedAdminTtlSeconds = JwtTokenProvider.getAdminExpirationMs() / 1000;
        long actualTtlSeconds = exp - nowSeconds;

        // Verify actual TTL is within 5 seconds of configured admin TTL
        assertTrue(Math.abs(actualTtlSeconds - expectedAdminTtlSeconds) <= 5,
                "Admin token TTL should match configured admin expiration (" + expectedAdminTtlSeconds + "s), but was: " + actualTtlSeconds);
    }

    @Test
    public void testStaffTokensGenerateConfiguredExpiration() {
        long nowSeconds = System.currentTimeMillis() / 1000;
        long expectedStaffTtlSeconds = JwtTokenProvider.getStaffExpirationMs() / 1000;

        // Office Staff
        String officeToken = JwtTokenProvider.generateToken("USR-OFFICE-01", "OFFICE_STAFF", 1);
        Long officeExp = JwtTokenProvider.getExpirationFromToken(officeToken);
        assertNotNull(officeExp);
        long actualOfficeTtl = officeExp - nowSeconds;
        assertTrue(Math.abs(actualOfficeTtl - expectedStaffTtlSeconds) <= 5,
                "Office staff token TTL should match configured staff expiration (" + expectedStaffTtlSeconds + "s), but was: " + actualOfficeTtl);

        // Field Staff
        String fieldToken = JwtTokenProvider.generateToken("USR-FIELD-01", "FIELD_STAFF", 1);
        Long fieldExp = JwtTokenProvider.getExpirationFromToken(fieldToken);
        assertNotNull(fieldExp);
        long actualFieldTtl = fieldExp - nowSeconds;
        assertTrue(Math.abs(actualFieldTtl - expectedStaffTtlSeconds) <= 5,
                "Field staff token TTL should match configured staff expiration (" + expectedStaffTtlSeconds + "s), but was: " + actualFieldTtl);
    }

    @Test
    public void testExpiredTokenIsRejected() throws Exception {
        // Generate an expired token (10 seconds in the past)
        String expiredToken = JwtTokenProvider.generateToken("USR-ADMIN", "ADMIN", 1, -10000L);

        // Validate token method rejects it
        assertFalse(JwtTokenProvider.validateToken(expiredToken));

        // API endpoint returns the explicit reauthentication contract.
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
    }

    @Test
    public void testLegacyOverlongAdminTokenIsRejected() throws Exception {
        // Construct window exceeding configured admin lifetime + tolerance
        long overlongAdminMs = Math.max(
                JwtTokenProvider.getStaffExpirationMs(),
                JwtTokenProvider.getAdminExpirationMs() + (24L * 60 * 60 * 1000L)
        );
        String legacyAdminToken = JwtTokenProvider.generateToken("USR-ADMIN", "ADMIN", 1, overlongAdminMs);

        // Token provider rejects legacy overlong admin token
        assertFalse(JwtTokenProvider.validateToken(legacyAdminToken),
                "Legacy admin token exceeding configured admin window must be rejected");

        // Protected endpoint returns the explicit reauthentication contract.
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + legacyAdminToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
    }

    @Test
    public void testAdminTokenOlderThanConfiguredLifetimeIsRejected() throws Exception {
        long nowSeconds = System.currentTimeMillis() / 1000;
        long adminTtlSeconds = JwtTokenProvider.getAdminExpirationMs() / 1000;
        // Simulated token issued beyond configured admin lifetime with future-dated exp
        String staleAdminToken = JwtTokenProvider.generateToken("USR-ADMIN", "ADMIN", 1,
                nowSeconds - (adminTtlSeconds + 3600), nowSeconds + 3600);

        // Token provider rejects token whose elapsed time since issuance exceeds configured shift TTL
        assertFalse(JwtTokenProvider.validateToken(staleAdminToken),
                "Admin token older than configured admin lifetime from issuance must be rejected");

        // Protected endpoint returns the explicit reauthentication contract.
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + staleAdminToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
    }

    @Test
    public void testAdminTokenWithFutureIssuanceBeyondToleranceIsRejected() {
        long nowSeconds = System.currentTimeMillis() / 1000;
        long adminTtlSeconds = JwtTokenProvider.getAdminExpirationMs() / 1000;
        // Token issued 120 seconds into the future (exceeding 60s tolerance)
        String futureAdminToken = JwtTokenProvider.generateToken("USR-ADMIN", "ADMIN", 1,
                nowSeconds + 120, nowSeconds + adminTtlSeconds + 120);

        assertFalse(JwtTokenProvider.validateToken(futureAdminToken),
                "Admin token with future issuance exceeding 60s clock skew tolerance must be rejected");
    }

    @Test
    public void testValidStaffTokenWithConfiguredWindowIsAccepted() {
        // Staff token with configured validity window
        String validStaffToken = JwtTokenProvider.generateToken("USR-OFFICE-01", "OFFICE_STAFF", 1);
        assertTrue(JwtTokenProvider.validateToken(validStaffToken),
                "Staff token with configured validity window must remain valid");
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

    @Test
    public void testAdminLoginGenerates30MinuteExpirationWithAuthTime() throws Exception {
        LoginRequest adminLogin = new LoginRequest("admin", "admin123");
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(adminLogin)))
                .andExpect(status().isOk())
                .andReturn();

        LoginResponse responseDto = objectMapper.readValue(result.getResponse().getContentAsString(), LoginResponse.class);
        String token = responseDto.getToken();
        assertNotNull(token);

        Long exp = JwtTokenProvider.getExpirationFromToken(token);
        Long iat = JwtTokenProvider.getIssuedAtFromToken(token);
        Long authTime = JwtTokenProvider.getAuthTimeFromToken(token);

        assertNotNull(exp);
        assertNotNull(iat);
        assertNotNull(authTime);
        assertEquals(iat, authTime, "Initial login auth_time must equal iat");
        long ttlSeconds = exp - iat;
        assertEquals(1800L, ttlSeconds, "Admin token lifetime must be exactly 1800 seconds (30 minutes)");
    }

    @Test
    public void testAdminSlidingSessionRenewsTokenOn2xxResponse() throws Exception {
        LoginRequest adminLogin = new LoginRequest("admin", "admin123");
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(adminLogin)))
                .andExpect(status().isOk())
                .andReturn();

        String token = objectMapper.readValue(loginResult.getResponse().getContentAsString(), LoginResponse.class).getToken();

        MvcResult authMeResult = mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(header().exists("X-Renewed-Token"))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
                .andReturn();

        String renewedToken = authMeResult.getResponse().getHeader("X-Renewed-Token");
        assertNotNull(renewedToken);
        assertFalse(renewedToken.isBlank());

        assertTrue(JwtTokenProvider.validateToken(renewedToken));

        Long origAuthTime = JwtTokenProvider.getAuthTimeFromToken(token);
        Long renewedAuthTime = JwtTokenProvider.getAuthTimeFromToken(renewedToken);
        assertEquals(origAuthTime, renewedAuthTime, "Renewed token must preserve original auth_time");

        assertNull(authMeResult.getResponse().getHeader("Authorization"));
    }

    @Test
    public void testErrorResponseDoesNotEmitRenewalToken() throws Exception {
        LoginRequest adminLogin = new LoginRequest("admin", "admin123");
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(adminLogin)))
                .andExpect(status().isOk())
                .andReturn();

        String token = objectMapper.readValue(loginResult.getResponse().getContentAsString(), LoginResponse.class).getToken();

        mockMvc.perform(get("/api/v1/test/field")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("X-Renewed-Token"));
    }

    @Test
    public void testNonAdminRequestDoesNotEmitRenewalHeader() throws Exception {
        AppUser officeUser = appUserRepository.findByUsername("office").orElseGet(() -> {
            AppUser u = new AppUser("USR-OFFICE", "office", passwordEncoder.encode("office123"), "Office Staff", UserRole.OFFICE_STAFF);
            u.setActive(true);
            return appUserRepository.saveAndFlush(u);
        });

        String officeToken = JwtTokenProvider.generateToken(officeUser.getUserId(), "OFFICE_STAFF", officeUser.getTokenVersion());

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + officeToken))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("X-Renewed-Token"));
    }

    @Test
    public void testRoleMismatchBetweenTokenAndDatabaseIsRejected() throws Exception {
        AppUser admin = appUserRepository.findById("USR-ADMIN").orElseThrow();
        String mismatchedToken = JwtTokenProvider.generateToken(admin.getUserId(), "OFFICE_STAFF", admin.getTokenVersion());

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + mismatchedToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
    }

    @Test
    public void testLegacyAdminTokenWithoutAuthTimeIsRejected() throws Exception {
        String legacyToken = createLegacyUsernameToken("USR-ADMIN", "ADMIN", 1);

        assertFalse(JwtTokenProvider.validateToken(legacyToken));

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + legacyToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
    }

    @Test
    public void testAdminSessionReaching12HourCeilingIsRejected() throws Exception {
        long nowSeconds = System.currentTimeMillis() / 1000;
        long maxCeilingSeconds = JwtTokenProvider.getAdminMaxLifetimeMs() / 1000;

        long staleAuthTime = nowSeconds - (maxCeilingSeconds + 100);
        long recentIat = nowSeconds - 10;
        long futureExp = nowSeconds + 1790;

        String expiredShiftToken = JwtTokenProvider.generateToken(
                "USR-ADMIN", "ADMIN", 1, recentIat, futureExp, staleAuthTime);

        assertFalse(JwtTokenProvider.validateToken(expiredShiftToken),
                "Admin token reaching the 12-hour shift ceiling must be rejected");

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + expiredShiftToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
    }

    @Test
    public void testCorsExposesRenewalHeaderOnActualResponse() throws Exception {
        LoginRequest adminLogin = new LoginRequest("admin", "admin123");
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(adminLogin)))
                .andExpect(status().isOk())
                .andReturn();

        String token = objectMapper.readValue(loginResult.getResponse().getContentAsString(), LoginResponse.class).getToken();

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Origin", "http://localhost:3000")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Expose-Headers", org.hamcrest.Matchers.containsString("X-Renewed-Token")));
    }

    @Test
    public void testDownstreamExceptionIsNotMaskedAs401ForAdmin() throws Exception {
        LoginRequest adminLogin = new LoginRequest("admin", "admin123");
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(adminLogin)))
                .andExpect(status().isOk())
                .andReturn();

        String token = objectMapper.readValue(loginResult.getResponse().getContentAsString(), LoginResponse.class).getToken();

        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(appUserRepository);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/users");
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        RuntimeException downstreamFailure = new RuntimeException("Simulated downstream failure");

        SecurityContextHolder.clearContext();
        try {
            RuntimeException thrown = assertThrows(RuntimeException.class,
                    () -> filter.doFilter(request, response, (servletRequest, servletResponse) -> {
                        throw downstreamFailure;
                    }));
            assertSame(downstreamFailure, thrown);
            assertNotEquals(401, response.getStatus());
            assertFalse(response.getContentAsString().contains("SESSION_REAUTH_REQUIRED"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
