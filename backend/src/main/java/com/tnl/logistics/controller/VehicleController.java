package com.tnl.logistics.controller;

import com.tnl.logistics.dto.PageResponse;
import com.tnl.logistics.dto.VehicleRequest;
import com.tnl.logistics.dto.VehicleResponse;
import com.tnl.logistics.service.VehicleService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/vehicles")
public class VehicleController {

    private final VehicleService vehicleService;

    public VehicleController(VehicleService vehicleService) {
        this.vehicleService = vehicleService;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<VehicleResponse> createVehicle(@Valid @RequestBody VehicleRequest request) {
        VehicleResponse response = vehicleService.createVehicle(request);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEIVING_STAFF', 'COURIER_STAFF', 'DISPATCH_STAFF')")
    public ResponseEntity<List<VehicleResponse>> listVehicles(
            @RequestParam(name = "all", defaultValue = "false") boolean includeInactive) {
        List<VehicleResponse> responses = includeInactive
                ? vehicleService.getAllVehicles()
                : vehicleService.getActiveVehicles();
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/options")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEIVING_STAFF', 'COURIER_STAFF', 'DISPATCH_STAFF')")
    public ResponseEntity<PageResponse<VehicleResponse>> getVehicleOptions(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "search", required = false) String search) {
        int boundedSize = Math.min(100, Math.max(1, size));
        PageRequest pageRequest = PageRequest.of(
                Math.max(0, page),
                boundedSize,
                Sort.by(Sort.Order.asc("vehicleId")));
        return ResponseEntity.ok(PageResponse.from(vehicleService.getActiveVehicleOptions(search, pageRequest)));
    }

    @GetMapping("/{vehicleId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEIVING_STAFF', 'COURIER_STAFF', 'DISPATCH_STAFF')")
    public ResponseEntity<VehicleResponse> getVehicleById(@PathVariable String vehicleId) {
        VehicleResponse response = vehicleService.getVehicleById(vehicleId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{vehicleId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<VehicleResponse> updateVehicle(
            @PathVariable String vehicleId,
            @Valid @RequestBody VehicleRequest request) {
        VehicleResponse response = vehicleService.updateVehicle(vehicleId, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{vehicleId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deactivateVehicle(@PathVariable String vehicleId) {
        vehicleService.deactivateVehicle(vehicleId);
        return ResponseEntity.noContent().build();
    }
}
