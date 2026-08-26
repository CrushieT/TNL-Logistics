package com.tnl.logistics.controller;

import com.tnl.logistics.dto.BatchTrackingScanRequest;
import com.tnl.logistics.dto.TrackingScanRequest;
import com.tnl.logistics.dto.TrackingScanResponse;
import com.tnl.logistics.service.TrackingService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

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
}
