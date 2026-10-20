package com.tnl.logistics.exception;

import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.service.AuthSecurityService;
import org.apache.catalina.connector.ClientAbortException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(GlobalExceptionHandlerTest.ExceptionTriggerController.class)
public class GlobalExceptionHandlerTest {

    private static final String TEST_USER_ID = "USR-ADMIN-001";

    @Autowired
    private MockMvc mockMvc;

    @SpyBean
    private AppUserRepository appUserRepository;

    @SpyBean
    private AuthSecurityService authSecurityService;

    private UsernamePasswordAuthenticationToken createJwtAuthentication() {
        return new UsernamePasswordAuthenticationToken(
                TEST_USER_ID,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    @RestController
    @RequestMapping("/api/v1/test-exception")
    static class ExceptionTriggerController {

        @GetMapping("/data-integrity")
        public void triggerDataIntegrity() {
            throw new DataIntegrityViolationException("Duplicate entry 'VH-001' for key 'vehicles.PRIMARY'");
        }

        @GetMapping("/runtime-error")
        public void triggerRuntime() {
            throw new RuntimeException("Sensitive internal database connection string: jdbc:mysql://internal-host:3306");
        }

        @GetMapping("/access-denied")
        public void triggerAccessDenied() {
            throw new AccessDeniedException("Access is denied per custom rule");
        }

        @GetMapping("/missing-param")
        public String triggerMissingParam(@RequestParam("requiredField") String requiredField) {
            return requiredField;
        }

        @GetMapping("/type-mismatch")
        public Integer triggerTypeMismatch(@RequestParam("numericCode") Integer numericCode) {
            return numericCode;
        }

        @PostMapping("/body-parse")
        public String triggerBodyParse(@RequestBody Map<String, Object> body) {
            return "OK";
        }

        @GetMapping("/client-abort")
        public void triggerClientAbort() throws Exception {
            throw new AsyncRequestNotUsableException("Response not usable after response errors.");
        }

        @GetMapping("/client-abort-async")
        public void triggerAsyncClientAbort() throws Exception {
            throw new AsyncRequestNotUsableException("Response not usable after response errors.");
        }

        @GetMapping("/client-abort-catalina")
        public void triggerCatalinaClientAbort() throws Exception {
            throw new ClientAbortException("Connection reset by peer");
        }
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testDataIntegrityViolationReturnsConflict409() throws Exception {
        mockMvc.perform(get("/api/v1/test-exception/data-integrity"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.message", containsString("Database constraint violation occurred")))
                .andExpect(jsonPath("$.message", not(containsString("vehicles.PRIMARY"))));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testUnhandledExceptionReturnsSanitizedInternalServerError500() throws Exception {
        mockMvc.perform(get("/api/v1/test-exception/runtime-error"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.error").value("Internal Server Error"))
                .andExpect(jsonPath("$.message").value("An unexpected internal server error occurred. Please contact system administrator."))
                .andExpect(jsonPath("$.message", not(containsString("Sensitive internal database connection string"))));
    }

    @Test
    void testUnhandledExceptionWithJwtPrincipalInvokesAuditLookupAndReturnsSanitized500() throws Exception {
        clearInvocations(appUserRepository, authSecurityService);
        mockMvc.perform(get("/api/v1/test-exception/runtime-error")
                        .with(authentication(createJwtAuthentication())))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.error").value("Internal Server Error"))
                .andExpect(jsonPath("$.message").value("An unexpected internal server error occurred. Please contact system administrator."))
                .andExpect(jsonPath("$.message", not(containsString("Sensitive internal database connection string"))));

        verify(appUserRepository).findById(TEST_USER_ID);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testMalformedJsonPayloadReturnsBadRequest400() throws Exception {
        mockMvc.perform(post("/api/v1/test-exception/body-parse")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"unclosed\": \"json string without closing brace"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Malformed request body or invalid data format."));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testMissingServletRequestParameterReturnsBadRequest400() throws Exception {
        mockMvc.perform(get("/api/v1/test-exception/missing-param"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Required parameter 'requiredField' is missing."));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testMethodArgumentTypeMismatchReturnsBadRequest400() throws Exception {
        mockMvc.perform(get("/api/v1/test-exception/type-mismatch")
                        .param("numericCode", "not-a-number"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Invalid format for parameter 'numericCode'."));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testAccessDeniedExceptionPreservedAsForbidden403() throws Exception {
        mockMvc.perform(get("/api/v1/test-exception/access-denied"))
                .andExpect(status().isForbidden());
    }

    @Test
    void testAsyncRequestNotUsableExceptionAbsorbedWithoutDatabaseOrAuditWork() throws Exception {
        clearInvocations(appUserRepository, authSecurityService);
        mockMvc.perform(get("/api/v1/test-exception/client-abort-async")
                        .with(authentication(createJwtAuthentication())))
                .andExpect(status().isOk());

        verifyNoInteractions(appUserRepository);
        verifyNoInteractions(authSecurityService);
    }

    @Test
    void testClientAbortExceptionAbsorbedWithoutDatabaseOrAuditWork() throws Exception {
        clearInvocations(appUserRepository, authSecurityService);
        mockMvc.perform(get("/api/v1/test-exception/client-abort-catalina")
                        .with(authentication(createJwtAuthentication())))
                .andExpect(status().isOk());

        verifyNoInteractions(appUserRepository);
        verifyNoInteractions(authSecurityService);
    }
}
