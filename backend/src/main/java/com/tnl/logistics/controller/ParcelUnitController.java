package com.tnl.logistics.controller;

import com.tnl.logistics.dto.ParcelUnitDetailResponse;
import com.tnl.logistics.service.ShipmentService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controller handling individual parcel unit inspection and QR details.
 */
@RestController
@RequestMapping("/api/v1/parcel-units")
public class ParcelUnitController {

    private final ShipmentService shipmentService;

    public ParcelUnitController(ShipmentService shipmentService) {
        this.shipmentService = shipmentService;
    }

    @GetMapping("/{trackingId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF', 'FIELD_STAFF')")
    public ResponseEntity<ParcelUnitDetailResponse> getParcelUnit(@PathVariable String trackingId) {
        ParcelUnitDetailResponse response = shipmentService.getParcelUnitByTrackingId(trackingId);
        return ResponseEntity.ok(response);
    }
}
