package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.service.MobileSessionService;
import com.tnl.logistics.service.AuthSecurityService;
import org.junit.jupiter.api.AfterEach;
import org.springframework.test.context.transaction.TestTransaction;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Propagation;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.MobileDeviceBindingRepository;
import com.tnl.logistics.service.LoginRateLimiterService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;
import java.util.List;
import java.util.ArrayList;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class MobileBindingSwitchIntegrationTest {
    private static final String PASSWORD = "switch-test-password";
    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AppUserRepository users;
    @Autowired private MobileDeviceBindingRepository bindings;
    @Autowired private BCryptPasswordEncoder encoder;
    @Autowired private LoginRateLimiterService limiter;
    @Autowired private MobileSessionService sessions;
    @Autowired private AuthSecurityService security;
    private final List<AppUser> createdUsers = new ArrayList<>();
    private AppUser firstUser;
    private AppUser secondUser;

    @BeforeEach
    void prepareUsers() {
        limiter.reset();
        firstUser = createUser(UserRole.RECEIVING_STAFF);
        secondUser = createUser(UserRole.COURIER_STAFF);
    }

    private AppUser createUser(UserRole role) {
        String identifier = "SW-" + UUID.randomUUID().toString().substring(0, 12);
        AppUser user = new AppUser(identifier, identifier.toLowerCase(), encoder.encode(PASSWORD), "Switch test", role);
        user.setActive(true);
        user.setMustChangePassword(false);
        user.setTokenVersion(1);
        user.setPinHash(encoder.encode("1234"));
        createdUsers.add(user);
        return users.saveAndFlush(user);
    }

    @AfterEach
    void cleanCommittedFixtures() {
        if (!TestTransaction.isActive()) {
            for (AppUser user : createdUsers) bindings.deleteAll(bindings.findByUserIdAndActiveTrue(user.getUserId()));
            for (AppUser user : createdUsers) users.deleteById(user.getUserId());
        }
    }

    private JsonNode login(AppUser user) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/v1/auth/mobile-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("username", user.getUsername(), "password", PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    @Test
    void differentAccountRequiresConfirmationWithoutChangingBinding() throws Exception {
        JsonNode session = login(firstUser);
        String deviceId = session.get("deviceId").asText();
        mockMvc.perform(post("/api/v1/auth/mobile-login")
                        .header("X-Device-Id", deviceId)
                        .header("X-Device-Token", session.get("deviceToken").asText())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("username", secondUser.getUsername(), "password", PASSWORD))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DEVICE_SWITCH_CONFIRMATION_REQUIRED"))
                .andExpect(jsonPath("$.token").doesNotExist());
        assertEquals(firstUser.getUserId(), bindings.findByDeviceId(deviceId).orElseThrow().getUserId());
    }

    private MvcResult attemptSwitch(AppUser target, JsonNode session, boolean confirm, String deviceToken) throws Exception {
        var request = post("/api/v1/auth/mobile-login")
                .header("X-Device-Id", session.get("deviceId").asText())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("username", target.getUsername(), "password", PASSWORD,
                        "confirmDeviceSwitch", confirm)));
        if (deviceToken != null) request.header("X-Device-Token", deviceToken);
        return mockMvc.perform(request).andReturn();
    }

    private void expectIdentity(JsonNode session, AppUser expected) throws Exception {
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + session.get("token").asText()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.userId").value(expected.getUserId()))
                .andExpect(jsonPath("$.passwordHash").doesNotExist()).andExpect(jsonPath("$.pinHash").doesNotExist());
    }

    @Test
    void confirmedSwitchRevokesOnlyTheReplacedPhone() throws Exception {
        JsonNode firstPhone = login(firstUser);
        JsonNode secondPhone = login(firstUser);
        var result = attemptSwitch(secondUser, firstPhone, true, firstPhone.get("deviceToken").asText());
        assertEquals(200, result.getResponse().getStatus());
        JsonNode replacement = objectMapper.readTree(result.getResponse().getContentAsString());
        assertNotEquals(firstPhone.get("deviceToken").asText(), replacement.get("deviceToken").asText());
        assertEquals(2L, bindings.findByDeviceId(firstPhone.get("deviceId").asText()).orElseThrow().getBindingVersion());
        assertEquals(1, users.findById(firstUser.getUserId()).orElseThrow().getTokenVersion());
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + firstPhone.get("token").asText()))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("SESSION_REAUTH_REQUIRED"));
        expectIdentity(secondPhone, firstUser);
        expectIdentity(replacement, secondUser);
    }

    @Test
    void guessedIdentifierAndMissingOrWrongDeviceProofCannotTransferOwnership() throws Exception {
        JsonNode original = login(firstUser);
        for (String invalidProof : new String[] { null, "f".repeat(64), "malformed" }) {
            var result = attemptSwitch(secondUser, original, true, invalidProof);
            assertEquals(401, result.getResponse().getStatus());
            JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
            assertEquals("INVALID_DEVICE_CREDENTIALS", response.get("code").asText());
            assertFalse(response.has("token"));
            assertFalse(response.toString().contains(firstUser.getUsername()));
        }
        expectIdentity(original, firstUser);
        assertEquals(1L, bindings.findByDeviceId(original.get("deviceId").asText()).orElseThrow().getBindingVersion());
    }

    @Test
    void replayedConfirmationCannotRotateTheNewOwnersSession() throws Exception {
        JsonNode original = login(firstUser);
        String proof = original.get("deviceToken").asText();
        var firstResult = attemptSwitch(secondUser, original, true, proof);
        assertEquals(200, firstResult.getResponse().getStatus());
        assertEquals(401, attemptSwitch(secondUser, original, true, proof).getResponse().getStatus());
        expectIdentity(objectMapper.readTree(firstResult.getResponse().getContentAsString()), secondUser);
    }

    @Test
    void sameOwnerPasswordRecoveryRotatesOnlyItsBinding() throws Exception {
        JsonNode original = login(firstUser);
        JsonNode anotherPhone = login(firstUser);
        var recovered = attemptSwitch(firstUser, original, false, null);
        assertEquals(200, recovered.getResponse().getStatus());
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + original.get("token").asText()))
                .andExpect(status().isUnauthorized());
        expectIdentity(anotherPhone, firstUser);
        expectIdentity(objectMapper.readTree(recovered.getResponse().getContentAsString()), firstUser);
    }

    @Test
    void newAccountChangesPasswordBeforeTakingTheBinding() throws Exception {
        JsonNode original = login(firstUser);
        secondUser.setMustChangePassword(true);
        secondUser.setPinHash(null);
        users.saveAndFlush(secondUser);
        var provisionalResult = attemptSwitch(secondUser, original, true, original.get("deviceToken").asText());
        assertEquals(200, provisionalResult.getResponse().getStatus());
        JsonNode provisional = objectMapper.readTree(provisionalResult.getResponse().getContentAsString());
        assertTrue(provisional.get("mustChangePassword").asBoolean());
        assertTrue(provisional.get("deviceId") == null || provisional.get("deviceId").isNull());
        assertEquals(firstUser.getUserId(), bindings.findByDeviceId(original.get("deviceId").asText()).orElseThrow().getUserId());
        mockMvc.perform(get("/api/v1/vehicles").header("Authorization", "Bearer " + provisional.get("token").asText()))
                .andExpect(status().isForbidden());
        expectIdentity(provisional, secondUser);
        mockMvc.perform(post("/api/v1/auth/password-change")
                        .header("Authorization", "Bearer " + provisional.get("token").asText())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("oldPassword", PASSWORD, "newPassword", "permanent-test-password"))))
                .andExpect(status().isOk());
        expectIdentity(original, firstUser);
        mockMvc.perform(post("/api/v1/auth/mobile-login")
                        .header("X-Device-Id", original.get("deviceId").asText())
                        .header("X-Device-Token", original.get("deviceToken").asText())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("username", secondUser.getUsername(),
                                "password", "permanent-test-password"))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DEVICE_SWITCH_CONFIRMATION_REQUIRED"));
        var switchedResult = mockMvc.perform(post("/api/v1/auth/mobile-login")
                        .header("X-Device-Id", original.get("deviceId").asText())
                        .header("X-Device-Token", original.get("deviceToken").asText())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("username", secondUser.getUsername(),
                                "password", "permanent-test-password", "confirmDeviceSwitch", true))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.hasPinSet").value(false)).andReturn();
        JsonNode switched = objectMapper.readTree(switchedResult.getResponse().getContentAsString());
        expectIdentity(switched, secondUser);
        var pinSetup = mockMvc.perform(post("/api/v1/auth/mobile-setup-pin")
                        .header("Authorization", "Bearer " + switched.get("token").asText())
                        .header("X-Device-Id", switched.get("deviceId").asText())
                        .header("X-Device-Token", switched.get("deviceToken").asText())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"pin\":\"2468\"}"))
                .andExpect(status().isOk()).andReturn();
        JsonNode replacement = objectMapper.readTree(pinSetup.getResponse().getContentAsString());
        expectIdentity(replacement, secondUser);
        mockMvc.perform(post("/api/v1/auth/mobile-pin-login").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("username", secondUser.getUsername(), "pin", "2468",
                                "deviceId", switched.get("deviceId").asText(), "deviceToken", switched.get("deviceToken").asText()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.userId").value(secondUser.getUserId()));
    }

    @Test
    void unscopedStaffTokensFailClosed() throws Exception {
        String legacy = JwtTokenProvider.generateToken(firstUser.getUserId(), firstUser.getRole().name(), 1);
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + legacy))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void pinUnlockCannotUseThePreviousOwnersDeviceCredentials() throws Exception {
        JsonNode original = login(firstUser);
        assertEquals(200, attemptSwitch(secondUser, original, true, original.get("deviceToken").asText()).getResponse().getStatus());
        mockMvc.perform(post("/api/v1/auth/mobile-pin-login").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("username", firstUser.getUsername(), "pin", "1234",
                                "deviceId", original.get("deviceId").asText(), "deviceToken", original.get("deviceToken").asText()))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void wrongPasswordAndMalformedRequestDoNotChangeBinding() throws Exception {
        JsonNode original = login(firstUser);
        mockMvc.perform(post("/api/v1/auth/mobile-login")
                        .header("X-Device-Id", original.get("deviceId").asText())
                        .header("X-Device-Token", original.get("deviceToken").asText())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("username", secondUser.getUsername(),
                                "password", "incorrect", "confirmDeviceSwitch", true))))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/mobile-login").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        expectIdentity(original, firstUser);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void competingConfirmedSwitchesProduceOneOwnerAndOneUsableSession() throws Exception {
        JsonNode original = login(firstUser);
        AppUser thirdUser = createUser(UserRole.DISPATCH_STAFF);
        var results = race(
                () -> sessions.loginWithPassword(secondUser.getUserId(), PASSWORD, original.get("deviceId").asText(),
                        original.get("deviceToken").asText(), true),
                () -> sessions.loginWithPassword(thirdUser.getUserId(), PASSWORD, original.get("deviceId").asText(),
                        original.get("deviceToken").asText(), true));
        assertEquals(1, results.stream().filter(com.tnl.logistics.dto.LoginResponse.class::isInstance).count());
        assertEquals(1, results.stream().filter(AuthSecurityService.AuthSecurityException.class::isInstance).count());
        var winner = results.stream().filter(com.tnl.logistics.dto.LoginResponse.class::isInstance)
                .map(com.tnl.logistics.dto.LoginResponse.class::cast).findFirst().orElseThrow();
        assertEquals(winner.getUserId(), bindings.findByDeviceId(original.get("deviceId").asText()).orElseThrow().getUserId());
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + winner.getToken()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.userId").value(winner.getUserId()));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void firstBindingRaceNeverProducesTwoOwners() throws Exception {
        String deviceId = UUID.randomUUID().toString();
        var results = race(
                () -> sessions.loginWithPassword(firstUser.getUserId(), PASSWORD, deviceId, null, false),
                () -> sessions.loginWithPassword(secondUser.getUserId(), PASSWORD, deviceId, null, false));
        assertEquals(1, results.stream().filter(com.tnl.logistics.dto.LoginResponse.class::isInstance).count());
        assertEquals(1, results.stream().filter(Throwable.class::isInstance).count());
        assertNotNull(bindings.findByDeviceId(deviceId).orElseThrow().getUserId());
    }

    private List<Object> race(Callable<Object> first, Callable<Object> second) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Object>> futures = new ArrayList<>();
            for (Callable<Object> operation : List.of(first, second)) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    if (!start.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Race did not start");
                    try { return operation.call(); } catch (Throwable failure) { return failure; }
                }));
            }
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();
            return List.of(futures.get(0).get(15, TimeUnit.SECONDS), futures.get(1).get(15, TimeUnit.SECONDS));
        } finally {
            executor.shutdownNow();
        }
    }
}
