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

    @org.springframework.boot.test.mock.mockito.SpyBean
    private com.tnl.logistics.repository.ShipmentRepository shipmentRepository;

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
                .andExpect(jsonPath("$.weeklyShipmentVolume.length()").value(7))
                .andExpect(jsonPath("$.weeklyShipmentVolume[0].label").value("Fri"))
                .andExpect(jsonPath("$.weeklyShipmentVolume[6].label").value("Thu"))
                .andExpect(jsonPath("$.forCollection.day").value("Thu"))
                .andExpect(jsonPath("$.outstandingVsCollected").isArray())
                .andExpect(jsonPath("$.recentActivity").isArray());
    }

    @Test
    @WithMockUser(username = "receiving", roles = {"RECEIVING_STAFF"})
    void testGetDashboardSummaryAsOfficeStaffReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "courier", roles = {"COURIER_STAFF"})
    void testGetDashboardSummaryAsFieldStaffReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    void testGetDashboardSummaryUnauthenticatedReturns401Unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testGetDashboardSummaryWithSpecificCycleReturns200() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/summary")
                .param("cycle", "2026-09-03")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shipmentCount").isNumber())
                .andExpect(jsonPath("$.weeklyShipmentVolume.length()").value(7));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testDashboardFailureReturnsHttp503AndStructuredErrorViaMockMvc() throws Exception {
        org.mockito.Mockito.doThrow(new org.springframework.dao.DataAccessResourceFailureException("Simulated DB connection failure"))
                .when(shipmentRepository).getCycleShipmentSummary(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());

        try {
            mockMvc.perform(get("/api/v1/dashboard/summary")
                    .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.status").value(503))
                    .andExpect(jsonPath("$.code").value("DASHBOARD_UNAVAILABLE"))
                    .andExpect(jsonPath("$.message").value("Dashboard data is temporarily unavailable due to a database error"));
        } finally {
            org.mockito.Mockito.reset(shipmentRepository);
        }
    }
}
