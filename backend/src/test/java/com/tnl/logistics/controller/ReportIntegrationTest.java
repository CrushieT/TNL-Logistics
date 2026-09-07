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

import java.time.LocalDate;

/**
 * Integration test verifying GET /api/v1/reports/summary operational and
 * financial reporting engine, RBAC access control, and query parameter filtering.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class ReportIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testGetReportSummaryAsAdminReturns200AndStructure() throws Exception {
        mockMvc.perform(get("/api/v1/reports/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.startDate").isNotEmpty())
                .andExpect(jsonPath("$.endDate").isNotEmpty())
                .andExpect(jsonPath("$.kpis").isMap())
                .andExpect(jsonPath("$.kpis.totalBilledRevenue").isNumber())
                .andExpect(jsonPath("$.kpis.totalCollectedRevenue").isNumber())
                .andExpect(jsonPath("$.kpis.outstandingReceivables").isNumber())
                .andExpect(jsonPath("$.kpis.totalShipments").isNumber())
                .andExpect(jsonPath("$.kpis.totalParcels").isNumber())
                .andExpect(jsonPath("$.kpis.deliveryCompletionRate").isNumber())
                .andExpect(jsonPath("$.clientRevenue").isArray())
                .andExpect(jsonPath("$.paymentMethods").isArray())
                .andExpect(jsonPath("$.deductions").isArray())
                .andExpect(jsonPath("$.dailyVolume").isArray())
                .andExpect(jsonPath("$.statusDistribution").isArray())
                .andExpect(jsonPath("$.receivablesAging").isArray());
    }

    @Test
    @WithMockUser(username = "office", roles = {"OFFICE_STAFF"})
    void testGetReportSummaryAsOfficeStaffReturns200() throws Exception {
        mockMvc.perform(get("/api/v1/reports/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kpis").exists());
    }

    @Test
    @WithMockUser(username = "field", roles = {"FIELD_STAFF"})
    void testGetReportSummaryAsFieldStaffReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/reports/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    void testGetReportSummaryUnauthenticatedReturnsForbiddenOrUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/reports/summary")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testGetReportSummaryWithExplicitDateRange() throws Exception {
        LocalDate start = LocalDate.now().minusDays(15);
        LocalDate end = LocalDate.now();

        mockMvc.perform(get("/api/v1/reports/summary")
                .param("startDate", start.toString())
                .param("endDate", end.toString())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.startDate").value(start.toString()))
                .andExpect(jsonPath("$.endDate").value(end.toString()))
                .andExpect(jsonPath("$.dailyVolume").isArray());
    }
}
