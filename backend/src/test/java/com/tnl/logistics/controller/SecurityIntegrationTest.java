package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.LoginRequest;
import com.tnl.logistics.dto.LoginResponse;
import com.tnl.logistics.dto.PasswordChangeRequest;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.repository.AppUserRepository;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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

        // Ensure test admin exists
        if (appUserRepository.findByUsername("admin").isEmpty()) {
            appUserRepository.save(new AppUser("USR-ADMIN", "admin", passwordEncoder.encode("admin123"), "Admin User", UserRole.ADMIN));
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

        // 4. Access Admin Gated Endpoint with Admin Token succeeds (200 OK)
        mockMvc.perform(get("/api/v1/test/admin")
                        .header("Authorization", adminToken))
                .andExpect(status().isOk());

        // 5. Access Field Gated Endpoint with Admin Token fails (403 Forbidden)
        mockMvc.perform(get("/api/v1/test/field")
                        .header("Authorization", adminToken))
                .andExpect(status().isForbidden());

        // 6. Password Change with correct current password succeeds
        PasswordChangeRequest changeRequest = new PasswordChangeRequest("admin123", "newAdmin123");
        mockMvc.perform(post("/api/v1/auth/password-change")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(changeRequest)))
                .andExpect(status().isOk());

        // Verify login with new password works
        LoginRequest newLogin = new LoginRequest("admin", "newAdmin123");
        MvcResult newLoginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newLogin)))
                .andExpect(status().isOk())
                .andReturn();

        LoginResponse newResponseDto = objectMapper.readValue(newLoginResult.getResponse().getContentAsString(), LoginResponse.class);
        assertFalse(newResponseDto.isMustChangePassword()); // Changed to false on successful update
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
}
