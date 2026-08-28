package com.tnl.logistics.controller;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.WaybillStatus;
import com.tnl.logistics.service.WaybillService;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Controller exposing Waybill operations, manifest generation, hauler dispatch, and signed POD recording.
 */
@RestController
@RequestMapping("/api/v1/waybills")
public class WaybillController {

    private final WaybillService waybillService;

    public WaybillController(WaybillService waybillService) {
        this.waybillService = waybillService;
    }

    @GetMapping("/shipments")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<List<WaybillShipmentOptionResponse>> getShipmentOptions() {
        return ResponseEntity.ok(waybillService.getShipmentOptions());
    }

    @GetMapping("/haulers")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<List<HaulerStaffOptionResponse>> getHaulerStaffOptions() {
        return ResponseEntity.ok(waybillService.getHaulerStaffOptions());
    }

    @GetMapping("/manifest/{shipmentId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF', 'FIELD_STAFF')")
    public ResponseEntity<WaybillManifestResponse> getManifestByShipmentId(@PathVariable("shipmentId") String shipmentId) {
        return ResponseEntity.ok(waybillService.getManifestByShipmentId(shipmentId));
    }

    @PostMapping("/send-to-hauler")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<WaybillManifestResponse> sendToHauler(@Valid @RequestBody WaybillCreateRequest request,
                                                                 Principal principal) {
        String staffUsername = principal != null ? principal.getName() : "office";
        return ResponseEntity.ok(waybillService.sendToHauler(request, staffUsername));
    }

    @PostMapping("/complete/{shipmentId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<WaybillManifestResponse> markSignedCompleted(@PathVariable("shipmentId") String shipmentId,
                                                                       @RequestBody(required = false) WaybillStatusUpdateRequest request,
                                                                       Principal principal) {
        String staffUsername = principal != null ? principal.getName() : "office";
        WaybillStatusUpdateRequest updateReq = request != null ? request : new WaybillStatusUpdateRequest();
        return ResponseEntity.ok(waybillService.markSignedCompleted(shipmentId, updateReq, staffUsername));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<Page<WaybillSummaryResponse>> getWaybills(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "status", required = false) WaybillStatus status,
            @RequestParam(value = "hauler", required = false) String hauler) {
        PageRequest pageRequest = PageRequest.of(Math.max(0, page), Math.max(1, size), Sort.by("generatedAt").descending());
        return ResponseEntity.ok(waybillService.getWaybills(search, status, hauler, pageRequest));
    }
}
