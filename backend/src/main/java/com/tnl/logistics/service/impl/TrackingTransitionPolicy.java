package com.tnl.logistics.service.impl;

import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.Vehicle;
import com.tnl.logistics.repository.VehicleRepository;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class TrackingTransitionPolicy {
    public enum DecisionKind { APPLY, ALREADY_APPLIED, STALE_STATE, VEHICLE_MISMATCH, INVALID_TRANSITION }
    public enum VehicleKind { ACTIVE, NOT_FOUND, INACTIVE }
    public record Decision(DecisionKind kind) {}
    public record VehicleResolution(VehicleKind kind, Vehicle vehicle) {}

    private static final Map<ParcelStatus, Integer> STATUS_RANKS = Map.of(
            ParcelStatus.REGISTERED, 0,
            ParcelStatus.QR_GENERATED, 1,
            ParcelStatus.LOADED_ON_TRUCK, 2,
            ParcelStatus.ARRIVED_AT_TNL, 3,
            ParcelStatus.LOADED_TO_HAULER, 4,
            ParcelStatus.COMPLETED, 5);

    private final VehicleRepository vehicleRepository;

    public TrackingTransitionPolicy(VehicleRepository vehicleRepository) {
        this.vehicleRepository = vehicleRepository;
    }

    public Decision decide(ParcelStatus current, ParcelStatus target, String currentVehicleId, String requestedVehicleId) {
        if (current == target) {
            if (target == ParcelStatus.LOADED_ON_TRUCK && !java.util.Objects.equals(currentVehicleId, requestedVehicleId)) {
                return new Decision(DecisionKind.VEHICLE_MISMATCH);
            }
            return new Decision(DecisionKind.ALREADY_APPLIED);
        }
        if (STATUS_RANKS.get(target) < STATUS_RANKS.get(current)) return new Decision(DecisionKind.STALE_STATE);
        if (STATUS_RANKS.get(target) != STATUS_RANKS.get(current) + 1) return new Decision(DecisionKind.INVALID_TRANSITION);
        return new Decision(DecisionKind.APPLY);
    }

    public VehicleResolution resolveActiveVehicle(String vehicleId) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId).orElse(null);
        if (vehicle == null) return new VehicleResolution(VehicleKind.NOT_FOUND, null);
        if (Boolean.FALSE.equals(vehicle.getActive())) return new VehicleResolution(VehicleKind.INACTIVE, null);
        return new VehicleResolution(VehicleKind.ACTIVE, vehicle);
    }
}
