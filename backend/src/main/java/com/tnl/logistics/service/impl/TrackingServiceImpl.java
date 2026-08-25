package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.BatchTrackingScanRequest;
import com.tnl.logistics.dto.TrackingScanRequest;
import com.tnl.logistics.dto.TrackingScanResponse;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.ParcelUnitRepository;
import com.tnl.logistics.repository.TrackingEventRepository;
import com.tnl.logistics.repository.VehicleRepository;
import com.tnl.logistics.service.SseService;
import com.tnl.logistics.service.TrackingService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service implementing 5-state parcel status flow, sequential validation,
 * vehicle fleet assignment, append-only audit event logging, and real-time SSE broadcasting.
 */
@Service
@Transactional
public class TrackingServiceImpl implements TrackingService {

    private final ParcelUnitRepository parcelUnitRepository;
    private final TrackingEventRepository trackingEventRepository;
    private final VehicleRepository vehicleRepository;
    private final AppUserRepository appUserRepository;
    private final SseService sseService;

    public TrackingServiceImpl(ParcelUnitRepository parcelUnitRepository,
                               TrackingEventRepository trackingEventRepository,
                               VehicleRepository vehicleRepository,
                               AppUserRepository appUserRepository,
                               SseService sseService) {
        this.parcelUnitRepository = parcelUnitRepository;
        this.trackingEventRepository = trackingEventRepository;
        this.vehicleRepository = vehicleRepository;
        this.appUserRepository = appUserRepository;
        this.sseService = sseService;
    }

    @Override
    public TrackingScanResponse processStatusScan(TrackingScanRequest request, String actingStaffUsername) {
        ParcelUnit parcel = parcelUnitRepository.findById(request.getTrackingId())
                .orElseThrow(() -> new IllegalArgumentException("Parcel unit not found: " + request.getTrackingId()));

        AppUser actingStaff = appUserRepository.findByUsername(actingStaffUsername)
                .orElseThrow(() -> new IllegalArgumentException("Staff user not found: " + actingStaffUsername));

        ParcelStatus currentStatus = parcel.getCurrentStatus();
        ParcelStatus targetStatus = request.getTargetStatus();

        // 1. Check if already in target state (Idempotent success)
        if (currentStatus == targetStatus) {
            String rollup = computeRollupForShipment(parcel.getShipment());
            Vehicle vehicle = parcel.getCurrentVehicle();
            TrackingScanResponse resp = new TrackingScanResponse(
                    parcel.getTrackingId(),
                    formatStatus(currentStatus),
                    formatStatus(targetStatus),
                    vehicle != null ? vehicle.getVehicleId() : null,
                    vehicle != null ? vehicle.getPlateNumber() : null,
                    LocalDateTime.now(),
                    actingStaff.getFullName(),
                    parcel.getShipment().getShipmentId(),
                    rollup
            );
            return resp;
        }

        // 2. Validate Sequential 5-State Transition
        validateStateTransition(currentStatus, targetStatus, parcel.getTrackingId());

        // 3. Handle Vehicle Association & Validation
        Vehicle assignedVehicle = null;
        if (targetStatus == ParcelStatus.LOADED_ON_TRUCK) {
            if (request.getVehicleId() == null || request.getVehicleId().trim().isEmpty()) {
                throw new IllegalArgumentException("A valid active vehicleId is required when transitioning to LOADED_ON_TRUCK");
            }
            assignedVehicle = vehicleRepository.findById(request.getVehicleId())
                    .orElseThrow(() -> new IllegalArgumentException("Vehicle not found: " + request.getVehicleId()));

            if (Boolean.FALSE.equals(assignedVehicle.getActive())) {
                throw new IllegalStateException("Vehicle " + request.getVehicleId() + " is inactive and cannot be assigned to shipments");
            }
            parcel.setCurrentVehicle(assignedVehicle);
        } else if (targetStatus == ParcelStatus.ARRIVED_AT_TNL || targetStatus == ParcelStatus.LOADED_TO_HAULER) {
            // Clear truck assignment when arrived at terminal or loaded to 3rd party hauler
            parcel.setCurrentVehicle(null);
        }

        // 4. Update Current Status & Save Entity
        parcel.setCurrentStatus(targetStatus);
        parcelUnitRepository.save(parcel);

        // 5. Append-only Tracking Audit Event
        String remarks = request.getRemarks() != null ? request.getRemarks() : "Status scan updated to " + formatStatus(targetStatus);
        TrackingEvent event = new TrackingEvent(
                parcel,
                targetStatus,
                assignedVehicle,
                actingStaff,
                remarks
        );
        trackingEventRepository.save(event);

        // 6. Compute Updated Rollup for Shipment
        String rollup = computeRollupForShipment(parcel.getShipment());

        TrackingScanResponse response = new TrackingScanResponse(
                parcel.getTrackingId(),
                formatStatus(currentStatus),
                formatStatus(targetStatus),
                assignedVehicle != null ? assignedVehicle.getVehicleId() : null,
                assignedVehicle != null ? assignedVehicle.getPlateNumber() : null,
                event.getEventTimestamp() != null ? event.getEventTimestamp() : LocalDateTime.now(),
                actingStaff.getFullName(),
                parcel.getShipment().getShipmentId(),
                rollup
        );

        // 7. Broadcast real-time SSE event to all connected office/field browsers
        try {
            sseService.broadcastTrackingScan(response);
        } catch (Exception ignored) {}

        return response;
    }

