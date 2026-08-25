package com.tnl.logistics.controller;

import com.tnl.logistics.service.SseService;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/events")
public class SseController {

    private final SseService sseService;

    public SseController(SseService sseService) {
        this.sseService = sseService;
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("hasAnyRole('OFFICE_STAFF', 'FIELD_STAFF', 'ADMIN')")
    public SseEmitter streamEvents(Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "anonymous";
        return sseService.registerClient(username);
    }
}
