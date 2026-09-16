package com.tnl.logistics.controller;

import com.tnl.logistics.dto.DashboardSummaryResponse;
import com.tnl.logistics.service.DashboardService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * REST Controller exposing live dashboard rollups, status distributions,
 * weekly volume trends, and recent tracking activity for Screen 02.
 */
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<DashboardSummaryResponse> getDashboardSummary(
            @RequestParam(value = "cycle", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate cycle) {
        DashboardSummaryResponse summary = dashboardService.getDashboardSummary(cycle);
        return ResponseEntity.ok(summary);
    }
}
