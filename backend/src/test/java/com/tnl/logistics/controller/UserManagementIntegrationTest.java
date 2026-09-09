package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.AdminPasswordResetRequest;
import com.tnl.logistics.dto.AdminPinResetRequest;
import com.tnl.logistics.dto.UserCreateRequest;
import com.tnl.logistics.model.StaffType;
import com.tnl.logistics.model.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for GET/POST/PUT/DELETE /api/v1/users endpoints.
 * Covers RBAC gates, user CRUD, smart delete, password reset, and PIN reset.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class UserManagementIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private com.tnl.logistics.repository.PaymentRepository paymentRepository;

    @Autowired
    private com.tnl.logistics.repository.ShipmentRepository shipmentRepository;

    @Autowired
    private com.tnl.logistics.repository.AppUserRepository appUserRepository;

    @Autowired
    private com.tnl.logistics.repository.WaybillRepository waybillRepository;

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testListUsersAsAdminReturns200WithContent() throws Exception {
        mockMvc.perform(get("/api/v1/users").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.page.totalElements").isNumber());
    }

    @Test
    @WithMockUser(username = "office", roles = {"OFFICE_STAFF"})
    void testListUsersAsOfficeStaffReturns403() throws Exception {
        mockMvc.perform(get("/api/v1/users").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    void testListUsersUnauthenticatedReturns403() throws Exception {
        mockMvc.perform(get("/api/v1/users").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testCreateFieldStaffUserAssignsSequentialId() throws Exception {
        UserCreateRequest request = new UserCreateRequest();
        request.setFullName("Test Field Agent");
        request.setUsername("testagent001");
        request.setPassword("pass123");
        request.setRole(UserRole.FIELD_STAFF);
        request.setStaffType(StaffType.INTERNAL_TRUCK);

        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(org.hamcrest.Matchers.matchesPattern("U-\\d{3}")))
                .andExpect(jsonPath("$.username").value("testagent001"))
                .andExpect(jsonPath("$.role").value("FIELD_STAFF"))
                .andExpect(jsonPath("$.mustChangePassword").value(true))
                .andExpect(jsonPath("$.hasPinSet").value(false));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testCreateUserWithPinSetsPinHashFlag() throws Exception {
        UserCreateRequest request = new UserCreateRequest();
        request.setFullName("Pinned Office Staff");
        request.setUsername("pinoffice001");
        request.setPassword("pass123");
        request.setRole(UserRole.OFFICE_STAFF);
        request.setPin("1234");

        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.hasPinSet").value(true));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testCreateFieldStaffWithoutStaffTypeReturns400() throws Exception {
        UserCreateRequest request = new UserCreateRequest();
        request.setFullName("Incomplete Field Staff");
        request.setUsername("incomplete001");
        request.setPassword("pass123");
        request.setRole(UserRole.FIELD_STAFF);
        // staffType intentionally omitted

        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testAdminPasswordResetForcesChangeFlag() throws Exception {
        // USR-OFFICE is seeded — admin resets their password
        AdminPasswordResetRequest resetRequest = new AdminPasswordResetRequest();
        resetRequest.setNewPassword("newtemp456");

        mockMvc.perform(put("/api/v1/users/USR-OFFICE/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").isString());

        // Verify mustChangePassword is now true by fetching the user
        mockMvc.perform(get("/api/v1/users/USR-OFFICE").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mustChangePassword").value(true));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testAdminPinResetSetsHasPinSetTrue() throws Exception {
        AdminPinResetRequest pinRequest = new AdminPinResetRequest();
        pinRequest.setPin("9876");

        mockMvc.perform(put("/api/v1/users/USR-FIELD/reset-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pinRequest)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/users/USR-FIELD").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasPinSet").value(true));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testDeleteUserWithLinkedRecordsDeactivatesInsteadOfDeletes() throws Exception {
        var staff = appUserRepository.findById("USR-FIELD").orElseThrow();
        var shipment = shipmentRepository.findAll().get(0);
        var payment = new com.tnl.logistics.model.Payment(
                shipment,
                new java.math.BigDecimal("150.00"),
                com.tnl.logistics.model.PaymentMethod.CASH,
                java.time.LocalDate.now(),
                staff,
                "Test activity linkage"
        );
        paymentRepository.save(payment);

        mockMvc.perform(delete("/api/v1/users/USR-FIELD").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/users/USR-FIELD").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testDeleteUserWithNoLinkedRecordsHardDeletes() throws Exception {
        // Create a fresh user with no activity, then delete
        UserCreateRequest createReq = new UserCreateRequest();
        createReq.setFullName("Ephemeral Staff");
        createReq.setUsername("ephemeral001");
        createReq.setPassword("pass123");
        createReq.setRole(UserRole.OFFICE_STAFF);

        String body = mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String newUserId = objectMapper.readTree(body).get("userId").asText();

        mockMvc.perform(delete("/api/v1/users/" + newUserId).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        // User should be gone — 404
        mockMvc.perform(get("/api/v1/users/" + newUserId).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testDeleteUserWithOnlyWaybillRecordsDeactivatesInsteadOfDeletes() throws Exception {
        UserCreateRequest createReq = new UserCreateRequest();
        createReq.setFullName("Waybill Generator Staff");
        createReq.setUsername("waybillstaff001");
        createReq.setPassword("pass123");
        createReq.setRole(UserRole.OFFICE_STAFF);

        String body = mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String newUserId = objectMapper.readTree(body).get("userId").asText();
        var staff = appUserRepository.findById(newUserId).orElseThrow();

        var shipment = shipmentRepository.findAll().get(0);
        var waybill = new com.tnl.logistics.model.Waybill(
                "WB-TEST-999",
                shipment,
                staff,
                "Test Hauler"
        );
        waybillRepository.save(waybill);

        mockMvc.perform(delete("/api/v1/users/" + newUserId).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/users/" + newUserId).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }
}
