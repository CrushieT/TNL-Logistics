package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.MobilePinLoginRequest;
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
import org.springframework.transaction.annotation.Transactional;

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

        // Seed users with PINs for testing
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
    }

    @Test
    void testMobilePinLoginOfficeStaffSuccess() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("2222");

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
        MobilePinLoginRequest request = new MobilePinLoginRequest("0001");

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
    void testMobilePinLoginInvalidPinReturnsUnauthorized() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("9999");

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid PIN"));
    }

    @Test
    void testMobilePinLoginInvalidFormatReturnsBadRequest() throws Exception {
        MobilePinLoginRequest request = new MobilePinLoginRequest("12"); // less than 4 digits

        mockMvc.perform(post("/api/v1/auth/mobile-pin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testMobilePinLoginRateLimiterLockout() throws Exception {
        MobilePinLoginRequest badRequest = new MobilePinLoginRequest("9999");

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
}
