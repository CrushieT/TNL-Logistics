package com.tnl.logistics.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

/**
 * Controller to test and prove role-gated authorization scaffolds.
 */
@RestController
@RequestMapping("/api/v1/test")
public class TestSecurityController {

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, String> testAdmin() {
        return Map.of("message", "Access Granted: ADMIN Role");
    }

    @GetMapping("/office")
    @PreAuthorize("hasRole('OFFICE_STAFF')")
    public Map<String, String> testOffice() {
        return Map.of("message", "Access Granted: OFFICE_STAFF Role");
    }

    @GetMapping("/field")
    @PreAuthorize("hasRole('FIELD_STAFF')")
    public Map<String, String> testField() {
        return Map.of("message", "Access Granted: FIELD_STAFF Role");
    }
}
