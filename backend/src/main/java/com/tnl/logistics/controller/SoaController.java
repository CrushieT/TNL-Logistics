package com.tnl.logistics.controller;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.SoaLogoAsset;
import com.tnl.logistics.service.SoaService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * REST Controller for Statement of Account (SOA) previewing, deductions, versioning, and persistence.
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
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate targetDate,
            @RequestParam(required = false) Integer version
    ) {
        StatementPreviewResponse response = (version != null)
                ? soaService.getStatementVersion(clientId, targetDate, version)
                : soaService.getStatementPreview(clientId, targetDate);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/generate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StatementPreviewResponse> generateStatement(
            @Valid @RequestBody(required = false) SaveStatementRequest request,
            @RequestParam(required = false) String clientId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate targetDate,
            Authentication authentication
    ) {
        String actingUserId = getActingUserId(authentication);
        if (request == null) {
            if (clientId == null || clientId.trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Client ID is required");
            }
            request = new SaveStatementRequest(clientId, targetDate, BigDecimal.ZERO, null, null);
        }
        StatementPreviewResponse response = soaService.generateStatement(request, actingUserId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/save")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StatementPreviewResponse> saveStatement(
            @Valid @RequestBody SaveStatementRequest request,
            Authentication authentication
    ) {
        String actingUserId = getActingUserId(authentication);
        StatementPreviewResponse response = soaService.saveStatement(request, actingUserId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/version")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StatementPreviewResponse> saveStatementVersion(
            @Valid @RequestBody SaveStatementVersionRequest request,
            Authentication authentication
    ) {
        String actingUserId = getActingUserId(authentication);
        StatementPreviewResponse response = soaService.saveStatementVersion(request, actingUserId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/ensure-v1")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StatementPreviewResponse> ensureV1Snapshot(
            @Valid @RequestBody EnsureV1Request request,
            Authentication authentication
    ) {
        String actingUserId = getActingUserId(authentication);
        StatementPreviewResponse response = soaService.ensureV1Snapshot(request, actingUserId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/versions")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<SoaVersionSummaryDto>> listVersions(
            @RequestParam(required = false) String clientId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate targetDate,
            @RequestParam(required = false) String soaNo
    ) {
        if (soaNo != null && !soaNo.trim().isEmpty()) {
            return ResponseEntity.ok(soaService.listVersionsBySoaNo(soaNo));
        }
        if (clientId == null || clientId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Either clientId or soaNo is required");
        }
        List<SoaVersionSummaryDto> versions = soaService.listVersions(clientId, targetDate);
        return ResponseEntity.ok(versions);
    }

    @GetMapping("/logo/{logoHash}")
    public ResponseEntity<byte[]> getLogoAsset(@PathVariable String logoHash) {
        SoaLogoAsset asset = soaService.getLogoAsset(logoHash);
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000, immutable")
                .contentType(MediaType.parseMediaType(asset.getContentType()))
                .body(asset.getContent());
    }

    @GetMapping("/collectors")
    @PreAuthorize("hasAnyRole('ADMIN', 'COURIER_STAFF', 'DISPATCH_STAFF')")
    public ResponseEntity<List<CollectorOptionDto>> getAuthorizedCollectors() {
        List<CollectorOptionDto> collectors = soaService.getAuthorizedCollectors();
        return ResponseEntity.ok(collectors);
    }

    private String getActingUserId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new AccessDeniedException("Authenticated user context is required");
        }
        return authentication.getName();
    }
}
