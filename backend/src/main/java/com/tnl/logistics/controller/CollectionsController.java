package com.tnl.logistics.controller;

import com.tnl.logistics.dto.WeeklyCollectionsResponse;
import com.tnl.logistics.service.CollectionsService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * REST Controller providing Thursday weekly collections consolidation endpoints.
 */
@RestController
@RequestMapping("/api/v1/collections")
public class CollectionsController {

    private final CollectionsService collectionsService;

    public CollectionsController(CollectionsService collectionsService) {
        this.collectionsService = collectionsService;
    }

    @GetMapping("/weekly")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<WeeklyCollectionsResponse> getWeeklyCollections(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate targetDate
    ) {
        WeeklyCollectionsResponse response = collectionsService.getWeeklyCollections(targetDate);
        return ResponseEntity.ok(response);
    }
}
