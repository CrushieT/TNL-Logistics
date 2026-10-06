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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Controller exposing waybill generation, field handoff, signature capture, and manifest queries.
 */
@RestController
@RequestMapping("/api/v1/waybills")
public class WaybillController {

    private static final int MAX_SHIPMENT_OPTION_PAGE_SIZE = 100;

    private final WaybillService waybillService;

    public WaybillController(WaybillService waybillService) {
        this.waybillService = waybillService;
    }

    @GetMapping("/shipments")
    @PreAuthorize("hasAnyRole('ADMIN', 'FIELD_STAFF')")
    public ResponseEntity<List<WaybillShipmentOptionResponse>> getShipmentOptions(Principal principal) {
        waybillService.assertViewer(actor(principal));
        return ResponseEntity.ok(waybillService.getShipmentOptions());
    }

    @GetMapping("/shipment-options")
    @PreAuthorize("hasRole('FIELD_STAFF')")
    public ResponseEntity<PageResponse<WaybillShipmentOptionResponse>> getShipmentOptionsPage(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "search", required = false) String search,
            Principal principal) {
        waybillService.assertViewer(actor(principal));
        int boundedSize = Math.min(MAX_SHIPMENT_OPTION_PAGE_SIZE, Math.max(1, size));
        PageRequest pageRequest = PageRequest.of(
                Math.max(0, page),
                boundedSize,
                Sort.by(Sort.Order.desc("dateRegistered"), Sort.Order.desc("shipmentId")));
        return ResponseEntity.ok(PageResponse.from(waybillService.getShipmentOptions(search, pageRequest)));
    }

    @GetMapping("/options")
    @PreAuthorize("hasRole('FIELD_STAFF')")
    public ResponseEntity<PageResponse<WaybillOptionResponse>> getWaybillOptions(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "status", required = false) WaybillStatus status,
            Principal principal) {
        waybillService.assertViewer(actor(principal));
        int boundedSize = Math.min(MAX_SHIPMENT_OPTION_PAGE_SIZE, Math.max(1, size));
        PageRequest pageRequest = PageRequest.of(
                Math.max(0, page),
                boundedSize,
                Sort.by(Sort.Order.desc("generatedAt"), Sort.Order.desc("waybillId")));
        return ResponseEntity.ok(PageResponse.from(waybillService.getWaybillOptions(search, status, pageRequest)));
    }

    @GetMapping("/haulers")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<HaulerStaffOptionResponse>> getHaulerStaffOptions() {
        return ResponseEntity.ok(waybillService.getHaulerStaffOptions());
    }

    @GetMapping("/shipments/{shipmentId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'FIELD_STAFF')")
    public ResponseEntity<List<WaybillManifestResponse>> getByShipmentId(@PathVariable String shipmentId, Principal principal) {
        waybillService.assertViewer(actor(principal));
        return ResponseEntity.ok(waybillService.getByShipmentId(shipmentId));
    }

    @GetMapping("/shipments/{shipmentId}/available")
    @PreAuthorize("hasRole('FIELD_STAFF')")
    public ResponseEntity<List<ParcelUnitResponse>> getAvailableUnits(@PathVariable String shipmentId, Principal principal) {
        waybillService.assertViewer(actor(principal));
        return ResponseEntity.ok(waybillService.getAvailableUnits(shipmentId));
    }

    @GetMapping("/{waybillId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'FIELD_STAFF')")
    public ResponseEntity<WaybillManifestResponse> getById(@PathVariable String waybillId, Principal principal) {
        waybillService.assertViewer(actor(principal));
        return ResponseEntity.ok(waybillService.getManifestById(waybillId));
    }

    @PostMapping("/generate")
    @PreAuthorize("hasRole('FIELD_STAFF')")
    public ResponseEntity<WaybillManifestResponse> generate(@Valid @RequestBody WaybillGenerationRequest request, Principal principal) {
        return ResponseEntity.ok(waybillService.generate(request, actor(principal)));
    }

    @PostMapping("/{waybillId}/send")
    @PreAuthorize("hasRole('FIELD_STAFF')")
    public ResponseEntity<WaybillManifestResponse> sendToHauler(@PathVariable String waybillId, Principal principal) {
        return ResponseEntity.ok(waybillService.sendToHauler(waybillId, actor(principal)));
    }

    @PostMapping("/{waybillId}/complete")
    @PreAuthorize("hasRole('FIELD_STAFF')")
    public ResponseEntity<WaybillManifestResponse> markSignedCompleted(@PathVariable String waybillId,
            @Valid @RequestBody WaybillStatusUpdateRequest request, Principal principal) {
        return ResponseEntity.ok(waybillService.markSignedCompleted(waybillId, request, actor(principal)));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<WaybillSummaryResponse>> getWaybills(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "status", required = false) WaybillStatus status,
            @RequestParam(value = "hauler", required = false) String hauler) {
        PageRequest pageRequest = PageRequest.of(Math.max(0, page), Math.max(1, size), Sort.by("generatedAt").descending());
        return ResponseEntity.ok(waybillService.getWaybills(search, status, hauler, pageRequest));
    }

    private String actor(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new AccessDeniedException("Authenticated user context is required");
        }
        return principal.getName();
    }
}
