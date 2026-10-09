package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.dto.UserCreateRequest;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.repository.AppUserRepository;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class FourRoleAuthorizationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository appUserRepository;

    @BeforeEach
    void setUpRoles() {
        setRole("USR-ADMIN", UserRole.ADMIN);
        setRole("USR-OFFICE", UserRole.RECEIVING_STAFF);
        setRole("USR-FIELD", UserRole.COURIER_STAFF);
        setRole("USR-HAULER", UserRole.DISPATCH_STAFF);
    }

    @Test
    void enforcesPositiveAndNegativeRoleMatrix() throws Exception {
        mockMvc.perform(get("/api/v1/users").with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/users").with(user("USR-OFFICE").roles("RECEIVING_STAFF")))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/clients").with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/clients").with(user("USR-OFFICE").roles("RECEIVING_STAFF")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/clients").with(user("USR-FIELD").roles("COURIER_STAFF")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/clients").with(user("USR-HAULER").roles("DISPATCH_STAFF")))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/vehicles").with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/vehicles").with(user("USR-OFFICE").roles("RECEIVING_STAFF")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/vehicles").with(user("USR-FIELD").roles("COURIER_STAFF")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/vehicles").with(user("USR-HAULER").roles("DISPATCH_STAFF")))
                .andExpect(status().isOk());

        for (String[] identity : roleIdentities()) {
            mockMvc.perform(get("/api/v1/settings/branding")
                            .with(user(identity[0]).roles(identity[1])))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get("/api/v1/shipments").with(user("USR-OFFICE").roles("RECEIVING_STAFF")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/shipments").with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/shipments").with(user("USR-FIELD").roles("COURIER_STAFF")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/shipments").with(user("USR-HAULER").roles("DISPATCH_STAFF")))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/tracking-events/mine").with(user("USR-FIELD").roles("COURIER_STAFF")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/tracking-events/mine").with(user("USR-HAULER").roles("DISPATCH_STAFF")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/tracking-events/mine").with(user("USR-OFFICE").roles("RECEIVING_STAFF")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/tracking-events/mine").with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/payments/shipment/SHP-NOT-USED")
                        .with(user("USR-OFFICE").roles("RECEIVING_STAFF")))
                .andExpect(status().isForbidden());
        for (String[] identity : new String[][]{
                {"USR-ADMIN", "ADMIN"},
                {"USR-FIELD", "COURIER_STAFF"},
                {"USR-HAULER", "DISPATCH_STAFF"}}) {
            mockMvc.perform(get("/api/v1/payments/shipment/SHP-NOT-USED")
                            .with(user(identity[0]).roles(identity[1])))
                    .andExpect(status().isBadRequest());
        }

        mockMvc.perform(get("/api/v1/soa/collectors")
                        .with(user("USR-OFFICE").roles("RECEIVING_STAFF")))
                .andExpect(status().isForbidden());
        for (String[] identity : new String[][]{
                {"USR-ADMIN", "ADMIN"},
                {"USR-FIELD", "COURIER_STAFF"},
                {"USR-HAULER", "DISPATCH_STAFF"}}) {
            mockMvc.perform(get("/api/v1/soa/collectors")
                            .with(user(identity[0]).roles(identity[1])))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get("/api/v1/waybills/shipment-options").with(user("USR-HAULER").roles("DISPATCH_STAFF")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/waybills/shipment-options").with(user("USR-FIELD").roles("COURIER_STAFF")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/waybills/shipment-options").with(user("USR-OFFICE").roles("RECEIVING_STAFF")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/waybills/shipment-options").with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/settings").with(user("USR-HAULER").roles("DISPATCH_STAFF")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/payments").with(user("USR-HAULER").roles("DISPATCH_STAFF")))
                .andExpect(status().isForbidden());
    }

    @Test
    void preservesAdminReadOnlyWaybillAccess() throws Exception {
        mockMvc.perform(get("/api/v1/waybills").with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/waybills/WYB-NOT-USED/send")
                        .with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isForbidden());
    }

    @Test
    void listsDispatchStaffFirstAndFallsBackToCourierStaff() throws Exception {
        mockMvc.perform(get("/api/v1/waybills/haulers")
                        .with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].userId", hasItem("USR-HAULER")));

        for (AppUser dispatch : appUserRepository.findByRoleAndActiveTrue(UserRole.DISPATCH_STAFF)) {
            dispatch.setActive(false);
            appUserRepository.save(dispatch);
        }
        appUserRepository.flush();

        mockMvc.perform(get("/api/v1/waybills/haulers")
                        .with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].userId", hasItem("USR-FIELD")))
                .andExpect(jsonPath("$[*].userId", not(hasItem("USR-HAULER"))));
    }

    @Test
    void rejectsUnauthenticatedAndLegacyRoleTokens() throws Exception {
        mockMvc.perform(get("/api/v1/users"))
                .andExpect(status().isUnauthorized());

        AppUser courier = appUserRepository.findById("USR-FIELD").orElseThrow();
        String legacyToken = createSignedToken(
                courier.getUserId(), "FIELD_STAFF", courier.getTokenVersion());

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + legacyToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
    }

    @Test
    void rejectsStaleTokenVersionAfterMigrationStyleIncrement() throws Exception {
        AppUser receiving = appUserRepository.findById("USR-OFFICE").orElseThrow();
        int staleVersion = receiving.getTokenVersion();
        String staleToken = JwtTokenProvider.generateToken(
                receiving.getUserId(), receiving.getRole().name(), staleVersion);
        receiving.incrementTokenVersion();
        appUserRepository.saveAndFlush(receiving);

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + staleToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
    }

    @Test
    void rejectsLegacyUnknownAndContradictoryRoleAssignments() throws Exception {
        var legacyRole = objectMapper.valueToTree(request("legacy_role_user", UserRole.COURIER_STAFF));
        ((com.fasterxml.jackson.databind.node.ObjectNode) legacyRole).put("role", "FIELD_STAFF");
        mockMvc.perform(post("/api/v1/users")
                        .with(user("USR-ADMIN").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(legacyRole)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/users")
                        .with(user("USR-ADMIN").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Unknown Role\",\"username\":\"unknown_role_user\",\"password\":\"pass123\",\"role\":\"UNKNOWN_STAFF\"}"))
                .andExpect(status().isBadRequest());

        var contradictory = objectMapper.valueToTree(request("contradictory_role_user", UserRole.COURIER_STAFF));
        ((com.fasterxml.jackson.databind.node.ObjectNode) contradictory).put("staffType", "HAULER_STAFF");
        mockMvc.perform(post("/api/v1/users")
                        .with(user("USR-ADMIN").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(contradictory)))
                .andExpect(status().isBadRequest());

        UserCreateRequest dispatch = request("derived_dispatch_user", UserRole.DISPATCH_STAFF);
        mockMvc.perform(post("/api/v1/users")
                        .with(user("USR-ADMIN").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dispatch)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("DISPATCH_STAFF"))
                .andExpect(jsonPath("$.staffType").doesNotExist());
    }


    @Test
    void finalRoleReadMatrixPreservesBaselineCapabilities() throws Exception {
        // f44d421 controller guards, mapped through the verified Ship 1 role identities.
        Map<String, java.util.Set<String>> readMatrix = new LinkedHashMap<>();
        readMatrix.put("/api/v1/users", java.util.Set.of("ADMIN"));
        readMatrix.put("/api/v1/settings", java.util.Set.of("ADMIN"));
        readMatrix.put("/api/v1/payments", java.util.Set.of("ADMIN"));
        readMatrix.put("/api/v1/waybills", java.util.Set.of("ADMIN"));
        readMatrix.put("/api/v1/clients", java.util.Set.of("ADMIN", "RECEIVING_STAFF"));
        readMatrix.put("/api/v1/shipments", java.util.Set.of("ADMIN", "RECEIVING_STAFF"));
        readMatrix.put("/api/v1/shipments/calculation-settings", java.util.Set.of("ADMIN", "RECEIVING_STAFF"));
        readMatrix.put("/api/v1/vehicles", java.util.Set.of("ADMIN", "RECEIVING_STAFF", "COURIER_STAFF", "DISPATCH_STAFF"));
        readMatrix.put("/api/v1/vehicles/VH-001", java.util.Set.of("ADMIN", "RECEIVING_STAFF", "COURIER_STAFF", "DISPATCH_STAFF"));
        readMatrix.put("/api/v1/settings/branding", java.util.Set.of("ADMIN", "RECEIVING_STAFF", "COURIER_STAFF", "DISPATCH_STAFF"));
        readMatrix.put("/api/v1/soa/collectors", java.util.Set.of("ADMIN", "COURIER_STAFF", "DISPATCH_STAFF"));
        readMatrix.put("/api/v1/tracking-events/mine", java.util.Set.of("COURIER_STAFF", "DISPATCH_STAFF"));
        readMatrix.put("/api/v1/tracking-events/mine/metrics", java.util.Set.of("COURIER_STAFF", "DISPATCH_STAFF"));
        readMatrix.put("/api/v1/waybills/shipment-options", java.util.Set.of("DISPATCH_STAFF"));
        readMatrix.put("/api/v1/waybills/options", java.util.Set.of("DISPATCH_STAFF"));
        readMatrix.put("/api/v1/waybills/haulers", java.util.Set.of("ADMIN"));
        for (var endpoint : readMatrix.entrySet()) {
            mockMvc.perform(get(endpoint.getKey()).param("clientId", "CL-001")).andExpect(status().isUnauthorized());
            for (String[] identity : roleIdentities()) {
                mockMvc.perform(get(endpoint.getKey()).param("clientId", "CL-001").with(user(identity[0]).roles(identity[1])))
                        .andExpect(endpoint.getValue().contains(identity[1]) ? status().isOk() : status().isForbidden());
            }
        }
    }

    @Test
    void finalIdentityResponsesOmitRetiredFieldsAndSecrets() throws Exception {
        for (String[] identity : roleIdentities()) {
            AppUser account = appUserRepository.findById(identity[0]).orElseThrow();
            String token = JwtTokenProvider.generateToken(account.getUserId(), account.getRole().name(), account.getTokenVersion());
            mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.role").value(identity[1]))
                    .andExpect(jsonPath("$.staffType").doesNotExist())
                    .andExpect(jsonPath("$.haulerCompany").doesNotExist())
                    .andExpect(jsonPath("$.passwordHash").doesNotExist())
                    .andExpect(jsonPath("$.pinHash").doesNotExist());
            mockMvc.perform(get("/api/v1/users/" + identity[0]).with(user("USR-ADMIN").roles("ADMIN")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.role").value(identity[1]))
                    .andExpect(jsonPath("$.staffType").doesNotExist())
                    .andExpect(jsonPath("$.haulerCompany").doesNotExist())
                    .andExpect(jsonPath("$.passwordHash").doesNotExist())
                    .andExpect(jsonPath("$.pinHash").doesNotExist());
        }
        mockMvc.perform(get("/api/v1/waybills/haulers").with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].staffType").isEmpty())
                .andExpect(jsonPath("$[*].haulerCompany").isEmpty());
    }

    @Test
    void rejectsRetiredSubtypeInputOnCreateAndUpdateWithoutMutation() throws Exception {
        AppUser courier = appUserRepository.findById("USR-FIELD").orElseThrow();
        int originalVersion = courier.getTokenVersion();
        long originalCount = appUserRepository.count();
        for (String fieldName : new String[]{"staffType", "staff_type"}) {
            for (String subtype : new String[]{"INTERNAL_TRUCK", "HAULER_STAFF", "UNKNOWN", null}) {
                var createPayload = objectMapper.valueToTree(request("retired_subtype_user", UserRole.COURIER_STAFF));
                ((com.fasterxml.jackson.databind.node.ObjectNode) createPayload).put(fieldName, subtype);
                mockMvc.perform(post("/api/v1/users").with(user("USR-ADMIN").roles("ADMIN"))
                                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(createPayload)))
                        .andExpect(status().isBadRequest());
                var updatePayload = objectMapper.createObjectNode()
                        .put("fullName", courier.getFullName()).put("username", courier.getUsername())
                        .put("role", "COURIER_STAFF").put("active", true).put(fieldName, subtype);
                mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/v1/users/USR-FIELD")
                                .with(user("USR-ADMIN").roles("ADMIN")).contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(updatePayload)))
                        .andExpect(status().isBadRequest());
            }
        }
        org.junit.jupiter.api.Assertions.assertEquals(originalCount, appUserRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(originalVersion, courier.getTokenVersion());
        org.junit.jupiter.api.Assertions.assertEquals(UserRole.COURIER_STAFF, courier.getRole());
    }

    @Test
    void rejectsLegacyAndUnknownRoleFiltersWith400() throws Exception {
        for (String invalidRole : new String[]{"OFFICE_STAFF", "FIELD_STAFF", "HAULER_STAFF", "UNKNOWN_ROLE"}) {
            mockMvc.perform(get("/api/v1/users").param("role", invalidRole).with(user("USR-ADMIN").roles("ADMIN")))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void rejectsEveryUnsupportedJwtRoleAndPersistedRoleMismatch() throws Exception {
        AppUser courier = appUserRepository.findById("USR-FIELD").orElseThrow();
        for (String invalidRole : new String[]{"OFFICE_STAFF", "FIELD_STAFF", "HAULER_STAFF", "UNKNOWN_ROLE", "ADMIN", "DISPATCH_STAFF"}) {
            String token = createSignedToken(courier.getUserId(), invalidRole, courier.getTokenVersion());
            mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
        }
    }

    private void setRole(String userId, UserRole role) {
        AppUser user = appUserRepository.findById(userId).orElseThrow();
        user.setRole(role);
        user.setActive(true);
        user.setMustChangePassword(false);
        appUserRepository.save(user);
    }

    private String[][] roleIdentities() {
        return new String[][]{
                {"USR-ADMIN", "ADMIN"},
                {"USR-OFFICE", "RECEIVING_STAFF"},
                {"USR-FIELD", "COURIER_STAFF"},
                {"USR-HAULER", "DISPATCH_STAFF"}
        };
    }

    private UserCreateRequest request(String username, UserRole role) {
        UserCreateRequest request = new UserCreateRequest();
        request.setFullName("Four Role Test User");
        request.setUsername(username);
        request.setPassword("pass123");
        request.setRole(role);
        return request;
    }

    private String createSignedToken(String userId, String role, int tokenVersion) throws Exception {
        long nowSeconds = System.currentTimeMillis() / 1000;
        Map<String, Object> header = Map.of("alg", "HS256", "typ", "JWT");
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sub", userId);
        payload.put("uid", userId);
        payload.put("role", role);
        payload.put("ver", tokenVersion);
        payload.put("iat", nowSeconds);
        payload.put("exp", nowSeconds + 3600);

        String encodedHeader = Base64.getUrlEncoder().withoutPadding().encodeToString(
                objectMapper.writeValueAsString(header).getBytes(StandardCharsets.UTF_8));
        String encodedPayload = Base64.getUrlEncoder().withoutPadding().encodeToString(
                objectMapper.writeValueAsString(payload).getBytes(StandardCharsets.UTF_8));
        String signingInput = encodedHeader + "." + encodedPayload;

        Field secretField = JwtTokenProvider.class.getDeclaredField("secret");
        secretField.setAccessible(true);
        Method signMethod = JwtTokenProvider.class.getDeclaredMethod("sign", String.class, String.class);
        signMethod.setAccessible(true);
        String signature = (String) signMethod.invoke(null, signingInput, secretField.get(null));
        return signingInput + "." + signature;
    }
}
