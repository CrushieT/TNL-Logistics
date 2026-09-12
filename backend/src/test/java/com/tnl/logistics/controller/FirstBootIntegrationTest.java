package com.tnl.logistics.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.FirstBootAdminRequest;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.repository.AppUserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test verifying first-boot admin registration, status detection,
 * input validations, single-admin ID assignment, and conflict rejection.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class FirstBootIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository appUserRepository;

    @Test
    void testFirstBootStatusAndRegistrationLifecycle() throws Exception {
        // Clear any existing admin user to simulate pristine unbootstrapped state
        appUserRepository.findAll().stream()
                .filter(user -> user.getRole() == UserRole.ADMIN)
                .forEach(appUserRepository::delete);

        // 1. Probe status: should indicate first-boot is needed
        mockMvc.perform(get("/api/v1/auth/first-boot-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isFirstBoot").value(true));

        // 2. Validation check: Passwords do not match
        FirstBootAdminRequest mismatchReq = new FirstBootAdminRequest(
                "Maria Santos", "admin", "AdminPass123!", "MismatchPass123!"
        );
        mockMvc.perform(post("/api/v1/auth/first-boot-admin")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(mismatchReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Passwords do not match."));

        // 3. Validation check: Password too short (< 8 characters)
        FirstBootAdminRequest shortPassReq = new FirstBootAdminRequest(
                "Maria Santos", "admin", "short", "short"
        );
        mockMvc.perform(post("/api/v1/auth/first-boot-admin")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(shortPassReq)))
                .andExpect(status().isBadRequest());

        // 4. Validation check: Missing full name
        FirstBootAdminRequest missingNameReq = new FirstBootAdminRequest(
                "", "admin", "AdminPass123!", "AdminPass123!"
        );
        mockMvc.perform(post("/api/v1/auth/first-boot-admin")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(missingNameReq)))
                .andExpect(status().isBadRequest());

        // 5. Successful registration of primary administrator
        FirstBootAdminRequest validReq = new FirstBootAdminRequest(
                "Maria Santos", "primaryadmin", "AdminPass123!", "AdminPass123!"
        );
        mockMvc.perform(post("/api/v1/auth/first-boot-admin")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(validReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.userId").value("USR-ADMIN"))
                .andExpect(jsonPath("$.username").value("primaryadmin"))
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.mustChangePassword").value(false));

        // Verify entity persisted in database
        AppUser persistedAdmin = appUserRepository.findById("USR-ADMIN").orElseThrow();
        assertEquals("primaryadmin", persistedAdmin.getUsername());
        assertEquals("Maria Santos", persistedAdmin.getFullName());
        assertEquals(UserRole.ADMIN, persistedAdmin.getRole());
        assertFalse(persistedAdmin.getMustChangePassword());
        assertTrue(persistedAdmin.getActive());

        // 6. Probe status again: should indicate first-boot is no longer needed
        mockMvc.perform(get("/api/v1/auth/first-boot-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isFirstBoot").value(false));

        // 7. Duplicate initialization attempt must return 409 Conflict
        mockMvc.perform(post("/api/v1/auth/first-boot-admin")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(validReq)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("First boot setup has already been completed."));
    }
}
