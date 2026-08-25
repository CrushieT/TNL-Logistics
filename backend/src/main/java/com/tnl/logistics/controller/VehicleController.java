package com.tnl.logistics.controller;

import com.tnl.logistics.dto.VehicleRequest;
import com.tnl.logistics.dto.VehicleResponse;
import com.tnl.logistics.service.VehicleService;
import jakarta.validation.Valid;
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
    @PreAuthorize("hasAnyRole('OFFICE_STAFF', 'ADMIN')")
    public ResponseEntity<VehicleResponse> createVehicle(@Valid @RequestBody VehicleRequest request) {
        VehicleResponse response = vehicleService.createVehicle(request);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OFFICE_STAFF', 'FIELD_STAFF', 'ADMIN')")
    public ResponseEntity<List<VehicleResponse>> listVehicles(
            @RequestParam(name = "all", defaultValue = "false") boolean includeInactive) {
        List<VehicleResponse> responses = includeInactive
                ? vehicleService.getAllVehicles()
                : vehicleService.getActiveVehicles();
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/{vehicleId}")
    @PreAuthorize("hasAnyRole('OFFICE_STAFF', 'FIELD_STAFF', 'ADMIN')")
    public ResponseEntity<VehicleResponse> getVehicleById(@PathVariable String vehicleId) {
        VehicleResponse response = vehicleService.getVehicleById(vehicleId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{vehicleId}")
    @PreAuthorize("hasAnyRole('OFFICE_STAFF', 'ADMIN')")
    public ResponseEntity<VehicleResponse> updateVehicle(
            @PathVariable String vehicleId,
            @Valid @RequestBody VehicleRequest request) {
        VehicleResponse response = vehicleService.updateVehicle(vehicleId, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{vehicleId}")
    @PreAuthorize("hasAnyRole('OFFICE_STAFF', 'ADMIN')")
    public ResponseEntity<Void> deactivateVehicle(@PathVariable String vehicleId) {
        vehicleService.deactivateVehicle(vehicleId);
        return ResponseEntity.noContent().build();
    }
}
