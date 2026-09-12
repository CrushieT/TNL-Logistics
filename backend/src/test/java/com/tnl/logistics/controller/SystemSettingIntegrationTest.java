package com.tnl.logistics.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.SaveStatementRequest;
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

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;

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

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testHistoricalCyclesAndSoaPreservedWhenCollectionDayChanges() throws Exception {
        LocalDate historicalDate = LocalDate.of(2026, 8, 27);

        // 1. Save an SOA for a historical Thursday cycle that has seeded shipments
        SaveStatementRequest saveReq = new SaveStatementRequest();
        saveReq.setClientId("CL-001");
        saveReq.setTargetDate(historicalDate);
        saveReq.setDeductionAmount(new BigDecimal("50.00"));
        saveReq.setDeductionNote("Historical cycle discount");
        saveReq.setCollectedBy("Admin User");

        mockMvc.perform(post("/api/v1/soa/save")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(saveReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cycleThursday").value(historicalDate.toString()))
                .andExpect(jsonPath("$.deductionAmount").value(50.00));

        try {
            // 2. Change system collection day setting to MONDAY
            UpdateSystemSettingRequest updateReq = new UpdateSystemSettingRequest(
                    "TNL Logistics",
                    "Manila Central Hub",
                    "0917-555-0000",
                    "billing@tnllogistics.ph",
                    DayOfWeek.MONDAY,
                    5000
            );

            mockMvc.perform(put("/api/v1/settings")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(updateReq)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.collectionDay").value("MONDAY"));

            // 3. Verify that GET /api/v1/collections/cycles still contains the historical 2026-08-27 cycle
            mockMvc.perform(get("/api/v1/collections/cycles"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray())
                    .andExpect(jsonPath("$[?(@ == '2026-08-27')]").exists());

            // 4. Verify that GET /api/v1/collections/weekly?targetDate=2026-08-27 still loads the finalized SOA and deductions
            mockMvc.perform(get("/api/v1/collections/weekly")
                    .param("targetDate", historicalDate.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.collectionDate").value(historicalDate.toString()))
                    .andExpect(jsonPath("$.items[?(@.clientId == 'CL-001')].status").value("SOA_GENERATED"))
                    .andExpect(jsonPath("$.items[?(@.clientId == 'CL-001')].totalDeductions").value(50.0));
        } finally {
            // Restore default setting
            UpdateSystemSettingRequest restoreReq = new UpdateSystemSettingRequest(
                    "TNL Logistics",
                    "Manila Central Hub",
                    "0917-555-0000",
                    "billing@tnllogistics.ph",
                    DayOfWeek.THURSDAY,
                    5000
            );
            mockMvc.perform(put("/api/v1/settings")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(restoreReq)));
        }
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testDynamicCycleStartDateAnchoringAndGhostCycleElimination() throws Exception {
        LocalDate nextMonday = LocalDate.of(2026, 9, 7);

        // 1. Verify dynamic cycle start calculation:
        // When checking start date for a cycle, it dynamically anchors to the day after preceding cycle.
        LocalDate calculatedStart = collectionsService.calculateCycleStartDate(nextMonday);
        assertNotNull(calculatedStart);
        assertTrue(!calculatedStart.isAfter(nextMonday));

        try {
            // 2. Change collection day to WEDNESDAY
            UpdateSystemSettingRequest wedReq = new UpdateSystemSettingRequest(
                    "TNL Logistics",
                    "Manila Central Hub",
                    "0917-555-0000",
                    "billing@tnllogistics.ph",
                    DayOfWeek.WEDNESDAY,
                    5000
            );
            mockMvc.perform(put("/api/v1/settings")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(wedReq)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.collectionDay").value("WEDNESDAY"));

            // 3. Verify active cycles contains the active Wednesday cycle at index 0
            LocalDate activeWed = collectionsService.calculateActiveCycleDate(LocalDate.now());
            mockMvc.perform(get("/api/v1/collections/cycles"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray())
                    .andExpect(jsonPath("$[0]").value(activeWed.toString()));

            // 4. Change collection day to MONDAY
            UpdateSystemSettingRequest monReq = new UpdateSystemSettingRequest(
                    "TNL Logistics",
                    "Manila Central Hub",
                    "0917-555-0000",
                    "billing@tnllogistics.ph",
                    DayOfWeek.MONDAY,
                    5000
            );
            mockMvc.perform(put("/api/v1/settings")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(monReq)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.collectionDay").value("MONDAY"));

            // 5. Verify active cycle now closes on Monday and previous unfinalized Wednesday does not linger as ghost
            LocalDate activeMon = collectionsService.calculateActiveCycleDate(LocalDate.now());
            mockMvc.perform(get("/api/v1/collections/cycles"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0]").value(activeMon.toString()))
                    .andExpect(jsonPath("$[?(@ == '" + activeWed.toString() + "')]").doesNotExist());
        } finally {
            // Restore default THURSDAY
            UpdateSystemSettingRequest restoreReq = new UpdateSystemSettingRequest(
                    "TNL Logistics",
                    "Manila Central Hub",
                    "0917-555-0000",
                    "billing@tnllogistics.ph",
                    DayOfWeek.THURSDAY,
                    5000
            );
            mockMvc.perform(put("/api/v1/settings")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(restoreReq)));
        }
    }
}
