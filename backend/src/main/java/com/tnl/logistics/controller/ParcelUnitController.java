package com.tnl.logistics.controller;

import com.tnl.logistics.dto.ParcelUnitDetailResponse;
import com.tnl.logistics.service.ShipmentService;
import com.tnl.logistics.service.ParcelExceptionService;
import com.tnl.logistics.dto.ParcelExceptionRequest;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
    private final ParcelExceptionService exceptionService;

    public ParcelUnitController(ShipmentService shipmentService, ParcelExceptionService exceptionService) {
        this.shipmentService = shipmentService;
        this.exceptionService = exceptionService;
    }

    @PostMapping("/{trackingId}/lost")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ParcelUnitDetailResponse> markLost(@PathVariable String trackingId,
            @Valid @RequestBody ParcelExceptionRequest request, Principal principal) {
        return ResponseEntity.ok(exceptionService.changeLoss(trackingId, true, request, principal.getName()));
    }

    @PostMapping("/{trackingId}/found")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ParcelUnitDetailResponse> markFound(@PathVariable String trackingId,
            @Valid @RequestBody ParcelExceptionRequest request, Principal principal) {
        return ResponseEntity.ok(exceptionService.changeLoss(trackingId, false, request, principal.getName()));
    }

    @GetMapping("/{trackingId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEIVING_STAFF')")
    public ResponseEntity<ParcelUnitDetailResponse> getParcelUnit(@PathVariable String trackingId) {
        ParcelUnitDetailResponse response = shipmentService.getParcelUnitByTrackingId(trackingId);
        return ResponseEntity.ok(response);
    }
}
