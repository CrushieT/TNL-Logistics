package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.dto.UserCreateRequest;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.StaffType;
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
        setRole("USR-ADMIN", UserRole.ADMIN, null);
        setRole("USR-OFFICE", UserRole.RECEIVING_STAFF, null);
        setRole("USR-FIELD", UserRole.COURIER_STAFF, StaffType.INTERNAL_TRUCK);
        setRole("USR-HAULER", UserRole.DISPATCH_STAFF, StaffType.HAULER_STAFF);
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
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/clients").with(user("USR-FIELD").roles("COURIER_STAFF")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/clients").with(user("USR-HAULER").roles("DISPATCH_STAFF")))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/vehicles").with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/vehicles").with(user("USR-OFFICE").roles("RECEIVING_STAFF")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/vehicles").with(user("USR-FIELD").roles("COURIER_STAFF")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/vehicles").with(user("USR-HAULER").roles("DISPATCH_STAFF")))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/shipments").with(user("USR-OFFICE").roles("RECEIVING_STAFF")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/shipments").with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isForbidden());
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
        UserCreateRequest legacyRole = request("legacy_role_user", UserRole.FIELD_STAFF, null);
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

        UserCreateRequest contradictory = request(
                "contradictory_role_user", UserRole.COURIER_STAFF, StaffType.HAULER_STAFF);
        mockMvc.perform(post("/api/v1/users")
                        .with(user("USR-ADMIN").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(contradictory)))
                .andExpect(status().isBadRequest());

        UserCreateRequest dispatch = request("derived_dispatch_user", UserRole.DISPATCH_STAFF, null);
        mockMvc.perform(post("/api/v1/users")
                        .with(user("USR-ADMIN").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dispatch)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("DISPATCH_STAFF"))
                .andExpect(jsonPath("$.staffType").value("HAULER_STAFF"));
    }

    private void setRole(String userId, UserRole role, StaffType staffType) {
        AppUser user = appUserRepository.findById(userId).orElseThrow();
        user.setRole(role);
        user.setStaffType(staffType);
        user.setActive(true);
        user.setMustChangePassword(false);
        appUserRepository.save(user);
    }

    private UserCreateRequest request(String username, UserRole role, StaffType staffType) {
        UserCreateRequest request = new UserCreateRequest();
        request.setFullName("Four Role Test User");
        request.setUsername(username);
        request.setPassword("pass123");
        request.setRole(role);
        request.setStaffType(staffType);
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
