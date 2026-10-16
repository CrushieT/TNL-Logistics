package com.tnl.logistics.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.FirstBootAdminRequest;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.SystemSetting;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.SystemSettingRepository;
import com.tnl.logistics.repository.ClientRepository;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.dto.CompanyBrandingDto;
import com.tnl.logistics.service.SystemSettingService;
import com.tnl.logistics.service.SseService;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Integration test verifying first-boot admin registration, company branding persistence,
 * status detection, input validations, single-admin ID assignment, and conflict rejection.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:mysql://${MYSQLHOST:${MYSQL_HOST:localhost}}:${MYSQLPORT:${MYSQL_PORT:3306}}/tnl_first_boot_test?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC",
        "app.seed.admin=false", "app.seed.sample-data=false", "app.seed.mobile-pins=false",
        "app.seed.workflow-fixtures=false"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class FirstBootIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository appUserRepository;

    @SpyBean
    private SystemSettingRepository systemSettingRepository;

    @SpyBean
    private SseService sseService;

    @Autowired
    private SystemSettingService systemSettingService;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @BeforeEach
    void initializeIsolatedFirstBoot() {
        reset(systemSettingRepository, sseService);
        appUserRepository.deleteById("USR-ADMIN");
        assertFalse(appUserRepository.existsByRole(UserRole.ADMIN));
        SystemSetting baseline = new SystemSetting(SystemSetting.DEFAULT_SETTING_ID, "Before Setup", "Original Address",
                "09175550000", "before@example.test", DayOfWeek.MONDAY, 3500, "PKG", "JOB");
        baseline.setRatePerKilo(new BigDecimal("12.00"));
        systemSettingRepository.saveAndFlush(baseline);
        systemSettingService.refreshCachedSettings();
        clearInvocations(systemSettingRepository, sseService);
    }

    @AfterEach
    void removeIsolatedAdministrator() {
        reset(systemSettingRepository, sseService);
        clientRepository.deleteById("CL-FIRST-BOOT");
        appUserRepository.deleteById("USR-ADMIN");
    }

    private FirstBootAdminRequest withFinancialSettings(FirstBootAdminRequest request) {
        request.setSoaBankName("  Example Settlement Bank  ");
        request.setSoaAccountName("  Example Freight Account  ");
        request.setSoaAccountNumber("001234567890");
        request.setRatePerKilo(new BigDecimal("37.25"));
        return request;
    }

    @Test
    void testFirstBootStatusAndRegistrationLifecycle() throws Exception {
        // 1. Probe status: should indicate first-boot is needed
        mockMvc.perform(get("/api/v1/auth/first-boot-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isFirstBoot").value(true));

        // 2. Validation check: Passwords do not match
        FirstBootAdminRequest mismatchReq = new FirstBootAdminRequest(
                "Maria Santos", "admin", "AdminPass123!", "MismatchPass123!"
        );
        withFinancialSettings(mismatchReq);
        mockMvc.perform(post("/api/v1/auth/first-boot-admin")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(mismatchReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Passwords do not match."));

        // 3. Validation check: Password too short (< 8 characters)
        FirstBootAdminRequest shortPassReq = new FirstBootAdminRequest(
                "Maria Santos", "admin", "short", "short"
        );
        withFinancialSettings(shortPassReq);
        mockMvc.perform(post("/api/v1/auth/first-boot-admin")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(shortPassReq)))
                .andExpect(status().isBadRequest());

        // 4. Validation check: Missing full name
        FirstBootAdminRequest missingNameReq = new FirstBootAdminRequest(
                "", "admin", "AdminPass123!", "AdminPass123!"
        );
        withFinancialSettings(missingNameReq);
        mockMvc.perform(post("/api/v1/auth/first-boot-admin")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(missingNameReq)))
                .andExpect(status().isBadRequest());

        // 5. Successful registration of primary administrator and company branding
        FirstBootAdminRequest validReq = new FirstBootAdminRequest(
                "Maria Santos",
                "primaryadmin",
                "AdminPass123!",
                "AdminPass123!",
                "TNL Logistics Express",
                "Baguio City Hub",
                "0918-111-2222",
                "accounts@tnllogistics.ph"
        );
        withFinancialSettings(validReq);
        doAnswer(invocation -> {
            assertInstanceOf(CompanyBrandingDto.class, invocation.getArgument(1));
            String payload = objectMapper.writeValueAsString(invocation.getArgument(1));
            assertFalse(payload.contains("soaBankName"));
            assertFalse(payload.contains("soaAccountName"));
            assertFalse(payload.contains("soaAccountNumber"));
            assertFalse(payload.contains("001234567890"));
            TransactionTemplate independentRead = new TransactionTemplate(transactionManager);
            independentRead.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            independentRead.executeWithoutResult(transaction -> {
                assertTrue(appUserRepository.existsById("USR-ADMIN"));
                assertEquals("001234567890", systemSettingRepository.findById(1).orElseThrow().getSoaAccountNumber());
            });
            assertEquals("Example Settlement Bank", systemSettingService.getSettings().getSoaBankName());
            return null;
        }).when(sseService).broadcastEvent(eq("SETTINGS_UPDATED"), any());
        String responseBody = mockMvc.perform(post("/api/v1/auth/first-boot-admin")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(validReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.userId").value("USR-ADMIN"))
                .andExpect(jsonPath("$.username").value("primaryadmin"))
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.mustChangePassword").value(false))
                .andExpect(jsonPath("$.soaBankName").doesNotExist())
                .andExpect(jsonPath("$.soaAccountName").doesNotExist())
                .andExpect(jsonPath("$.soaAccountNumber").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        String token = objectMapper.readTree(responseBody).get("token").asText();
        mockMvc.perform(get("/api/v1/settings").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.soaBankName").value("Example Settlement Bank"))
                .andExpect(jsonPath("$.soaAccountName").value("Example Freight Account"))
                .andExpect(jsonPath("$.soaAccountNumber").value("001234567890"))
                .andExpect(jsonPath("$.ratePerKilo").value(37.25));
        mockMvc.perform(get("/api/v1/settings/branding").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.soaBankName").doesNotExist())
                .andExpect(jsonPath("$.soaAccountName").doesNotExist())
                .andExpect(jsonPath("$.soaAccountNumber").doesNotExist());
        clientRepository.saveAndFlush(new Client("CL-FIRST-BOOT", "Example Consignee", "Example Street", "09175550000", null));
        mockMvc.perform(get("/api/v1/shipments/calculation-settings").param("clientId", "CL-FIRST-BOOT")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ratePerKilo").value(37.25));
        mockMvc.perform(get("/api/v1/soa/preview").param("clientId", "CL-FIRST-BOOT")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.soaBankName").value("Example Settlement Bank"))
                .andExpect(jsonPath("$.soaAccountName").value("Example Freight Account"))
                .andExpect(jsonPath("$.soaAccountNumber").value("001234567890"));
        verify(sseService, times(1)).broadcastEvent(eq("SETTINGS_UPDATED"), any(CompanyBrandingDto.class));

        // Verify entity persisted in database
        AppUser persistedAdmin = appUserRepository.findById("USR-ADMIN").orElseThrow();
        assertEquals("primaryadmin", persistedAdmin.getUsername());
        assertEquals("Maria Santos", persistedAdmin.getFullName());
        assertEquals(UserRole.ADMIN, persistedAdmin.getRole());
        assertFalse(persistedAdmin.getMustChangePassword());
        assertTrue(persistedAdmin.getActive());

        // Verify company branding persisted in system_setting
        SystemSetting savedSetting = systemSettingRepository.findById(SystemSetting.DEFAULT_SETTING_ID).orElseThrow();
        assertEquals("TNL Logistics Express", savedSetting.getCompanyName());
        assertEquals("Baguio City Hub", savedSetting.getCompanyAddress());
        assertEquals("0918-111-2222", savedSetting.getCompanyContact());
        assertEquals("accounts@tnllogistics.ph", savedSetting.getBillingEmail());
        assertEquals("USR-ADMIN", savedSetting.getUpdatedBy());
        assertEquals("Example Settlement Bank", savedSetting.getSoaBankName());
        assertEquals("Example Freight Account", savedSetting.getSoaAccountName());
        assertEquals("001234567890", savedSetting.getSoaAccountNumber());
        assertEquals(0, new BigDecimal("37.25").compareTo(savedSetting.getRatePerKilo()));
        assertEquals(DayOfWeek.MONDAY, savedSetting.getCollectionDay());
        assertEquals(3500, savedSetting.getVolumetricDivisor());
        assertEquals("PKG", savedSetting.getTrackingPrefix());
        assertEquals("JOB", savedSetting.getShipmentPrefix());

        // 6. Probe status again: should indicate first-boot is no longer needed
        mockMvc.perform(get("/api/v1/auth/first-boot-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isFirstBoot").value(false));

        // 7. Duplicate initialization attempt must return 409 Conflict
        mockMvc.perform(post("/api/v1/auth/first-boot-admin")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(validReq)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("First boot setup has already been completed."));
    }

    static Stream<Arguments> invalidFinancialFields() {
        return Stream.of(
                Arguments.of("soaBankName", null), Arguments.of("soaBankName", ""),
                Arguments.of("soaBankName", "B".repeat(101)), Arguments.of("soaBankName", "Bank\nName"),
                Arguments.of("soaBankName", "Bank\u0085Name"), Arguments.of("soaBankName", "Bank\u2028Name"),
                Arguments.of("soaAccountName", null), Arguments.of("soaAccountName", "   "),
                Arguments.of("soaAccountName", "A".repeat(151)), Arguments.of("soaAccountName", "Account\tName"),
                Arguments.of("soaAccountNumber", null), Arguments.of("soaAccountNumber", ""),
                Arguments.of("soaAccountNumber", "12345"), Arguments.of("soaAccountNumber", "1".repeat(21)),
                Arguments.of("soaAccountNumber", "12345A"), Arguments.of("soaAccountNumber", "001-234"),
                Arguments.of("ratePerKilo", null), Arguments.of("ratePerKilo", ""),
                Arguments.of("ratePerKilo", "0"), Arguments.of("ratePerKilo", "-1"),
                Arguments.of("ratePerKilo", "0.001"), Arguments.of("ratePerKilo", "10000000000"),
                Arguments.of("ratePerKilo", "12.345"), Arguments.of("ratePerKilo", "12junk"));
    }

    @ParameterizedTest
    @MethodSource("invalidFinancialFields")
    void rejectsMissingOrInvalidFinancialFields(String field, String value) throws Exception {
        var payload = objectMapper.valueToTree(withFinancialSettings(new FirstBootAdminRequest(
                "Setup Admin", "setupadmin", "SetupPass123!", "SetupPass123!")));
        if (value == null) ((com.fasterxml.jackson.databind.node.ObjectNode) payload).remove(field);
        else ((com.fasterxml.jackson.databind.node.ObjectNode) payload).put(field, value);
        mockMvc.perform(post("/api/v1/auth/first-boot-admin").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload))).andExpect(status().isBadRequest());
        assertFalse(appUserRepository.existsByRole(UserRole.ADMIN));
        assertEquals("Before Setup", systemSettingRepository.findById(1).orElseThrow().getCompanyName());
        verify(sseService, never()).broadcastEvent(anyString(), any());
    }

    @Test
    void rollsBackAdministratorAndSettingsWhenPersistenceFails() throws Exception {
        doAnswer(invocation -> {
            systemSettingRepository.saveAndFlush(invocation.getArgument(0));
            throw new DataIntegrityViolationException("Simulated persistence failure");
        }).when(systemSettingRepository).save(any(SystemSetting.class));
        FirstBootAdminRequest request = withFinancialSettings(new FirstBootAdminRequest(
                "Setup Admin", "setupadmin", "SetupPass123!", "SetupPass123!"));
        mockMvc.perform(post("/api/v1/auth/first-boot-admin").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request))).andExpect(status().isConflict());
        assertFalse(appUserRepository.existsByRole(UserRole.ADMIN));
        SystemSetting persisted = systemSettingRepository.findById(1).orElseThrow();
        assertEquals("Before Setup", persisted.getCompanyName());
        assertNull(persisted.getSoaBankName());
        assertNull(persisted.getSoaAccountName());
        assertNull(persisted.getSoaAccountNumber());
        assertEquals(0, new BigDecimal("12.00").compareTo(persisted.getRatePerKilo()));
        assertEquals("Before Setup", systemSettingService.getSettings().getCompanyName());
        assertNull(systemSettingService.getSettings().getSoaBankName());
        verify(sseService, never()).broadcastEvent(anyString(), any());
    }

    @Test
    void testFirstBootAdminRequestDefaultBranding() {
        FirstBootAdminRequest defaultBrandingReq = new FirstBootAdminRequest(
                "Default Admin", "adminuser", "AdminPass123!", "AdminPass123!"
        );

        assertEquals("TC & CT Integrated Logistics", defaultBrandingReq.getCompanyName());
        assertEquals("Labo, Camarines Norte", defaultBrandingReq.getCompanyAddress());
        assertEquals("0917-555-0000", defaultBrandingReq.getCompanyContact());
        assertEquals("billing@tnllogistics.ph", defaultBrandingReq.getBillingEmail());
        assertNull(defaultBrandingReq.getSoaBankName());
        assertNull(defaultBrandingReq.getSoaAccountName());
        assertNull(defaultBrandingReq.getSoaAccountNumber());
        assertNull(defaultBrandingReq.getRatePerKilo());
    }
}
