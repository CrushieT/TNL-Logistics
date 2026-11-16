package com.tnl.logistics.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.UpdateSystemSettingRequest;
import com.tnl.logistics.service.SystemSettingService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration test for MobileVersionEnforcementFilter.
 * Verifies that outdated mobile requests are blocked with HTTP 426 before reaching controllers,
 * while compliant mobile clients, web clients, and public endpoints pass through cleanly.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class MobileVersionEnforcementFilterTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SystemSettingService systemSettingService;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setupDefaultPolicy() {
        UpdateSystemSettingRequest req = createSettingsRequest(1, 1, true);
        systemSettingService.updateSettings(req, "TEST_ADMIN");
    }

    @AfterEach
    void resetPolicy() {
        UpdateSystemSettingRequest req = createSettingsRequest(1, 1, true);
        systemSettingService.updateSettings(req, "TEST_ADMIN");
    }

    @Test
    @WithMockUser(username = "courier", roles = {"COURIER_STAFF"})
    void outdatedMobileRequest_returns426UpgradeRequired() throws Exception {
        // Configure min version = 2, forceUpdate = true
        UpdateSystemSettingRequest req = createSettingsRequest(2, 2, true);
        systemSettingService.updateSettings(req, "TEST_ADMIN");

        mockMvc.perform(get("/api/v1/shipments")
                        .header("X-App-Version-Code", "1")
                        .header("X-App-Platform", "android")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUpgradeRequired())
                .andExpect(header().string("X-Min-App-Version-Code", "2"))
                .andExpect(jsonPath("$.status").value(426))
                .andExpect(jsonPath("$.error").value("Upgrade Required"))
                .andExpect(jsonPath("$.minVersionCode").value(2))
                .andExpect(jsonPath("$.clientVersionCode").value(1))
                .andExpect(jsonPath("$.apkDownloadUrl").value("https://example.com/tc-ct-staff.apk"));
    }

    @Test
    @WithMockUser(username = "staff", roles = {"RECEIVING_STAFF"})
    void compliantMobileRequest_passesThroughFilter() throws Exception {
        // Configure min version = 2
        UpdateSystemSettingRequest req = createSettingsRequest(2, 2, true);
        systemSettingService.updateSettings(req, "TEST_ADMIN");

        // Client on version 2 (matches min) should pass through
        mockMvc.perform(get("/api/v1/shipments")
                        .header("X-App-Version-Code", "2")
                        .header("X-App-Platform", "android")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "staff", roles = {"RECEIVING_STAFF"})
    void futureMobileRequest_passesThroughFilter() throws Exception {
        // Configure min version = 2
        UpdateSystemSettingRequest req = createSettingsRequest(2, 3, true);
        systemSettingService.updateSettings(req, "TEST_ADMIN");

        // Client on version 3 (exceeds min) should pass through
        mockMvc.perform(get("/api/v1/shipments")
                        .header("X-App-Version-Code", "3")
                        .header("X-App-Platform", "android")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    void mobileVersionEndpoint_bypassesFilterEvenWhenOutdated() throws Exception {
        // Configure min version = 2
        UpdateSystemSettingRequest req = createSettingsRequest(2, 2, true);
        systemSettingService.updateSettings(req, "TEST_ADMIN");

        // Even with client version = 1, mobile-version check must return 200 OK
        mockMvc.perform(get("/api/v1/settings/mobile-version")
                        .header("X-App-Version-Code", "1")
                        .header("X-App-Platform", "android"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.minSupportedVersionCode").value(2))
                .andExpect(jsonPath("$.latestVersionCode").value(2));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void webRequest_withoutVersionHeader_bypassesFilter() throws Exception {
        // Configure min version = 2
        UpdateSystemSettingRequest req = createSettingsRequest(2, 2, true);
        systemSettingService.updateSettings(req, "TEST_ADMIN");

        // Web request (no X-App-Version-Code) should proceed normally
        mockMvc.perform(get("/api/v1/settings")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "staff", roles = {"RECEIVING_STAFF"})
    void forceUpdateDisabled_allowsOutdatedClient() throws Exception {
        // Configure min version = 2, but forceUpdate = FALSE
        UpdateSystemSettingRequest req = createSettingsRequest(2, 3, false);
        systemSettingService.updateSettings(req, "TEST_ADMIN");

        // Outdated client should be permitted because forceUpdate is false
        mockMvc.perform(get("/api/v1/shipments")
                        .header("X-App-Version-Code", "1")
                        .header("X-App-Platform", "android")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "courier", roles = {"COURIER_STAFF"})
    void malformedVersionCode_returns400BadRequest() throws Exception {
        mockMvc.perform(get("/api/v1/shipments")
                        .header("X-App-Version-Code", "not-a-number")
                        .header("X-App-Platform", "android")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"));
    }

    private UpdateSystemSettingRequest createSettingsRequest(int minCode, int latestCode, boolean forceUpdate) {
        UpdateSystemSettingRequest req = new UpdateSystemSettingRequest(
                "TNL Logistics",
                "Manila Central Hub",
                "09175550000",
                "billing@tnllogistics.ph",
                DayOfWeek.THURSDAY,
                5000,
                new BigDecimal("100.00")
        );
        req.setSoaBankName("Test Bank");
        req.setSoaAccountName("TNL Test");
        req.setSoaAccountNumber("1234567890");
        req.setMinMobileVersionCode(minCode);
        req.setLatestMobileVersionCode(latestCode);
        req.setLatestMobileVersionName("1.0." + latestCode);
        req.setMobileApkDownloadUrl("https://example.com/tc-ct-staff.apk");
        req.setMobileForceUpdate(forceUpdate);
        req.setMobileUpdateReleaseNotes("Release notes test");
        return req;
    }
}
