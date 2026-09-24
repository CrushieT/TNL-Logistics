package com.tnl.logistics.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AdminConsoleAuthorizationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(username = "office", roles = "OFFICE_STAFF")
    void officeStaffCannotAccessConsoleOnlyOperations() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/summary")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/collections/weekly")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/collections/cycles")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/reports/summary")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/tracking-events")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/tracking-events/metrics")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/events/stream")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/payments")).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"shipmentId\":\"SHP-001\",\"amountPaid\":100,\"method\":\"CASH\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/clients/CL-001")).andExpect(status().isForbidden());
        mockMvc.perform(put("/api/v1/clients/CL-001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Client\",\"address\":\"Address\",\"contactNumber\":\"09170000000\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/v1/clients/CL-001")).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/vehicles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"plateNumber\":\"ABC-123\",\"description\":\"Test vehicle\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/v1/vehicles/VH-001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"plateNumber\":\"ABC-123\",\"description\":\"Test vehicle\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/v1/vehicles/VH-001")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/soa/preview").param("clientId", "CL-001"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/soa/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientId\":\"CL-001\",\"targetDate\":\"2026-09-24\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/waybills")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/waybills/shipments")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/waybills/haulers")).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/waybills/send-to-hauler")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"shipmentId\":\"SHP-001\",\"haulerName\":\"Test Hauler\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/waybills/complete/SHP-001")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "office", roles = "OFFICE_STAFF")
    void officeStaffRetainsMobileSharedClientOperations() throws Exception {
        mockMvc.perform(get("/api/v1/clients"))
                .andExpect(status().isOk());
    }
}
