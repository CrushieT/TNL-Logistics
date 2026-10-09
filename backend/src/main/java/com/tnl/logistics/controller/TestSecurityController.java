package com.tnl.logistics.controller;

import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

/**
 * Controller to test and prove role-gated authorization scaffolds.
 * Gated to development and test profiles to prevent exposure in production.
 */
@RestController
@RequestMapping("/api/v1/test")
@Profile({"dev", "test"})
public class TestSecurityController {

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, String> testAdmin() {
        return Map.of("message", "Access Granted: ADMIN Role");
    }

    @GetMapping("/receiving")
    @PreAuthorize("hasRole('RECEIVING_STAFF')")
    public Map<String, String> testReceiving() {
        return Map.of("message", "Access Granted: RECEIVING_STAFF Role");
    }

    @GetMapping("/courier")
    @PreAuthorize("hasRole('COURIER_STAFF')")
    public Map<String, String> testCourier() {
        return Map.of("message", "Access Granted: COURIER_STAFF Role");
    }

    @GetMapping("/dispatch")
    @PreAuthorize("hasRole('DISPATCH_STAFF')")
    public Map<String, String> testDispatch() {
        return Map.of("message", "Access Granted: DISPATCH_STAFF Role");
    }
}
