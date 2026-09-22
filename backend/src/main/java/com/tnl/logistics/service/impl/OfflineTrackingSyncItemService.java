package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.OfflineTrackingSyncItemRequest;
import com.tnl.logistics.dto.OfflineTrackingSyncItemResponse;
import com.tnl.logistics.dto.TrackingScanResponse;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.OfflineScanReceipt;
import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.ParcelUnit;
import com.tnl.logistics.model.TrackingEvent;
import com.tnl.logistics.model.Vehicle;
import com.tnl.logistics.repository.OfflineScanReceiptRepository;
import com.tnl.logistics.repository.ParcelUnitRepository;
import com.tnl.logistics.repository.TrackingEventRepository;
import com.tnl.logistics.repository.VehicleRepository;
import com.tnl.logistics.service.SseService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;

@Service
public class OfflineTrackingSyncItemService {
    private final OfflineScanReceiptRepository receiptRepository;
    private final ParcelUnitRepository parcelRepository;
    private final TrackingEventRepository trackingEventRepository;
    private final VehicleRepository vehicleRepository;
    private final SseService sseService;

    public OfflineTrackingSyncItemService(OfflineScanReceiptRepository receiptRepository,
                                          ParcelUnitRepository parcelRepository,
                                          TrackingEventRepository trackingEventRepository,
                                          VehicleRepository vehicleRepository,
                                          SseService sseService) {
        this.receiptRepository = receiptRepository;
        this.parcelRepository = parcelRepository;
        this.trackingEventRepository = trackingEventRepository;
        this.vehicleRepository = vehicleRepository;
        this.sseService = sseService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public OfflineTrackingSyncItemResponse process(OfflineTrackingSyncItemRequest request, AppUser actor) {
        String trackingId = request.trackingId().trim().toUpperCase();
        String vehicleId = request.vehicleId() == null ? null : request.vehicleId().trim().toUpperCase();
        String fingerprint = fingerprint(actor.getUserId(), trackingId, request.targetStatus(), vehicleId,
                request.capturedAt(), request.clientSequence());
        String eventId = java.util.UUID.fromString(request.clientEventId()).toString();

        OfflineScanReceipt existing = receiptRepository.findById(eventId).orElse(null);
        if (existing != null) {
            return replayReceipt(existing, actor.getUserId(), fingerprint, trackingId, true);
        }
        TrackingEvent permanentEvent = trackingEventRepository.findByClientEventId(eventId).orElse(null);
        if (permanentEvent != null) {
            if (!fingerprint.equals(permanentEvent.getClientRequestFingerprint())) {
                return keyReuse(eventId, trackingId);
            }
            return new OfflineTrackingSyncItemResponse(eventId, trackingId, "APPLIED", "TRANSITION_APPLIED", false,
                    true, permanentEvent.getStatus().name(), vehicleId(permanentEvent.getVehicle()), toInstant(permanentEvent.getEventTimestamp()));
        }

        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        OfflineScanReceipt receipt = new OfflineScanReceipt(eventId, actor.getUserId(), fingerprint, trackingId,
                request.targetStatus().name(), vehicleId, LocalDateTime.ofInstant(request.capturedAt(), ZoneOffset.UTC),
                request.clientSequence(), now);
        receiptRepository.saveAndFlush(receipt);

        ParcelUnit parcel = parcelRepository.findByIdWithPessimisticLock(trackingId).orElse(null);
        if (parcel == null) {
            return finish(receipt, eventId, trackingId, "REJECTED", "PARCEL_NOT_FOUND", null, null, null);
        }
        ParcelStatus current = parcel.getCurrentStatus();
        if (current == request.targetStatus()) {
            if (current == ParcelStatus.LOADED_ON_TRUCK && !sameVehicle(parcel.getCurrentVehicle(), vehicleId)) {
                return finish(receipt, eventId, trackingId, "CONFLICT", "VEHICLE_MISMATCH", current, parcel.getCurrentVehicle(), null);
            }
            return finish(receipt, eventId, trackingId, "ALREADY_APPLIED", "STATE_ALREADY_APPLIED", current, parcel.getCurrentVehicle(), null);
        }
        if (rank(request.targetStatus()) < rank(current)) {
            return finish(receipt, eventId, trackingId, "STALE_STATE", "STALE_STATE", current, parcel.getCurrentVehicle(), null);
        }
        if (!isNext(current, request.targetStatus())) {
            return finish(receipt, eventId, trackingId, "REJECTED", "INVALID_TRANSITION", current, parcel.getCurrentVehicle(), null);
        }

        Vehicle vehicle = null;
        if (request.targetStatus() == ParcelStatus.LOADED_ON_TRUCK) {
            vehicle = vehicleRepository.findById(vehicleId).orElse(null);
            if (vehicle == null) return finish(receipt, eventId, trackingId, "REJECTED", "VEHICLE_NOT_FOUND", current, null, null);
            if (Boolean.FALSE.equals(vehicle.getActive())) return finish(receipt, eventId, trackingId, "REJECTED", "VEHICLE_INACTIVE", current, null, null);
            parcel.setCurrentVehicle(vehicle);
        } else {
            parcel.setCurrentVehicle(null);
        }
        parcel.setCurrentStatus(request.targetStatus());
        TrackingEvent event = new TrackingEvent(parcel, request.targetStatus(), vehicle, actor,
                "Offline status scan synchronized to " + request.targetStatus().name());
        event.setClientEventId(eventId);
        event.setClientCapturedAt(LocalDateTime.ofInstant(request.capturedAt(), ZoneOffset.UTC));
        event.setClientRequestFingerprint(fingerprint);
        event.setScanSource("OFFLINE");
        trackingEventRepository.saveAndFlush(event);
        OfflineTrackingSyncItemResponse response = finish(receipt, eventId, trackingId, "APPLIED", "TRANSITION_APPLIED",
                request.targetStatus(), vehicle, event.getEventId());
        registerSseAfterCommit(parcel, current, request.targetStatus(), vehicle, actor, event);
        return response;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public OfflineTrackingSyncItemResponse recoverDuplicateReservation(OfflineTrackingSyncItemRequest request, AppUser actor) {
        String trackingId = request.trackingId().trim().toUpperCase();
        String vehicleId = request.vehicleId() == null ? null : request.vehicleId().trim().toUpperCase();
        String eventId = java.util.UUID.fromString(request.clientEventId()).toString();
        String fingerprint = fingerprint(actor.getUserId(), trackingId, request.targetStatus(), vehicleId,
                request.capturedAt(), request.clientSequence());
        for (int attempt = 0; attempt < 3; attempt++) {
            OfflineScanReceipt receipt = receiptRepository.findByClientEventIdForRecovery(eventId).orElse(null);
            if (receipt != null) {
                return replayReceipt(receipt, actor.getUserId(), fingerprint, trackingId, true);
            }
            TrackingEvent event = trackingEventRepository.findByClientEventId(eventId).orElse(null);
            if (event != null) {
                if (!fingerprint.equals(event.getClientRequestFingerprint())) return keyReuse(eventId, trackingId);
                return new OfflineTrackingSyncItemResponse(eventId, trackingId, "APPLIED", "TRANSITION_APPLIED", false,
                        true, event.getStatus().name(), vehicleId(event.getVehicle()), toInstant(event.getEventTimestamp()));
            }
            if (attempt < 2) waitForCompetingTransaction(attempt);
        }
        return null;
    }

    private void waitForCompetingTransaction(int attempt) {
        try {
            Thread.sleep(25L * (attempt + 1));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
    }

    private OfflineTrackingSyncItemResponse replayReceipt(OfflineScanReceipt receipt, String ownerId, String fingerprint,
                                                           String requestedTrackingId, boolean replayed) {
        if (!ownerId.equals(receipt.getOwnerUserId()) || !fingerprint.equals(receipt.getRequestFingerprint())) {
            return keyReuse(receipt.getClientEventId(), requestedTrackingId);
        }
        return new OfflineTrackingSyncItemResponse(receipt.getClientEventId(), receipt.getRequestedTrackingId(), receipt.getOutcome(),
                receipt.getOutcomeCode(), false, replayed, receipt.getServerStatus(), receipt.getServerVehicleId(), toInstant(receipt.getProcessedAt()));
    }

    private OfflineTrackingSyncItemResponse keyReuse(String eventId, String trackingId) {
        return new OfflineTrackingSyncItemResponse(eventId, trackingId, "REJECTED", "IDEMPOTENCY_KEY_REUSED", false, false, null, null, null);
    }

    private OfflineTrackingSyncItemResponse finish(OfflineScanReceipt receipt, String eventId, String trackingId,
                                                    String outcome, String code, ParcelStatus status, Vehicle vehicle, Long eventIdValue) {
        receipt.setOutcome(outcome);
        receipt.setOutcomeCode(code);
        receipt.setServerStatus(status == null ? null : status.name());
        receipt.setServerVehicleId(vehicleId(vehicle));
        receipt.setTrackingEventId(eventIdValue);
        receiptRepository.saveAndFlush(receipt);
        return new OfflineTrackingSyncItemResponse(eventId, trackingId, outcome, code, false, false,
                receipt.getServerStatus(), receipt.getServerVehicleId(), toInstant(receipt.getProcessedAt()));
    }

    private void registerSseAfterCommit(ParcelUnit parcel, ParcelStatus previous, ParcelStatus target, Vehicle vehicle,
                                        AppUser actor, TrackingEvent event) {
        TrackingScanResponse response = new TrackingScanResponse(parcel.getTrackingId(), previous.name(), target.name(), previous.name(),
                target.name(), true, vehicleId(vehicle), vehicle == null ? null : vehicle.getPlateNumber(),
                event.getEventTimestamp() == null ? LocalDateTime.now(ZoneOffset.UTC) : event.getEventTimestamp(), actor.getFullName(),
                parcel.getShipment().getShipmentId(), target.name());
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { sseService.broadcastTrackingScan(response); }
        });
    }

    private static boolean isNext(ParcelStatus current, ParcelStatus target) { return rank(target) == rank(current) + 1; }
    private static int rank(ParcelStatus status) { return switch (status) {
        case REGISTERED -> 0; case QR_GENERATED -> 1; case LOADED_ON_TRUCK -> 2;
        case ARRIVED_AT_TNL -> 3; case LOADED_TO_HAULER -> 4; case COMPLETED -> 5; }; }
    private static boolean sameVehicle(Vehicle vehicle, String id) { return vehicle != null && vehicle.getVehicleId().equals(id); }
    private static String vehicleId(Vehicle vehicle) { return vehicle == null ? null : vehicle.getVehicleId(); }
    private static Instant toInstant(LocalDateTime value) { return value == null ? null : value.toInstant(ZoneOffset.UTC); }
    private static String fingerprint(String owner, String tracking, ParcelStatus status, String vehicle, Instant capturedAt, Long sequence) {
        try {
            String value = owner + "|" + tracking + "|" + status.name() + "|" + (vehicle == null ? "" : vehicle)
                    + "|" + capturedAt.toString() + "|" + sequence;
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) { throw new IllegalStateException("Unable to fingerprint offline scan", ex); }
    }
}
