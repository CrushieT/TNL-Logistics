package com.tnl.logistics.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class OfflineSyncRequestGuardTest {

    @BeforeEach
    void authenticateGuardRequests() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("USR-GUARD-TEST", null, java.util.List.of()));
    }

    @AfterEach
    void clearGuardAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void ac01RejectsAnonymousOfflineSyncBeforeProcessing() throws Exception {
        SecurityContextHolder.clearContext();
        MockHttpServletResponse response = sendJson(new OfflineSyncRequestGuard(), "192.0.2.1");
        assertEquals(401, response.getStatus());
    }

    @Test
    void rejectsUnknownLengthBodiesThatExceedTheStreamingLimit() throws Exception {
        byte[] oversizedBody = new byte[(64 * 1024) + 1];
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/tracking-events/offline-sync") {
            @Override
            public long getContentLengthLong() {
                return -1;
            }
        };
        request.setContentType("application/json");
        request.setContent(oversizedBody);
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chainInvoked = new AtomicBoolean(false);

        new OfflineSyncRequestGuard().doFilter(request, response, (ignoredRequest, ignoredResponse) -> chainInvoked.set(true));

        assertEquals(413, response.getStatus());
        assertFalse(chainInvoked.get());
    }

    @Test
    void rejectsContentTypesThatOnlyShareTheJsonPrefix() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/tracking-events/offline-sync");
        request.setContentType("application/json-malicious");
        request.setContent("{}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chainInvoked = new AtomicBoolean(false);

        new OfflineSyncRequestGuard().doFilter(request, response, (ignoredRequest, ignoredResponse) -> chainInvoked.set(true));

        assertEquals(415, response.getStatus());
        assertFalse(chainInvoked.get());
    }

    @Test
    void acceptsJsonWithAValidCharsetParameter() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/tracking-events/offline-sync");
        request.setContentType("application/json; charset=UTF-8");
        request.setContent("{}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chainInvoked = new AtomicBoolean(false);

        new OfflineSyncRequestGuard().doFilter(request, response, (ignoredRequest, ignoredResponse) -> chainInvoked.set(true));

        assertEquals(200, response.getStatus());
        assertEquals(true, chainInvoked.get());
    }

    @Test
    void ac13CapsTrackedSourceIpKeysAndReturnsRetryAfter() throws Exception {
        OfflineSyncRequestGuard guard = new OfflineSyncRequestGuard();
        for (int index = 0; index < 2_001; index++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/tracking-events/offline-sync");
            request.setRemoteAddr("192.0." + (index / 256) + "." + (index % 256));
            request.setContentType("application/json");
            request.setContent("{}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            MockHttpServletResponse response = new MockHttpServletResponse();
            guard.doFilter(request, response, (ignoredRequest, ignoredResponse) -> {});
            if (index == 2_000) {
                assertEquals(429, response.getStatus());
                assertEquals("60", response.getHeader("Retry-After"));
            }
        }
    }

    @Test
    void ac13EnforcesIndependentUserAndIpLimits() throws Exception {
        OfflineSyncRequestGuard userGuard = new OfflineSyncRequestGuard();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("USR-LIMIT", null, java.util.List.of()));
        try {
            for (int index = 0; index < 21; index++) {
                MockHttpServletResponse response = sendJson(userGuard, "192.0.2.10");
                assertEquals(index == 20 ? 429 : 200, response.getStatus());
                if (index == 20) assertEquals(true, Integer.parseInt(response.getHeader("Retry-After")) > 0);
            }
        } finally {
            SecurityContextHolder.clearContext();
        }

        OfflineSyncRequestGuard ipGuard = new OfflineSyncRequestGuard();
        for (int index = 0; index < 101; index++) {
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("USR-IP-" + index, null, java.util.List.of()));
            MockHttpServletResponse response = sendJson(ipGuard, "192.0.2.11");
            assertEquals(index == 100 ? 429 : 200, response.getStatus());
        }
    }

    private MockHttpServletResponse sendJson(OfflineSyncRequestGuard guard, String ipAddress) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/tracking-events/offline-sync");
        request.setRemoteAddr(ipAddress);
        request.setContentType("application/json");
        request.setContent("{}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();
        guard.doFilter(request, response, (ignoredRequest, ignoredResponse) -> {});
        return response;
    }
}
