package com.tnl.logistics.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test verifying GET /api/v1/dashboard/summary contract,
 * RBAC authorization gates, and payload structure.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class DashboardIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testGetDashboardSummaryAsAdminReturns200AndExpectedStructure() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shipmentCount").isNumber())
                .andExpect(jsonPath("$.parcelCount").isNumber())
                .andExpect(jsonPath("$.todayShipmentCount").isNumber())
                .andExpect(jsonPath("$.todayDateFormatted").isString())
                .andExpect(jsonPath("$.unpaidTransactionCount").isNumber())
                .andExpect(jsonPath("$.forCollection").exists())
                .andExpect(jsonPath("$.forCollection.amount").isNumber())
                .andExpect(jsonPath("$.parcelUnitsByStatus").isArray())
                .andExpect(jsonPath("$.weeklyShipmentVolume").isArray())
                .andExpect(jsonPath("$.outstandingVsCollected").isArray())
                .andExpect(jsonPath("$.recentActivity").isArray());
    }

    @Test
    @WithMockUser(username = "office", roles = {"OFFICE_STAFF"})
    void testGetDashboardSummaryAsOfficeStaffReturns200() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shipmentCount").isNumber());
    }

    @Test
    @WithMockUser(username = "field", roles = {"FIELD_STAFF"})
    void testGetDashboardSummaryAsFieldStaffReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    void testGetDashboardSummaryUnauthenticatedReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }
}
