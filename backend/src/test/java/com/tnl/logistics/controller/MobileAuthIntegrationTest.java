package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.LoginRequest;
import com.tnl.logistics.dto.MobilePinLoginRequest;
import com.tnl.logistics.dto.MobilePinSetupRequest;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.repository.AppUserRepository;
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
    private BCryptPasswordEncoder passwordEncoder;

    @Autowired
    private LoginRateLimiterService rateLimiterService;

    @BeforeEach
    void setUp() {
        rateLimiterService.reset();

        AppUser officeUser = appUserRepository.findByUsername("office").orElse(null);
        if (officeUser != null) {
            officeUser.setPinHash(passwordEncoder.encode("2222"));
            officeUser.setFullName("Office Staff");
            appUserRepository.save(officeUser);
        }

        AppUser fieldUser = appUserRepository.findByUsername("field").orElse(null);
        if (fieldUser != null) {
            fieldUser.setPinHash(passwordEncoder.encode("0001"));
            fieldUser.setFullName("Carlos Mendoza");
            appUserRepository.save(fieldUser);
        }

        AppUser haulerUser = appUserRepository.findByUsername("hauler1").orElse(null);
        if (haulerUser != null) {
            haulerUser.setPinHash(null);
            haulerUser.setPasswordHash(passwordEncoder.encode("field123"));
            appUserRepository.save(haulerUser);
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
                .andExpect(jsonPath("$.hasPinSet").value(true));
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
                .andExpect(jsonPath("$.hasPinSet").value(true));
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
                .andExpect(jsonPath("$.hasPinSet").value(false));
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
                .andExpect(jsonPath("$.hasPinSet").value(true));

        // Subsequent PIN login should succeed
        MobilePinLoginRequest loginRequest = new MobilePinLoginRequest("7777", "hauler1");
        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("hauler1"));
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
        MobilePinLoginRequest request = new MobilePinLoginRequest("2222", "office");

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.userId").value("USR-OFFICE"))
                .andExpect(jsonPath("$.username").value("office"))
                .andExpect(jsonPath("$.fullName").value("Office Staff"))
                .andExpect(jsonPath("$.role").value("OFFICE_STAFF"));
    }

    @Test
    void testMobilePinLoginFieldStaffSuccess() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("0001", "field");

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
    void testMobilePinLoginTargetedWithUsernameSuccess() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("0001", "field");

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("field"));
    }

    @Test
    void testMobilePinLoginTargetedWrongPinReturnsUnauthorized() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("9999", "field");

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid PIN"));
    }

    @Test
    void testMobilePinLoginInvalidPinReturnsUnauthorized() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("9999", "office");

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid PIN"));
    }

    @Test
    void testMobilePinLoginInvalidFormatReturnsBadRequest() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("12", "office"); // less than 4 digits

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testMobilePinLoginRateLimiterLockout() throws Exception {
        MobilePinLoginRequest badRequest = new MobilePinLoginRequest("9999", "office");

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
    void testMobilePinLoginAdminTargetedReturnsForbidden() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("1111", "admin");

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Administrator accounts are restricted to the Web Portal."));
    }

    @Test
    void testMobilePinLoginMissingUsernameReturnsBadRequest() throws Exception {
        // Missing username in MobilePinLoginRequest must be rejected with 400 Bad Request
        MobilePinLoginRequest request = new MobilePinLoginRequest("1111");

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
        // hauler1 has pinHash = null (cleared or unconfigured)
        MobilePinLoginRequest request = new MobilePinLoginRequest("0000", "hauler1");

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
        // 6 attempts on hauler1 (with no PIN configured) must consistently return 409 Conflict without triggering 429 lockout
        MobilePinLoginRequest request = new MobilePinLoginRequest("0000", "hauler1");

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
                        .param("username", "hauler1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("hauler1"))
                .andExpect(jsonPath("$.hasPinSet").value(false))
                .andExpect(jsonPath("$.role").doesNotExist())
                .andExpect(jsonPath("$.fullName").doesNotExist());
    }

    @Test
    void testMobilePinStatusReturnsHasPinSetTrueWhenConfigured() throws Exception {
        mockMvc.perform(get("/api/v1/auth/mobile-pin-status")
                        .param("username", "office"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("office"))
                .andExpect(jsonPath("$.hasPinSet").value(true))
                .andExpect(jsonPath("$.role").doesNotExist())
                .andExpect(jsonPath("$.fullName").doesNotExist());
    }

    @Test
    void testMobilePinStatusAdminRestrictedReturnsForbidden() throws Exception {
        mockMvc.perform(get("/api/v1/auth/mobile-pin-status")
                        .param("username", "admin"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Administrator accounts are restricted to the Web Portal."));
    }

    @Test
    void testMobilePinStatusRateLimiterLockout() throws Exception {
        rateLimiterService.reset();
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(get("/api/v1/auth/mobile-pin-status")
                            .param("username", "nonexistentuser" + i))
                    .andExpect(status().isNotFound());
        }

        // 6th attempt should be blocked with 429
        mockMvc.perform(get("/api/v1/auth/mobile-pin-status")
                        .param("username", "office"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.retryAfterSeconds").isNumber());
    }
}
