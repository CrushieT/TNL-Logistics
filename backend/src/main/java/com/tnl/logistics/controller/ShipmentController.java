package com.tnl.logistics.controller;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.service.ShipmentService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller handling shipment registration, paginated listing, and detail inspection.
 */
@RestController
@RequestMapping("/api/v1/shipments")
public class ShipmentController {

    private final ShipmentService shipmentService;

    public ShipmentController(ShipmentService shipmentService) {
        this.shipmentService = shipmentService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<ShipmentResponse> registerShipment(@Valid @RequestBody ShipmentRegistrationRequest request) {
        String username = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        ShipmentResponse response = shipmentService.registerShipment(request, username);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<Page<ShipmentSummaryResponse>> getShipments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String paymentStatus
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "dateRegistered"));
        Page<ShipmentSummaryResponse> shipments = shipmentService.getShipments(search, status, paymentStatus, pageable);
        return ResponseEntity.ok(shipments);
    }

    @GetMapping("/{shipmentId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<ShipmentDetailResponse> getShipmentById(@PathVariable String shipmentId) {
        ShipmentDetailResponse response = shipmentService.getShipmentById(shipmentId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{shipmentId}/labels/print")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<Void> recordLabelPrint(
            @PathVariable String shipmentId,
            @RequestBody(required = false) PrintLabelRequest request
    ) {
        String username = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        List<String> packageIds = request != null ? request.getPackageIds() : null;
        shipmentService.recordLabelPrint(shipmentId, packageIds, username);
        return ResponseEntity.ok().build();
    }
}
