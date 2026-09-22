package com.tnl.logistics.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class OfflineSyncRequestGuardTest {

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
}
