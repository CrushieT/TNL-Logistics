package com.tnl.logistics.controller;

import com.tnl.logistics.service.SseService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
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
    public SseEmitter streamEvents(Authentication authentication, HttpServletRequest request) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new AccessDeniedException("Authenticated user context is required");
        }

        Long authDeadlineMillis = (Long) request.getAttribute("sseAuthDeadlineMillis");
        Integer tokenVersion = (Integer) request.getAttribute("sseTokenVersion");

        if (authDeadlineMillis == null || tokenVersion == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing verified SSE session authorization attributes.");
        }

        if (System.currentTimeMillis() >= authDeadlineMillis) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session authorization deadline has elapsed.");
        }

        return sseService.registerClient(authentication.getName(), tokenVersion, authDeadlineMillis);
    }
}