    @Override
    public List<TrackingScanResponse> processBatchScan(BatchTrackingScanRequest request, String actingStaffUsername) {
        List<TrackingScanResponse> responses = new ArrayList<>();
        for (String trackingId : request.getTrackingIds()) {
            TrackingScanRequest singleReq = new TrackingScanRequest(
                    trackingId,
                    request.getTargetStatus(),
                    request.getVehicleId(),
                    request.getRemarks()
            );
            responses.add(processStatusScan(singleReq, actingStaffUsername));
        }
        return responses;
    }

    private void validateStateTransition(ParcelStatus current, ParcelStatus target, String trackingId) {
        switch (current) {
            case REGISTERED:
                if (target != ParcelStatus.QR_GENERATED && target != ParcelStatus.LOADED_ON_TRUCK) {
                    throw new IllegalStateException(String.format(
                            "Invalid status transition for %s: Cannot move from REGISTERED directly to %s. Expected next status is QR_GENERATED or LOADED_ON_TRUCK.",
                            trackingId, target));
                }
                break;
            case QR_GENERATED:
                if (target != ParcelStatus.LOADED_ON_TRUCK) {
                    throw new IllegalStateException(String.format(
                            "Invalid status transition for %s: Cannot move from QR_GENERATED directly to %s. Expected next status is LOADED_ON_TRUCK.",
                            trackingId, target));
                }
                break;
            case LOADED_ON_TRUCK:
                if (target != ParcelStatus.ARRIVED_AT_TNL) {
                    throw new IllegalStateException(String.format(
                            "Invalid status transition for %s: Cannot move from LOADED_ON_TRUCK directly to %s. Expected next status is ARRIVED_AT_TNL.",
                            trackingId, target));
                }
                break;
            case ARRIVED_AT_TNL:
                if (target != ParcelStatus.LOADED_TO_HAULER) {
                    throw new IllegalStateException(String.format(
                            "Invalid status transition for %s: Cannot move from ARRIVED_AT_TNL directly to %s. Expected next status is LOADED_TO_HAULER.",
                            trackingId, target));
                }
                break;
            case LOADED_TO_HAULER:
                throw new IllegalStateException(String.format(
                        "Parcel %s is already in terminal state LOADED_TO_HAULER. No further status transitions allowed.",
                        trackingId));
            default:
                break;
        }
    }

    private String computeRollupForShipment(Shipment shipment) {
        List<ParcelUnit> parcels = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipment.getShipmentId());
        if (parcels.isEmpty()) return "0 / 0 Registered";

        int total = parcels.size();
        Map<ParcelStatus, Long> counts = parcels.stream()
                .collect(Collectors.groupingBy(ParcelUnit::getCurrentStatus, Collectors.counting()));

        if (counts.containsKey(ParcelStatus.LOADED_TO_HAULER)) {
            return counts.get(ParcelStatus.LOADED_TO_HAULER) + " / " + total + " Loaded to Hauler";
        }
        if (counts.containsKey(ParcelStatus.ARRIVED_AT_TNL)) {
            return counts.get(ParcelStatus.ARRIVED_AT_TNL) + " / " + total + " Arrived at TNL";
        }
        if (counts.containsKey(ParcelStatus.LOADED_ON_TRUCK)) {
            return counts.get(ParcelStatus.LOADED_ON_TRUCK) + " / " + total + " Loaded on Truck";
        }
        if (counts.containsKey(ParcelStatus.QR_GENERATED)) {
            return counts.get(ParcelStatus.QR_GENERATED) + " / " + total + " QR Generated";
        }

        long c = counts.getOrDefault(ParcelStatus.REGISTERED, (long) total);
        return c + " / " + total + " Registered";
    }

    private String formatStatus(ParcelStatus status) {
        if (status == null) return "Registered";
        switch (status) {
            case QR_GENERATED: return "QR Generated";
            case LOADED_ON_TRUCK: return "Loaded on Truck";
            case ARRIVED_AT_TNL: return "Arrived at TNL";
            case LOADED_TO_HAULER: return "Loaded to Hauler";
            case REGISTERED:
            default: return "Registered";
        }
    }
}
