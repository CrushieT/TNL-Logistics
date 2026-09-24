package com.tnl.logistics.controller;

import com.tnl.logistics.dto.CollectorOptionDto;
import com.tnl.logistics.dto.SaveStatementRequest;
import com.tnl.logistics.dto.StatementPreviewResponse;
import com.tnl.logistics.service.SoaService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * REST Controller for Statement of Account (SOA) previewing, deductions, and persistence.
 */
@RestController
@RequestMapping("/api/v1/soa")
public class SoaController {

    private final SoaService soaService;

    public SoaController(SoaService soaService) {
        this.soaService = soaService;
    }

    @GetMapping("/preview")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StatementPreviewResponse> getStatementPreview(
            @RequestParam String clientId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate targetDate
    ) {
        StatementPreviewResponse response = soaService.getStatementPreview(clientId, targetDate);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/save")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StatementPreviewResponse> saveStatement(
            @Valid @RequestBody SaveStatementRequest request,
            Authentication authentication
    ) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new AccessDeniedException("Authenticated user context is required");
        }
        String actingUserId = authentication.getName();
        StatementPreviewResponse response = soaService.saveStatement(request, actingUserId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/collectors")
    @PreAuthorize("hasAnyRole('ADMIN', 'FIELD_STAFF')")
    public ResponseEntity<List<CollectorOptionDto>> getAuthorizedCollectors() {
        List<CollectorOptionDto> collectors = soaService.getAuthorizedCollectors();
        return ResponseEntity.ok(collectors);
    }
}
