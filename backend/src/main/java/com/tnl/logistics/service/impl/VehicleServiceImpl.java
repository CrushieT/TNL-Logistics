package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.VehicleRequest;
import com.tnl.logistics.dto.VehicleResponse;
import com.tnl.logistics.model.Vehicle;
import com.tnl.logistics.repository.VehicleRepository;
import com.tnl.logistics.service.VehicleService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class VehicleServiceImpl implements VehicleService {

    private final VehicleRepository vehicleRepository;

    public VehicleServiceImpl(VehicleRepository vehicleRepository) {
        this.vehicleRepository = vehicleRepository;
    }

    @Override
    public synchronized VehicleResponse createVehicle(VehicleRequest request) {
        if (vehicleRepository.findByPlateNumber(request.getPlateNumber()).isPresent()) {
            throw new IllegalArgumentException("A vehicle with plate number " + request.getPlateNumber() + " already exists");
        }

        String prefix = "VH-";
        String maxId = vehicleRepository.findMaxVehicleIdWithPrefix(prefix + "%").orElse(null);
        int nextSeq = 1;
        if (maxId != null && maxId.startsWith(prefix)) {
            try {
                nextSeq = Integer.parseInt(maxId.substring(prefix.length())) + 1;
            } catch (NumberFormatException ignored) {}
        }
        String vehicleId = String.format("VH-%03d", nextSeq);

        Vehicle vehicle = new Vehicle(vehicleId, request.getPlateNumber(), request.getDescription());
        if (request.getActive() != null) {
            vehicle.setActive(request.getActive());
        }
        vehicleRepository.save(vehicle);

        return mapToResponse(vehicle);
    }

    @Override
    @Transactional(readOnly = true)
    public List<VehicleResponse> getActiveVehicles() {
        return vehicleRepository.findByActiveTrueOrderByVehicleIdAsc().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<VehicleResponse> getAllVehicles() {
        return vehicleRepository.findAllByOrderByVehicleIdAsc().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public VehicleResponse getVehicleById(String vehicleId) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found: " + vehicleId));
        return mapToResponse(vehicle);
    }

    @Override
    public VehicleResponse updateVehicle(String vehicleId, VehicleRequest request) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found: " + vehicleId));

        vehicleRepository.findByPlateNumber(request.getPlateNumber()).ifPresent(existing -> {
            if (!existing.getVehicleId().equals(vehicleId)) {
                throw new IllegalArgumentException("Plate number " + request.getPlateNumber() + " is already used by vehicle " + existing.getVehicleId());
            }
        });

        vehicle.setPlateNumber(request.getPlateNumber());
        vehicle.setDescription(request.getDescription());
        if (request.getActive() != null) {
            vehicle.setActive(request.getActive());
        }
        vehicleRepository.save(vehicle);

        return mapToResponse(vehicle);
    }

    @Override
    public void deactivateVehicle(String vehicleId) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found: " + vehicleId));
        vehicle.setActive(false);
        vehicleRepository.save(vehicle);
    }

    private VehicleResponse mapToResponse(Vehicle v) {
        return new VehicleResponse(
                v.getVehicleId(),
                v.getPlateNumber(),
                v.getDescription(),
                v.getActive(),
                v.getCreatedAt()
        );
    }
}
