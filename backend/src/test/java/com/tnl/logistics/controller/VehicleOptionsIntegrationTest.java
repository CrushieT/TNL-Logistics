package com.tnl.logistics.controller;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.model.Vehicle;
import com.tnl.logistics.repository.VehicleRepository;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class VehicleOptionsIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired VehicleRepository vehicleRepository;

    @BeforeEach
    void setUp() {
        vehicleRepository.deleteAll();
    }

    @Test
    void unauthenticatedRequestIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/vehicles/options"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void allAuthorizedRolesCanAccessOptions() throws Exception {
        Vehicle v = new Vehicle("VH-991", "NKR-991", "Van", "Active Courier Van", "Active", "None");
        v.setActive(true);
        vehicleRepository.save(v);

        for (String role : new String[]{"ADMIN", "RECEIVING_STAFF", "COURIER_STAFF", "DISPATCH_STAFF"}) {
            mockMvc.perform(get("/api/v1/vehicles/options").with(user("USR-TEST").roles(role)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].vehicleId").value("VH-991"));
        }
    }

    @Test
    void defaultPaginationReturns20ItemsAndPageMetadata() throws Exception {
        for (int i = 1; i <= 25; i++) {
            Vehicle v = new Vehicle(
                    String.format("VH-%03d", i),
                    String.format("PLT-%03d", i),
                    "4-Wheeler",
                    "Fleet Van " + i,
                    "Active",
                    ""
            );
            v.setActive(true);
            vehicleRepository.save(v);
        }

        MvcResult result = mockMvc.perform(get("/api/v1/vehicles/options")
                        .with(user("COURIER").roles("COURIER_STAFF")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(20)))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").value(25))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.first").value(true))
                .andExpect(jsonPath("$.last").value(false))
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        assertEquals("VH-001", json.get("content").get(0).get("vehicleId").asText());

        // Fetch second page
        mockMvc.perform(get("/api/v1/vehicles/options")
                        .param("page", "1")
                        .with(user("COURIER").roles("COURIER_STAFF")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(5)))
                .andExpect(jsonPath("$.number").value(1))
                .andExpect(jsonPath("$.last").value(true));
    }

    @Test
    void searchFiltersByPlateNumberVehicleIdAndDescription() throws Exception {
        Vehicle v1 = new Vehicle("VH-101", "ABC-1234", "Truck", "North Sector Delivery", "Active", "");
        v1.setActive(true);
        vehicleRepository.save(v1);

        Vehicle v2 = new Vehicle("VH-102", "XYZ-5678", "Van", "South Sector Pickup", "Active", "");
        v2.setActive(true);
        vehicleRepository.save(v2);

        Vehicle v3 = new Vehicle("VH-103", "LMN-9999", "Truck", "Airport Express", "Active", "");
        v3.setActive(true);
        vehicleRepository.save(v3);

        // Search by plate number
        mockMvc.perform(get("/api/v1/vehicles/options")
                        .param("search", "1234")
                        .with(user("COURIER").roles("COURIER_STAFF")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].plateNumber").value("ABC-1234"));

        // Search by vehicle ID
        mockMvc.perform(get("/api/v1/vehicles/options")
                        .param("search", "VH-102")
                        .with(user("COURIER").roles("COURIER_STAFF")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].vehicleId").value("VH-102"));

        // Search by description keyword
        mockMvc.perform(get("/api/v1/vehicles/options")
                        .param("search", "airport")
                        .with(user("COURIER").roles("COURIER_STAFF")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].vehicleId").value("VH-103"));
    }

    @Test
    void inactiveVehiclesAreExcludedFromOptions() throws Exception {
        Vehicle active = new Vehicle("VH-201", "ACT-001", "Van", "Operational", "Active", "");
        active.setActive(true);
        vehicleRepository.save(active);

        Vehicle inactive = new Vehicle("VH-202", "INA-002", "Van", "Decommissioned", "Inactive", "");
        inactive.setActive(false);
        vehicleRepository.save(inactive);

        mockMvc.perform(get("/api/v1/vehicles/options")
                        .with(user("COURIER").roles("COURIER_STAFF")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].vehicleId").value("VH-201"));
    }

    @Test
    void boundsInvalidPageAndSizeParameters() throws Exception {
        Vehicle v = new Vehicle("VH-301", "BND-001", "Van", "Bounded Test", "Active", "");
        v.setActive(true);
        vehicleRepository.save(v);

        // Negative page defaults to 0, size over 100 bounds to 100
        mockMvc.perform(get("/api/v1/vehicles/options")
                        .param("page", "-5")
                        .param("size", "999")
                        .with(user("COURIER").roles("COURIER_STAFF")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(100));

        // Size less than 1 bounds to 1
        mockMvc.perform(get("/api/v1/vehicles/options")
                        .param("size", "0")
                        .with(user("COURIER").roles("COURIER_STAFF")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(1));
    }
}
