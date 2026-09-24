package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.service.TrackingService;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/v1/tracking-events")
public class TrackingEventController {

    private final TrackingService trackingService;
    private final ObjectMapper objectMapper;
    private final Validator validator;

    public TrackingEventController(TrackingService trackingService, ObjectMapper objectMapper, Validator validator) {
        this.trackingService = trackingService;
        this.objectMapper = objectMapper;
        this.validator = validator;
    }

    @GetMapping("/scan-context/{trackingId}")
    @PreAuthorize("hasRole('FIELD_STAFF')")
    public ResponseEntity<TrackingScanContextResponse> getScanContext(
            @PathVariable String trackingId,
            Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new AccessDeniedException("Authenticated user context is required");
        }
        TrackingScanContextResponse response = trackingService.getScanContext(trackingId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/mine")
    @PreAuthorize("hasRole('FIELD_STAFF')")
    public ResponseEntity<Page<PersonalTrackingEventResponse>> getPersonalTrackingEvents(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ParcelStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new AccessDeniedException("Authenticated user context is required");
        }
        String actingStaffUserId = authentication.getName();
        int clampedPage = Math.max(0, page);
        int clampedSize = Math.min(50, Math.max(1, size));
        Pageable pageable = PageRequest.of(clampedPage, clampedSize,
                Sort.by(Sort.Order.desc("eventTimestamp"), Sort.Order.desc("eventId")));
        Page<PersonalTrackingEventResponse> response = trackingService.getPersonalTrackingEvents(
                actingStaffUserId, search, status, pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/mine/metrics")
    @PreAuthorize("hasRole('FIELD_STAFF')")
    public ResponseEntity<PersonalScanMetricsResponse> getPersonalScanMetrics(
            Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new AccessDeniedException("Authenticated user context is required");
        }
        String actingStaffUserId = authentication.getName();
        PersonalScanMetricsResponse response = trackingService.getPersonalScanMetrics(actingStaffUserId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/mine/parcels/{trackingId}")
    @PreAuthorize("hasRole('FIELD_STAFF')")
    public ResponseEntity<PersonalParcelHistoryResponse> getPersonalParcelHistory(
            @PathVariable String trackingId,
            Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new AccessDeniedException("Authenticated user context is required");
        }
        String actingStaffUserId = authentication.getName();
        PersonalParcelHistoryResponse response = trackingService.getPersonalParcelHistory(
                actingStaffUserId, trackingId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/scan")
    @PreAuthorize("hasAnyRole('OFFICE_STAFF', 'FIELD_STAFF', 'ADMIN')")
    public ResponseEntity<TrackingScanResponse> scanParcelStatus(
            @Valid @RequestBody TrackingScanRequest request,
            Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new AccessDeniedException("Authenticated user context is required");
        }
        String actingStaffUserId = authentication.getName();
        TrackingScanResponse response = trackingService.processStatusScan(request, actingStaffUserId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/batch-scan")
    @PreAuthorize("hasAnyRole('OFFICE_STAFF', 'FIELD_STAFF', 'ADMIN')")
    public ResponseEntity<List<TrackingScanResponse>> batchScanParcelStatus(
            @Valid @RequestBody BatchTrackingScanRequest request,
            Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new AccessDeniedException("Authenticated user context is required");
        }
        String actingStaffUserId = authentication.getName();
        List<TrackingScanResponse> responses = trackingService.processBatchScan(request, actingStaffUserId);
        return ResponseEntity.ok(responses);
    }

    @PostMapping(value = "/offline-sync", consumes = "application/json", produces = "application/json")
    @PreAuthorize("hasRole('FIELD_STAFF')")
    public ResponseEntity<OfflineTrackingSyncResponse> synchronizeOfflineScans(
            @RequestBody JsonNode body,
            Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new AccessDeniedException("Authenticated user context is required");
        }
        OfflineTrackingSyncRequest request;
        try {
            request = objectMapper.readerFor(OfflineTrackingSyncRequest.class)
                    .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                    .readValue(body.traverse(objectMapper));
        } catch (IOException ex) {
            throw new IllegalArgumentException("Invalid offline sync request");
        }
        if (request == null || !validator.validate(request).isEmpty()) {
            throw new IllegalArgumentException("Invalid offline sync request");
        }
        return ResponseEntity.ok(trackingService.processOfflineSync(request, authentication.getName()));
    }

    /**
     * Paginated search for company-wide immutable tracking event audit logs.
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<TrackingLogEntryResponse>> getTrackingLogs(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ParcelStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "eventTimestamp"));
        Page<TrackingLogEntryResponse> response = trackingService.getTrackingLogs(search, status, startDate, endDate, pageable);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieve today's operational tracking metrics for the 4-card summary bar.
     */
    @GetMapping("/metrics")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<TrackingMetricsResponse> getTodayTrackingMetrics() {
        TrackingMetricsResponse response = trackingService.getTodayTrackingMetrics();
        return ResponseEntity.ok(response);
    }
}
