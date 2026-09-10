package com.tnl.logistics.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.UpdateSystemSettingRequest;
import com.tnl.logistics.service.CollectionsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;

/**
 * Integration test verifying system settings REST API, RBAC boundaries,
 * input validations, and dynamic collection cycle reflection.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class SystemSettingIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CollectionsService collectionsService;

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testGetSettingsAsAdminReturns200AndExpectedStructure() throws Exception {
        mockMvc.perform(get("/api/v1/settings")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.companyName").value("TNL Logistics"))
                .andExpect(jsonPath("$.companyAddress").value("Manila Central Hub"))
                .andExpect(jsonPath("$.companyContact").value("0917-555-0000"))
                .andExpect(jsonPath("$.billingEmail").value("billing@tnllogistics.ph"))
                .andExpect(jsonPath("$.collectionDay").value("THURSDAY"))
                .andExpect(jsonPath("$.volumetricDivisor").value(5000))
                .andExpect(jsonPath("$.trackingPrefix").value("TRK"))
                .andExpect(jsonPath("$.shipmentPrefix").value("SHP"))
                .andExpect(jsonPath("$.trackingIdPrefixPreview").exists())
                .andExpect(jsonPath("$.shipmentIdPrefixPreview").exists());
    }

    @Test
    @WithMockUser(username = "office", roles = {"OFFICE_STAFF"})
    void testGetSettingsAsOfficeStaffReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/settings")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "field", roles = {"FIELD_STAFF"})
    void testGetSettingsAsFieldStaffReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/settings")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    void testGetSettingsUnauthenticatedReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/settings")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testUpdateSettingsAsAdminReturns200AndUpdatesSettings() throws Exception {
        UpdateSystemSettingRequest request = new UpdateSystemSettingRequest(
                "TNL Express Logistics",
                "Cebu Hub 1",
                "0918-123-4567",
                "finance@tnllogistics.ph",
                DayOfWeek.FRIDAY,
                6000
        );

        mockMvc.perform(put("/api/v1/settings")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.companyName").value("TNL Express Logistics"))
                .andExpect(jsonPath("$.companyAddress").value("Cebu Hub 1"))
                .andExpect(jsonPath("$.companyContact").value("0918-123-4567"))
                .andExpect(jsonPath("$.billingEmail").value("finance@tnllogistics.ph"))
                .andExpect(jsonPath("$.collectionDay").value("FRIDAY"))
                .andExpect(jsonPath("$.volumetricDivisor").value(6000));

        assertEquals(DayOfWeek.FRIDAY, collectionsService.getCollectionDayOfWeek());
    }

    @Test
    @WithMockUser(username = "office", roles = {"OFFICE_STAFF"})
    void testUpdateSettingsAsOfficeStaffReturns403Forbidden() throws Exception {
        UpdateSystemSettingRequest request = new UpdateSystemSettingRequest(
                "New Name", "New Addr", "0917-000-1111", "test@test.com", DayOfWeek.MONDAY, 5000
        );

        mockMvc.perform(put("/api/v1/settings")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testUpdateSettingsValidationFailureInvalidDivisor() throws Exception {
        UpdateSystemSettingRequest request = new UpdateSystemSettingRequest(
                "TNL", "Addr", "0917-123-4567", "a@b.com", DayOfWeek.THURSDAY, 500
        );

        mockMvc.perform(put("/api/v1/settings")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testUpdateSettingsValidationFailureInvalidEmail() throws Exception {
        UpdateSystemSettingRequest request = new UpdateSystemSettingRequest(
                "TNL", "Addr", "0917-123-4567", "invalid-email-address", DayOfWeek.THURSDAY, 5000
        );

        mockMvc.perform(put("/api/v1/settings")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testUpdateSettingsValidationFailureEmptyBusinessName() throws Exception {
        UpdateSystemSettingRequest request = new UpdateSystemSettingRequest(
                "", "Addr", "0917-123-4567", "info@tnl.com", DayOfWeek.THURSDAY, 5000
        );

        mockMvc.perform(put("/api/v1/settings")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "office", roles = {"OFFICE_STAFF"})
    void testGetCompanyBrandingAsOfficeStaffReturns200() throws Exception {
        mockMvc.perform(get("/api/v1/settings/branding")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.companyName").exists())
                .andExpect(jsonPath("$.companyAddress").exists())
                .andExpect(jsonPath("$.companyContact").exists())
                .andExpect(jsonPath("$.billingEmail").exists())
                .andExpect(jsonPath("$.collectionDay").exists())
                .andExpect(jsonPath("$.volumetricDivisor").exists());
    }
}
