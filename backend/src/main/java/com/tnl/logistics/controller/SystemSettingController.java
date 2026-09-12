package com.tnl.logistics.controller;

import com.tnl.logistics.dto.CompanyBrandingDto;
import com.tnl.logistics.dto.SystemSettingDto;
import com.tnl.logistics.dto.UpdateSystemSettingRequest;
import com.tnl.logistics.service.SystemSettingService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller providing administrative system configuration management
 * and staff-accessible company branding metadata.
 */
@RestController
@RequestMapping("/api/v1/settings")
public class SystemSettingController {

    private final SystemSettingService systemSettingService;

    public SystemSettingController(SystemSettingService systemSettingService) {
        this.systemSettingService = systemSettingService;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SystemSettingDto> getSettings() {
        return ResponseEntity.ok(systemSettingService.getSettings());
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SystemSettingDto> updateSettings(
            @Valid @RequestBody UpdateSystemSettingRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String actingUsername = auth != null ? auth.getName() : "ADMIN";
        return ResponseEntity.ok(systemSettingService.updateSettings(request, actingUsername));
    }

    @GetMapping("/branding")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF', 'FIELD_STAFF')")
    public ResponseEntity<CompanyBrandingDto> getCompanyBranding() {
        return ResponseEntity.ok(systemSettingService.getCompanyBranding());
    }
}
