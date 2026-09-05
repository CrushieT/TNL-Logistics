package com.tnl.logistics.controller;

import com.tnl.logistics.dto.PaymentRecordRequest;
import com.tnl.logistics.dto.PaymentResponse;
import com.tnl.logistics.dto.ShipmentPaymentSummaryResponse;
import com.tnl.logistics.model.PaymentMethod;
import com.tnl.logistics.service.PaymentService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * REST Controller exposing endpoints for payment recording, shipment balances,
 * and company-wide financial transaction history.
 */
@RestController
@RequestMapping("/api/v1/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    /**
     * Record a new payment against a shipment.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<PaymentResponse> recordPayment(
            @Valid @RequestBody PaymentRecordRequest request,
            Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new IllegalStateException("Authenticated user context is required to record a payment.");
        }
        String username = authentication.getName();
        PaymentResponse response = paymentService.recordPayment(request, username);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    /**
     * Retrieve payment breakdown and financial balance for a specific shipment.
     */
    @GetMapping("/shipment/{shipmentId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF', 'FIELD_STAFF')")
    public ResponseEntity<ShipmentPaymentSummaryResponse> getPaymentsByShipmentId(
            @PathVariable String shipmentId) {
        ShipmentPaymentSummaryResponse response = paymentService.getPaymentsByShipmentId(shipmentId);
        return ResponseEntity.ok(response);
    }

    /**
     * Paginated search for payments across the company.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<Page<PaymentResponse>> getPayments(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) PaymentMethod method,
            @RequestParam(required = false) String clientId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "recordedAt"));
        Page<PaymentResponse> responses = paymentService.getPayments(search, method, clientId, startDate, endDate, pageable);
        return ResponseEntity.ok(responses);
    }
}
