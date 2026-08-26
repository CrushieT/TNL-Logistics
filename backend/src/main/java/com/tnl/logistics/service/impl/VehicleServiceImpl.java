package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.VehicleRequest;
import com.tnl.logistics.dto.VehicleResponse;
import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.Vehicle;
import com.tnl.logistics.repository.ParcelUnitRepository;
import com.tnl.logistics.repository.TrackingEventRepository;
import com.tnl.logistics.repository.VehicleRepository;
import com.tnl.logistics.service.VehicleService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
public class VehicleServiceImpl implements VehicleService {

    private final VehicleRepository vehicleRepository;
    private final ParcelUnitRepository parcelUnitRepository;
    private final TrackingEventRepository trackingEventRepository;

    public VehicleServiceImpl(VehicleRepository vehicleRepository,
                              ParcelUnitRepository parcelUnitRepository,
                              TrackingEventRepository trackingEventRepository) {
        this.vehicleRepository = vehicleRepository;
        this.parcelUnitRepository = parcelUnitRepository;
        this.trackingEventRepository = trackingEventRepository;
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

        String vehicleType = request.getVehicleType() != null && !request.getVehicleType().isBlank()
                ? request.getVehicleType() : "6-Wheeler Forward";
        String status = request.getStatus() != null && !request.getStatus().isBlank()
                ? request.getStatus() : "Active";
        String remarks = request.getRemarks();

        Vehicle vehicle = new Vehicle(vehicleId, request.getPlateNumber(), vehicleType, request.getDescription(), status, remarks);
        if (request.getActive() != null) {
            vehicle.setActive(request.getActive());
        }
        vehicleRepository.save(vehicle);

        return mapToResponse(vehicle, 0L);
    }

    @Override
    @Transactional(readOnly = true)
    public List<VehicleResponse> getActiveVehicles() {
        Map<String, Long> countMap = loadOnTruckCountMap();
        return vehicleRepository.findByActiveTrueOrderByVehicleIdAsc().stream()
                .map(v -> mapToResponse(v, countMap.getOrDefault(v.getVehicleId(), 0L)))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<VehicleResponse> getAllVehicles() {
        Map<String, Long> countMap = loadOnTruckCountMap();
        return vehicleRepository.findAllByOrderByVehicleIdAsc().stream()
                .map(v -> mapToResponse(v, countMap.getOrDefault(v.getVehicleId(), 0L)))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public VehicleResponse getVehicleById(String vehicleId) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found: " + vehicleId));
        long count = parcelUnitRepository.countByCurrentVehicle_VehicleIdAndCurrentStatus(vehicleId, ParcelStatus.LOADED_ON_TRUCK);
        return mapToResponse(vehicle, count);
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
        if (request.getVehicleType() != null && !request.getVehicleType().isBlank()) {
            vehicle.setVehicleType(request.getVehicleType());
        }
        vehicle.setDescription(request.getDescription());
        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            vehicle.setStatus(request.getStatus());
        }
        vehicle.setRemarks(request.getRemarks());
        if (request.getActive() != null) {
            vehicle.setActive(request.getActive());
        }
        vehicleRepository.save(vehicle);

        long count = parcelUnitRepository.countByCurrentVehicle_VehicleIdAndCurrentStatus(vehicleId, ParcelStatus.LOADED_ON_TRUCK);
        return mapToResponse(vehicle, count);
    }

    @Override
    public void deactivateVehicle(String vehicleId) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found: " + vehicleId));

        long eventCount = trackingEventRepository.countByVehicle_VehicleId(vehicleId);
        long parcelCount = parcelUnitRepository.countByCurrentVehicle_VehicleId(vehicleId);

        if (eventCount == 0 && parcelCount == 0) {
            // Smart Delete: Permanent Hard Delete for unused vehicles
            vehicleRepository.delete(vehicle);
        } else {
            // Smart Delete: Soft Deactivate to preserve historical audit trail and FK integrity
            vehicle.setActive(false);
            vehicle.setStatus("Inactive");
            vehicleRepository.save(vehicle);
        }
    }

    private Map<String, Long> loadOnTruckCountMap() {
        List<Object[]> rows = parcelUnitRepository.countLoadedParcelsGroupedByVehicle(ParcelStatus.LOADED_ON_TRUCK);
        return rows.stream().collect(Collectors.toMap(
                row -> (String) row[0],
                row -> (Long) row[1],
                (a, b) -> a
        ));
    }

    private VehicleResponse mapToResponse(Vehicle v, Long onTruckCount) {
        return new VehicleResponse(
                v.getVehicleId(),
                v.getPlateNumber(),
                v.getVehicleType() != null ? v.getVehicleType() : "6-Wheeler Forward",
                v.getDescription(),
                v.getStatus() != null ? v.getStatus() : (Boolean.TRUE.equals(v.getActive()) ? "Active" : "Inactive"),
                v.getRemarks() != null && !v.getRemarks().isBlank() ? v.getRemarks() : "—",
                onTruckCount != null ? onTruckCount : 0L,
                v.getActive(),
                v.getCreatedAt()
        );
    }
}
