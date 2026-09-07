package com.tnl.logistics.controller;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.service.TrackingService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/tracking-events")
public class TrackingEventController {

    private final TrackingService trackingService;

    public TrackingEventController(TrackingService trackingService) {
        this.trackingService = trackingService;
    }

    @PostMapping("/scan")
    @PreAuthorize("hasAnyRole('OFFICE_STAFF', 'FIELD_STAFF', 'ADMIN')")
    public ResponseEntity<TrackingScanResponse> scanParcelStatus(
            @Valid @RequestBody TrackingScanRequest request,
            Authentication authentication) {
        String staffUsername = authentication.getName();
        TrackingScanResponse response = trackingService.processStatusScan(request, staffUsername);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/batch-scan")
    @PreAuthorize("hasAnyRole('OFFICE_STAFF', 'FIELD_STAFF', 'ADMIN')")
    public ResponseEntity<List<TrackingScanResponse>> batchScanParcelStatus(
            @Valid @RequestBody BatchTrackingScanRequest request,
            Authentication authentication) {
        String staffUsername = authentication.getName();
        List<TrackingScanResponse> responses = trackingService.processBatchScan(request, staffUsername);
        return ResponseEntity.ok(responses);
    }

    /**
     * Paginated search for company-wide immutable tracking event audit logs.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
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
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<TrackingMetricsResponse> getTodayTrackingMetrics() {
        TrackingMetricsResponse response = trackingService.getTodayTrackingMetrics();
        return ResponseEntity.ok(response);
    }
}
