package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.AdminPasswordResetRequest;
import com.tnl.logistics.dto.AdminPinResetRequest;
import com.tnl.logistics.dto.UserCreateRequest;
import com.tnl.logistics.dto.UserUpdateRequest;
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

    @Autowired
    private com.tnl.logistics.repository.ClientRepository clientRepository;

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testListUsersAsAdminReturns200WithContent() throws Exception {
        mockMvc.perform(get("/api/v1/users").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.page.totalElements").isNumber());
    }

    @Test
    @WithMockUser(username = "USR-OFFICE", roles = {"OFFICE_STAFF"})
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
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
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
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
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
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testCreateAdminUserReturnsBadRequest() throws Exception {
        UserCreateRequest request = new UserCreateRequest();
        request.setFullName("Admin Attempt");
        request.setUsername("adminattempt001");
        request.setPassword("pass123");
        request.setRole(UserRole.ADMIN);

        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testPromoteStaffToAdminReturnsBadRequest() throws Exception {
        UserUpdateRequest updateReq = new UserUpdateRequest();
        updateReq.setFullName("Office Staff Elevated");
        updateReq.setUsername("office");
        updateReq.setRole(UserRole.ADMIN);
        updateReq.setActive(true);

        mockMvc.perform(put("/api/v1/users/USR-OFFICE")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testDeleteAdminUserBySelfReturnsForbidden() throws Exception {
        mockMvc.perform(delete("/api/v1/users/USR-ADMIN")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "othercaller", roles = {"ADMIN"})
    void testDeleteAdminUserByOtherReturnsBadRequest() throws Exception {
        mockMvc.perform(delete("/api/v1/users/USR-ADMIN")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
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
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
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
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
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
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testAdminClearPinSetsHasPinSetFalse() throws Exception {
        AdminPinResetRequest pinRequest = new AdminPinResetRequest();
        pinRequest.setPin("9876");

        mockMvc.perform(put("/api/v1/users/USR-FIELD/reset-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pinRequest)))
                .andExpect(status().isOk());

        AdminPinResetRequest clearRequest = new AdminPinResetRequest();
        clearRequest.setClearPin(true);

        mockMvc.perform(put("/api/v1/users/USR-FIELD/reset-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(clearRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Mobile PIN cleared. Staff member must configure a new PIN on next mobile login."));

        mockMvc.perform(get("/api/v1/users/USR-FIELD").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasPinSet").value(false));
    }

    @Test
    void testAdminResetPasswordInvalidatesExistingToken() throws Exception {
        var user = appUserRepository.findById("USR-OFFICE").orElseThrow();
        int initialVersion = user.getTokenVersion() != null ? user.getTokenVersion() : 1;
        String oldToken = com.tnl.logistics.config.JwtTokenProvider.generateToken(user.getUserId(), user.getRole().name(), initialVersion);

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isOk());

        AdminPasswordResetRequest resetReq = new AdminPasswordResetRequest();
        resetReq.setNewPassword("TempPass123");

        String adminToken = com.tnl.logistics.config.JwtTokenProvider.generateToken("USR-ADMIN", "ADMIN", 1);
        mockMvc.perform(put("/api/v1/users/USR-OFFICE/reset-password")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetReq)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
    }

    @Test
    void testAdminResetPinInvalidatesExistingToken() throws Exception {
        var user = appUserRepository.findById("USR-FIELD").orElseThrow();
        int initialVersion = user.getTokenVersion() != null ? user.getTokenVersion() : 1;
        String oldToken = com.tnl.logistics.config.JwtTokenProvider.generateToken(user.getUserId(), user.getRole().name(), initialVersion);

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isOk());

        AdminPinResetRequest clearReq = new AdminPinResetRequest(true);
        String adminToken = com.tnl.logistics.config.JwtTokenProvider.generateToken("USR-ADMIN", "ADMIN", 1);
        mockMvc.perform(put("/api/v1/users/USR-FIELD/reset-pin")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(clearReq)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testDeleteUserWithLinkedRecordsDeactivatesInsteadOfDeletes() throws Exception {
        var staff = appUserRepository.findById("USR-FIELD").orElseThrow();
        var client = clientRepository.findById("CL-001").orElseGet(() ->
                clientRepository.save(new com.tnl.logistics.model.Client("CL-001", "Acme Logistics Client", "Manila", "09170000000", "client@acme.com", com.tnl.logistics.model.ChargeModel.FLAT, true)));
        var shipment = shipmentRepository.findAll().stream().findFirst().orElseGet(() ->
                shipmentRepository.save(new com.tnl.logistics.model.Shipment(
                        "SHP-TEST-LINK", client, "Recipient", "Address", "09170000000", 1,
                        com.tnl.logistics.model.ChargeModel.FLAT, new java.math.BigDecimal("150.00"),
                        java.math.BigDecimal.ZERO, new java.math.BigDecimal("150.00"), false,
                        com.tnl.logistics.model.RegisteredVia.DESKTOP_OFFICE
                )));
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
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
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
    void testDeletedAndRecreatedUsernameRejectsOriginalToken() throws Exception {
        var adminUser = appUserRepository.findById("USR-ADMIN").orElseThrow();
        String adminToken = "Bearer " + com.tnl.logistics.config.JwtTokenProvider.generateToken(
                adminUser.getUserId(), adminUser.getRole().name(), adminUser.getTokenVersion());

        UserCreateRequest originalRequest = new UserCreateRequest();
        originalRequest.setFullName("Original Session Owner");
        originalRequest.setUsername("reusedsession001");
        originalRequest.setPassword("pass123");
        originalRequest.setRole(UserRole.OFFICE_STAFF);

        String originalResponse = mockMvc.perform(post("/api/v1/users")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(originalRequest)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String originalUserId = objectMapper.readTree(originalResponse).get("userId").asText();
        var originalUser = appUserRepository.findById(originalUserId).orElseThrow();
        String originalToken = "Bearer " + com.tnl.logistics.config.JwtTokenProvider.generateToken(
                originalUser.getUserId(), originalUser.getRole().name(), originalUser.getTokenVersion());

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", originalToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(originalUserId));

        mockMvc.perform(delete("/api/v1/users/" + originalUserId)
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        String replacementResponse = mockMvc.perform(post("/api/v1/users")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(originalRequest)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String replacementUserId = objectMapper.readTree(replacementResponse).get("userId").asText();

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", originalToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));

        var replacementUser = appUserRepository.findById(replacementUserId).orElseThrow();
        String replacementToken = "Bearer " + com.tnl.logistics.config.JwtTokenProvider.generateToken(
                replacementUser.getUserId(), replacementUser.getRole().name(), replacementUser.getTokenVersion());

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", replacementToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(replacementUserId))
                .andExpect(jsonPath("$.username").value("reusedsession001"));
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
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

        var client = clientRepository.findById("CL-001").orElseGet(() ->
                clientRepository.save(new com.tnl.logistics.model.Client("CL-001", "Acme Logistics Client", "Manila", "09170000000", "client@acme.com", com.tnl.logistics.model.ChargeModel.FLAT, true)));
        var shipment = shipmentRepository.findAll().stream().findFirst().orElseGet(() ->
                shipmentRepository.save(new com.tnl.logistics.model.Shipment(
                        "SHP-TEST-WB", client, "Recipient", "Address", "09170000000", 1,
                        com.tnl.logistics.model.ChargeModel.FLAT, new java.math.BigDecimal("150.00"),
                        java.math.BigDecimal.ZERO, new java.math.BigDecimal("150.00"), false,
                        com.tnl.logistics.model.RegisteredVia.DESKTOP_OFFICE
                )));
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

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testCreateUserNormalizesUsernameTrimmingAndLowercasing() throws Exception {
        UserCreateRequest request = new UserCreateRequest();
        request.setFullName("Normalized Staff");
        request.setUsername("  PaddedUsername01  ");
        request.setPassword("pass123");
        request.setRole(UserRole.OFFICE_STAFF);

        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("paddedusername01"));

        // Verify duplicate with different casing is rejected
        UserCreateRequest duplicateReq = new UserCreateRequest();
        duplicateReq.setFullName("Duplicate Staff");
        duplicateReq.setUsername("PADDEDUSERNAME01");
        duplicateReq.setPassword("pass123");
        duplicateReq.setRole(UserRole.OFFICE_STAFF);

        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(duplicateReq)))
                .andExpect(status().isConflict());
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testUpdateUserNormalizesUsernameTrimmingAndLowercasing() throws Exception {
        UserCreateRequest createReq = new UserCreateRequest();
        createReq.setFullName("Staff To Update");
        createReq.setUsername("updatable001");
        createReq.setPassword("pass123");
        createReq.setRole(UserRole.OFFICE_STAFF);

        String body = mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String newUserId = objectMapper.readTree(body).get("userId").asText();

        UserUpdateRequest updateReq = new UserUpdateRequest();
        updateReq.setFullName("Staff With Padded Name");
        updateReq.setUsername("  RenamedStaff001  ");
        updateReq.setRole(UserRole.OFFICE_STAFF);
        updateReq.setActive(true);

        mockMvc.perform(put("/api/v1/users/" + newUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("renamedstaff001"));
    }

    @Test
    void testRoleChangeInvalidatesExistingToken() throws Exception {
        var officeUser = appUserRepository.findById("USR-OFFICE").orElseThrow();
        var adminUser = appUserRepository.findById("USR-ADMIN").orElseThrow();
        String officeToken = com.tnl.logistics.config.JwtTokenProvider.generateToken(
                officeUser.getUserId(), officeUser.getRole().name(), officeUser.getTokenVersion());
        String adminToken = com.tnl.logistics.config.JwtTokenProvider.generateToken(
                adminUser.getUserId(), adminUser.getRole().name(), adminUser.getTokenVersion());

        UserUpdateRequest updateRequest = new UserUpdateRequest();
        updateRequest.setFullName(officeUser.getFullName());
        updateRequest.setUsername(officeUser.getUsername());
        updateRequest.setRole(UserRole.FIELD_STAFF);
        updateRequest.setStaffType(StaffType.INTERNAL_TRUCK);
        updateRequest.setActive(true);

        mockMvc.perform(put("/api/v1/users/USR-OFFICE")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + officeToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
    }

    @Test
    void testDeactivationInvalidatesExistingToken() throws Exception {
        var officeUser = appUserRepository.findById("USR-OFFICE").orElseThrow();
        var adminUser = appUserRepository.findById("USR-ADMIN").orElseThrow();
        String officeToken = com.tnl.logistics.config.JwtTokenProvider.generateToken(
                officeUser.getUserId(), officeUser.getRole().name(), officeUser.getTokenVersion());
        String adminToken = com.tnl.logistics.config.JwtTokenProvider.generateToken(
                adminUser.getUserId(), adminUser.getRole().name(), adminUser.getTokenVersion());

        UserUpdateRequest updateRequest = new UserUpdateRequest();
        updateRequest.setFullName(officeUser.getFullName());
        updateRequest.setUsername(officeUser.getUsername());
        updateRequest.setRole(officeUser.getRole());
        updateRequest.setActive(false);

        mockMvc.perform(put("/api/v1/users/USR-OFFICE")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + officeToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testCreateUserRejectsInvalidCanonicalUsername() throws Exception {
        UserCreateRequest request = new UserCreateRequest();
        request.setFullName("Invalid Username");
        request.setUsername("not valid");
        request.setPassword("pass123");
        request.setRole(UserRole.OFFICE_STAFF);

        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
}
