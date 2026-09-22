package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.ParcelUnitRepository;
import com.tnl.logistics.repository.TrackingEventRepository;
import com.tnl.logistics.repository.VehicleRepository;
import com.tnl.logistics.service.SseService;
import com.tnl.logistics.service.TrackingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

/**
 * Service implementing 5-state parcel status flow, sequential validation,
 * vehicle fleet assignment, append-only audit event logging, and real-time SSE broadcasting.
 */
@Service
@Transactional
public class TrackingServiceImpl implements TrackingService {

    private static final Logger log = LoggerFactory.getLogger(TrackingServiceImpl.class);

    private final ParcelUnitRepository parcelUnitRepository;
    private final TrackingEventRepository trackingEventRepository;
    private final VehicleRepository vehicleRepository;
    private final AppUserRepository appUserRepository;
    private final SseService sseService;
    private final OfflineTrackingSyncItemService offlineTrackingSyncItemService;
    private final Map<String, ReentrantLock> offlineEventLocks = new ConcurrentHashMap<>();

    public TrackingServiceImpl(ParcelUnitRepository parcelUnitRepository,
                               TrackingEventRepository trackingEventRepository,
                               VehicleRepository vehicleRepository,
                               AppUserRepository appUserRepository,
                               SseService sseService,
                               OfflineTrackingSyncItemService offlineTrackingSyncItemService) {
        this.parcelUnitRepository = parcelUnitRepository;
        this.trackingEventRepository = trackingEventRepository;
        this.vehicleRepository = vehicleRepository;
        this.appUserRepository = appUserRepository;
        this.sseService = sseService;
        this.offlineTrackingSyncItemService = offlineTrackingSyncItemService;
    }

    @Override
    @Transactional(readOnly = true)
    public TrackingScanContextResponse getScanContext(String trackingId) {
        if (trackingId == null || trackingId.trim().isEmpty()) {
            throw new IllegalArgumentException("Tracking ID is required");
        }
        ParcelUnit parcel = parcelUnitRepository.findById(trackingId.trim())
                .orElseThrow(() -> new IllegalArgumentException("Parcel unit not found: " + trackingId));

        ParcelStatus currentStatus = parcel.getCurrentStatus();
        String nextStatusCode = null;
        String nextStatusLabel = null;
        boolean requiresVehicle = false;
        boolean canScan = false;

        switch (currentStatus) {
            case REGISTERED:
                nextStatusCode = ParcelStatus.QR_GENERATED.name();
                nextStatusLabel = formatStatusDisplay(ParcelStatus.QR_GENERATED);
                requiresVehicle = false;
                canScan = true;
                break;
            case QR_GENERATED:
                nextStatusCode = ParcelStatus.LOADED_ON_TRUCK.name();
                nextStatusLabel = formatStatusDisplay(ParcelStatus.LOADED_ON_TRUCK);
                requiresVehicle = true;
                canScan = true;
                break;
            case LOADED_ON_TRUCK:
                nextStatusCode = ParcelStatus.ARRIVED_AT_TNL.name();
                nextStatusLabel = formatStatusDisplay(ParcelStatus.ARRIVED_AT_TNL);
                requiresVehicle = false;
                canScan = true;
                break;
            case ARRIVED_AT_TNL:
                nextStatusCode = ParcelStatus.LOADED_TO_HAULER.name();
                nextStatusLabel = formatStatusDisplay(ParcelStatus.LOADED_TO_HAULER);
                requiresVehicle = false;
                canScan = true;
                break;
            case LOADED_TO_HAULER:
            case COMPLETED:
            default:
                nextStatusCode = null;
                nextStatusLabel = null;
                requiresVehicle = false;
                canScan = false;
                break;
        }

        Shipment shipment = parcel.getShipment();
        String shipmentId = shipment != null ? shipment.getShipmentId() : null;
        Integer packageIndex = parcel.getSeq() != null ? parcel.getSeq() : 1;
        Integer packageCount = (shipment != null && shipment.getQuantity() != null) ? shipment.getQuantity() : 1;
        Vehicle currentVehicle = parcel.getCurrentVehicle();
        String assignedVehicleId = currentVehicle != null ? currentVehicle.getVehicleId() : null;
        String assignedVehiclePlateNumber = currentVehicle != null ? currentVehicle.getPlateNumber() : null;

        return new TrackingScanContextResponse(
                parcel.getTrackingId(),
                shipmentId,
                packageIndex,
                packageCount,
                currentStatus.name(),
                formatStatusDisplay(currentStatus),
                nextStatusCode,
                nextStatusLabel,
                requiresVehicle,
                assignedVehicleId,
                assignedVehiclePlateNumber,
                canScan
        );
    }

    @Override
    public TrackingScanResponse processStatusScan(TrackingScanRequest request, String actingStaffUserId) {
        if (request == null || request.getTrackingId() == null || request.getTrackingId().trim().isEmpty()) {
            throw new IllegalArgumentException("Tracking ID is required");
        }
        if (request.getTargetStatus() == null) {
            throw new IllegalArgumentException("Target status is required");
        }

        String normalizedTrackingId = request.getTrackingId().trim();
        String normalizedVehicleId = request.getVehicleId() != null ? request.getVehicleId().trim() : null;

        if (request.getTargetStatus() == ParcelStatus.LOADED_ON_TRUCK) {
            if (normalizedVehicleId == null || normalizedVehicleId.isEmpty()) {
                throw new IllegalArgumentException("A valid vehicleId is required when transitioning to LOADED_ON_TRUCK");
            }
        }

        ParcelUnit parcel = parcelUnitRepository.findByIdWithPessimisticLock(normalizedTrackingId)
                .orElseThrow(() -> new IllegalArgumentException("Parcel unit not found: " + normalizedTrackingId));

        AppUser actingStaff = appUserRepository.findById(actingStaffUserId)
                .orElseThrow(() -> new IllegalArgumentException("Staff user not found: " + actingStaffUserId));

        // Pre-validate transition first
        if (parcel.getCurrentStatus() != request.getTargetStatus()) {
            validateStateTransition(parcel.getCurrentStatus(), request.getTargetStatus(), parcel.getTrackingId());
        }

        // Pre-validate vehicle entity only if transitioning
        Vehicle resolvedVehicle = null;
        if (request.getTargetStatus() == ParcelStatus.LOADED_ON_TRUCK && parcel.getCurrentStatus() != ParcelStatus.LOADED_ON_TRUCK) {
            resolvedVehicle = vehicleRepository.findById(normalizedVehicleId)
                    .orElseThrow(() -> new IllegalArgumentException("Vehicle not found: " + normalizedVehicleId));
            if (Boolean.FALSE.equals(resolvedVehicle.getActive())) {
                throw new IllegalStateException("Vehicle " + normalizedVehicleId + " is inactive and cannot be assigned to shipments");
            }
        }

        ScanTransitionResult result = processStatusScanInternal(
                parcel,
                request.getTargetStatus(),
                normalizedVehicleId,
                resolvedVehicle,
                request.getRemarks(),
                actingStaff
        );

        if (result.isTransitionApplied()) {
            registerBroadcastsAfterCommit(Collections.singletonList(result.getResponse()));
        }

        return result.getResponse();
    }

    @Override
    public List<TrackingScanResponse> processBatchScan(BatchTrackingScanRequest request, String actingStaffUserId) {
        if (request == null || request.getTrackingIds() == null || request.getTrackingIds().isEmpty()) {
            throw new IllegalArgumentException("At least one tracking ID must be provided");
        }
        if (request.getTrackingIds().size() > 100) {
            throw new IllegalArgumentException("Batch scan cannot exceed 100 tracking IDs");
        }
        if (request.getTargetStatus() == null) {
            throw new IllegalArgumentException("Target status is required");
        }

        String normalizedVehicleId = request.getVehicleId() != null ? request.getVehicleId().trim() : null;
        if (request.getTargetStatus() == ParcelStatus.LOADED_ON_TRUCK) {
            if (normalizedVehicleId == null || normalizedVehicleId.isEmpty()) {
                throw new IllegalArgumentException("A valid vehicleId is required when transitioning to LOADED_ON_TRUCK");
            }
        }

        List<String> rawIds = request.getTrackingIds();
        List<String> normalizedIds = new ArrayList<>(rawIds.size());
        Set<String> seen = new HashSet<>();
        for (String raw : rawIds) {
            if (raw == null || raw.trim().isEmpty()) {
                throw new IllegalArgumentException("Tracking ID must not be blank");
            }
            String trimmed = raw.trim();
            if (!seen.add(trimmed)) {
                throw new IllegalArgumentException("Duplicate tracking ID in batch: " + trimmed);
            }
            normalizedIds.add(trimmed);
        }

        AppUser actingStaff = appUserRepository.findById(actingStaffUserId)
                .orElseThrow(() -> new IllegalArgumentException("Staff user not found: " + actingStaffUserId));

        // Acquire parcel locks in sorted Tracking ID order to prevent deadlocks
        List<String> sortedIds = new ArrayList<>(normalizedIds);
        Collections.sort(sortedIds);
        Map<String, ParcelUnit> lockedParcels = new HashMap<>();
        for (String id : sortedIds) {
            ParcelUnit p = parcelUnitRepository.findByIdWithPessimisticLock(id)
                    .orElseThrow(() -> new IllegalArgumentException("Parcel unit not found: " + id));
            lockedParcels.put(id, p);
        }

        // Pre-validate all transitions before mutating entities
        boolean hasNewTransition = false;
        for (String id : normalizedIds) {
            ParcelUnit parcel = lockedParcels.get(id);
            ParcelStatus currentStatus = parcel.getCurrentStatus();
            if (currentStatus == request.getTargetStatus()) {
                if (request.getTargetStatus() == ParcelStatus.LOADED_ON_TRUCK) {
                    Vehicle currentVehicle = parcel.getCurrentVehicle();
                    String currentVehicleId = currentVehicle != null ? currentVehicle.getVehicleId() : null;
                    if (currentVehicleId == null || !currentVehicleId.equals(normalizedVehicleId)) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                String.format("Parcel %s is already LOADED_ON_TRUCK with vehicle %s, cannot assign different vehicle %s",
                                        parcel.getTrackingId(), currentVehicleId, normalizedVehicleId));
                    }
                }
            } else {
                validateStateTransition(currentStatus, request.getTargetStatus(), parcel.getTrackingId());
                hasNewTransition = true;
            }
        }

        // Resolve vehicle only once if at least one parcel needs a new LOADED_ON_TRUCK transition
        Vehicle resolvedVehicle = null;
        if (request.getTargetStatus() == ParcelStatus.LOADED_ON_TRUCK && hasNewTransition) {
            resolvedVehicle = vehicleRepository.findById(normalizedVehicleId)
                    .orElseThrow(() -> new IllegalArgumentException("Vehicle not found: " + normalizedVehicleId));
            if (Boolean.FALSE.equals(resolvedVehicle.getActive())) {
                throw new IllegalStateException("Vehicle " + normalizedVehicleId + " is inactive and cannot be assigned to shipments");
            }
        }

        List<TrackingScanResponse> responses = new ArrayList<>(normalizedIds.size());
        List<TrackingScanResponse> newlyTransitioned = new ArrayList<>();

        // Process in original request order
        for (String id : normalizedIds) {
            ParcelUnit parcel = lockedParcels.get(id);
            ScanTransitionResult result = processStatusScanInternal(
                    parcel,
                    request.getTargetStatus(),
                    normalizedVehicleId,
                    resolvedVehicle,
                    request.getRemarks(),
                    actingStaff
            );
            responses.add(result.getResponse());
            if (result.isTransitionApplied()) {
                newlyTransitioned.add(result.getResponse());
            }
        }

        if (!newlyTransitioned.isEmpty()) {
            registerBroadcastsAfterCommit(newlyTransitioned);
        }

        return responses;
    }

    @Override
    @Transactional(readOnly = true)
    public OfflineTrackingSyncResponse processOfflineSync(OfflineTrackingSyncRequest request, String actingStaffUserId) {
        AppUser actor = appUserRepository.findById(actingStaffUserId)
                .orElseThrow(() -> new IllegalArgumentException("Staff user not found"));
        if (!Boolean.TRUE.equals(actor.getActive()) || actor.getRole() != UserRole.FIELD_STAFF) {
            throw new org.springframework.security.access.AccessDeniedException("Field Staff access is required");
        }
        Set<String> eventIds = new HashSet<>();
        for (OfflineTrackingSyncItemRequest item : request.items()) {
            if (!eventIds.add(java.util.UUID.fromString(item.clientEventId()).toString())) {
                throw new IllegalArgumentException("Duplicate clientEventId in batch");
            }
        }
        List<OfflineTrackingSyncItemRequest> ordered = new ArrayList<>(request.items());
        ordered.sort(Comparator.comparing(OfflineTrackingSyncItemRequest::clientSequence));
        List<OfflineTrackingSyncItemResponse> results = new ArrayList<>(ordered.size());
        Set<String> failedParcels = new HashSet<>();
        for (OfflineTrackingSyncItemRequest item : ordered) {
            String trackingId = item.trackingId().trim().toUpperCase();
            if (failedParcels.contains(trackingId)) {
                results.add(new OfflineTrackingSyncItemResponse(item.clientEventId(), trackingId, "BLOCKED_BY_PRIOR_FAILURE",
                        "PRIOR_ITEM_FAILED", false, false, null, null, null));
                continue;
            }
            try {
                OfflineTrackingSyncItemResponse result = processOfflineItemWithEventLock(item, actor);
                results.add(result);
                if (!"APPLIED".equals(result.outcome()) && !"ALREADY_APPLIED".equals(result.outcome())) {
                    failedParcels.add(trackingId);
                }
            } catch (org.springframework.dao.DataIntegrityViolationException ex) {
                OfflineTrackingSyncItemResponse recovered = offlineTrackingSyncItemService.recoverDuplicateReservation(item, actor);
                if (recovered != null) {
                    results.add(recovered);
                    if (!"APPLIED".equals(recovered.outcome()) && !"ALREADY_APPLIED".equals(recovered.outcome())) {
                        failedParcels.add(trackingId);
                    }
                    continue;
                }
                results.add(new OfflineTrackingSyncItemResponse(item.clientEventId(), trackingId, "RETRYABLE_ERROR",
                        "TEMPORARY_FAILURE", true, false, null, null, null));
            } catch (org.springframework.dao.PessimisticLockingFailureException ex) {
                results.add(new OfflineTrackingSyncItemResponse(item.clientEventId(), trackingId, "RETRYABLE_ERROR",
                        "TEMPORARY_FAILURE", true, false, null, null, null));
            }
        }
        int applied = (int) results.stream().filter(value -> "APPLIED".equals(value.outcome())).count();
        int alreadyApplied = (int) results.stream().filter(value -> "ALREADY_APPLIED".equals(value.outcome())).count();
        int retryable = (int) results.stream().filter(OfflineTrackingSyncItemResponse::retryable).count();
        return new OfflineTrackingSyncResponse(results.size(), applied, alreadyApplied,
                results.size() - applied - alreadyApplied - retryable, retryable, results);
    }

    private OfflineTrackingSyncItemResponse processOfflineItemWithEventLock(OfflineTrackingSyncItemRequest item, AppUser actor) {
        String eventId = java.util.UUID.fromString(item.clientEventId()).toString();
        ReentrantLock eventLock = offlineEventLocks.computeIfAbsent(eventId, ignored -> new ReentrantLock());
        eventLock.lock();
        try {
            return offlineTrackingSyncItemService.process(item, actor);
        } finally {
            eventLock.unlock();
            if (!eventLock.hasQueuedThreads()) {
                offlineEventLocks.remove(eventId, eventLock);
            }
        }
    }

    private ScanTransitionResult processStatusScanInternal(
            ParcelUnit parcel,
            ParcelStatus targetStatus,
            String requestedVehicleId,
            Vehicle resolvedVehicle,
            String remarks,
            AppUser actingStaff) {

        ParcelStatus currentStatus = parcel.getCurrentStatus();

        // 1. Idempotent check: Parcel is already at target status
        if (currentStatus == targetStatus) {
            if (targetStatus == ParcelStatus.LOADED_ON_TRUCK) {
                Vehicle currentVehicle = parcel.getCurrentVehicle();
                String currentVehicleId = currentVehicle != null ? currentVehicle.getVehicleId() : null;
                if (currentVehicleId == null || !currentVehicleId.equals(requestedVehicleId)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            String.format("Parcel %s is already LOADED_ON_TRUCK with vehicle %s, cannot assign different vehicle %s",
                                    parcel.getTrackingId(), currentVehicleId, requestedVehicleId));
                }
            }
            String rollup = computeRollupForShipment(parcel.getShipment());
            Vehicle v = parcel.getCurrentVehicle();
            TrackingScanResponse resp = new TrackingScanResponse(
                    parcel.getTrackingId(),
                    formatStatus(currentStatus),
                    formatStatus(targetStatus),
                    currentStatus.name(),
                    targetStatus.name(),
                    false,
                    v != null ? v.getVehicleId() : null,
                    v != null ? v.getPlateNumber() : null,
                    LocalDateTime.now(),
                    actingStaff.getFullName(),
                    parcel.getShipment().getShipmentId(),
                    rollup
            );
            return new ScanTransitionResult(resp, false);
        }

        // 2. Validate Sequential 5-State Transition
        validateStateTransition(currentStatus, targetStatus, parcel.getTrackingId());

        // 3. Handle Vehicle Association & Validation
        Vehicle assignedVehicle = null;
        if (targetStatus == ParcelStatus.LOADED_ON_TRUCK) {
            assignedVehicle = resolvedVehicle;
            parcel.setCurrentVehicle(assignedVehicle);
        } else if (targetStatus == ParcelStatus.ARRIVED_AT_TNL || targetStatus == ParcelStatus.LOADED_TO_HAULER) {
            parcel.setCurrentVehicle(null);
        }

        // 4. Update Current Status & Save Entity
        parcel.setCurrentStatus(targetStatus);
        parcelUnitRepository.save(parcel);

        // 5. Append-only Tracking Audit Event
        String finalRemarks = (remarks != null && !remarks.trim().isEmpty())
                ? remarks.trim()
                : "Status scan updated to " + formatStatus(targetStatus);
        TrackingEvent event = new TrackingEvent(
                parcel,
                targetStatus,
                assignedVehicle,
                actingStaff,
                finalRemarks
        );
        trackingEventRepository.save(event);

        // 6. Compute Updated Rollup for Shipment
        String rollup = computeRollupForShipment(parcel.getShipment());

        TrackingScanResponse response = new TrackingScanResponse(
                parcel.getTrackingId(),
                formatStatus(currentStatus),
                formatStatus(targetStatus),
                currentStatus.name(),
                targetStatus.name(),
                true,
                assignedVehicle != null ? assignedVehicle.getVehicleId() : null,
                assignedVehicle != null ? assignedVehicle.getPlateNumber() : null,
                event.getEventTimestamp() != null ? event.getEventTimestamp() : LocalDateTime.now(),
                actingStaff.getFullName(),
                parcel.getShipment().getShipmentId(),
                rollup
        );

        return new ScanTransitionResult(response, true);
    }

    private void registerBroadcastsAfterCommit(List<TrackingScanResponse> responses) {
        if (responses == null || responses.isEmpty()) {
            return;
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    for (TrackingScanResponse resp : responses) {
                        try {
                            sseService.broadcastTrackingScan(resp);
                        } catch (Exception ex) {
                            log.warn("Failed to broadcast tracking scan SSE for {}: {}", resp.getTrackingId(), ex.getMessage());
                        }
                    }
                }
            });
        } else {
            for (TrackingScanResponse resp : responses) {
                try {
                    sseService.broadcastTrackingScan(resp);
                } catch (Exception ex) {
                    log.warn("Failed to broadcast tracking scan SSE for {}: {}", resp.getTrackingId(), ex.getMessage());
                }
            }
        }
    }

    private void validateStateTransition(ParcelStatus current, ParcelStatus target, String trackingId) {
        switch (current) {
            case REGISTERED:
                if (target != ParcelStatus.QR_GENERATED) {
                    throw new IllegalStateException(String.format(
                            "Invalid status transition for %s: Cannot move from REGISTERED directly to %s. Expected next status is QR_GENERATED.",
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
                if (target != ParcelStatus.COMPLETED) {
                    throw new IllegalStateException(String.format(
                            "Invalid status transition for %s: Cannot move from LOADED_TO_HAULER directly to %s. Expected next status is COMPLETED.",
                            trackingId, target));
                }
                break;
            case COMPLETED:
                throw new IllegalStateException(String.format(
                        "Parcel %s is already in terminal state COMPLETED. No further status transitions allowed.",
                        trackingId));
            default:
                break;
        }
    }

    private String computeRollupForShipment(Shipment shipment) {
        if (shipment == null) return "0 / 0 Registered";
        List<ParcelUnit> parcels = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipment.getShipmentId());
        if (parcels.isEmpty()) return "0 / 0 Registered";

        int total = parcels.size();
        Map<ParcelStatus, Long> counts = parcels.stream()
                .collect(Collectors.groupingBy(ParcelUnit::getCurrentStatus, Collectors.counting()));

        if (counts.containsKey(ParcelStatus.COMPLETED)) {
            return counts.get(ParcelStatus.COMPLETED) + " / " + total + " Completed";
        }
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

    @Override
    @Transactional(readOnly = true)
    public Page<TrackingLogEntryResponse> getTrackingLogs(String search, ParcelStatus status,
                                                          LocalDate startDate, LocalDate endDate,
                                                          Pageable pageable) {
        String cleanSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;

        LocalDateTime startDateTime = (startDate != null) ? startDate.atStartOfDay() : null;
        LocalDateTime endDateTime = (endDate != null) ? endDate.atTime(23, 59, 59, 999999999) : null;

        Page<TrackingEvent> eventsPage = trackingEventRepository.searchTrackingEvents(
                cleanSearch, status, startDateTime, endDateTime, pageable);

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM d, yyyy · h:mm a", Locale.ENGLISH);

        return eventsPage.map(event -> {
            ParcelUnit parcel = event.getParcelUnit();
            Shipment shipment = (parcel != null) ? parcel.getShipment() : null;
            AppUser staff = event.getStaff();
            Vehicle vehicle = event.getVehicle();

            String packageDisplay = (parcel != null && shipment != null && shipment.getQuantity() != null)
                    ? parcel.getSeq() + " of " + shipment.getQuantity()
                    : "1 of 1";

            String formattedTimestamp = (event.getEventTimestamp() != null)
                    ? event.getEventTimestamp().format(formatter)
                    : "";

            String statusDisplay = formatStatusDisplay(event.getStatus());

            return new TrackingLogEntryResponse(
                    event.getEventId(),
                    (parcel != null) ? parcel.getTrackingId() : null,
                    (shipment != null) ? shipment.getShipmentId() : null,
                    packageDisplay,
                    (event.getStatus() != null) ? event.getStatus().name() : null,
                    statusDisplay,
                    (vehicle != null) ? vehicle.getVehicleId() : null,
                    (vehicle != null) ? vehicle.getPlateNumber() : null,
                    (staff != null) ? staff.getUsername() : null,
                    (staff != null) ? staff.getFullName() : null,
                    (staff != null && staff.getRole() != null) ? staff.getRole().name() : null,
                    (staff != null && staff.getStaffType() != null) ? staff.getStaffType().name() : null,
                    event.getRemarks(),
                    event.getEventTimestamp(),
                    formattedTimestamp
            );
        });
    }

    @Override
    @Transactional(readOnly = true)
    public TrackingMetricsResponse getTodayTrackingMetrics() {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(23, 59, 59, 999999999);

        long totalScans = trackingEventRepository.countOperationalScansBetween(startOfDay, endOfDay);
        long activeCouriers = trackingEventRepository.countDistinctCouriersBetween(startOfDay, endOfDay);
        long loadedOnTruck = trackingEventRepository.countStatusBetween(ParcelStatus.LOADED_ON_TRUCK, startOfDay, endOfDay);
        long handedToHauler = trackingEventRepository.countStatusBetween(ParcelStatus.LOADED_TO_HAULER, startOfDay, endOfDay);

        return new TrackingMetricsResponse(totalScans, activeCouriers, loadedOnTruck, handedToHauler);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PersonalTrackingEventResponse> getPersonalTrackingEvents(
            String actingStaffUserId,
            String search,
            ParcelStatus status,
            Pageable pageable) {
        String cleanSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;
        if (cleanSearch != null && cleanSearch.length() > 50) {
            cleanSearch = cleanSearch.substring(0, 50);
        }

        Page<TrackingEvent> eventsPage = trackingEventRepository.findPersonalEvents(
                actingStaffUserId, cleanSearch, status, pageable);

        return eventsPage.map(this::mapToPersonalTrackingEventResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public PersonalScanMetricsResponse getPersonalScanMetrics(String actingStaffUserId) {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(23, 59, 59, 999999999);

        List<Object[]> rows = trackingEventRepository.countPersonalEventsByStatusBetween(
                actingStaffUserId, startOfDay, endOfDay);

        long totalScans = 0;
        long loadedOnTruck = 0;
        long arrivedAtTnl = 0;
        long handedToHauler = 0;

        for (Object[] row : rows) {
            ParcelStatus status = (ParcelStatus) row[0];
            long count = ((Number) row[1]).longValue();
            totalScans += count;
            if (status == ParcelStatus.LOADED_ON_TRUCK) {
                loadedOnTruck = count;
            } else if (status == ParcelStatus.ARRIVED_AT_TNL) {
                arrivedAtTnl = count;
            } else if (status == ParcelStatus.LOADED_TO_HAULER) {
                handedToHauler = count;
            }
        }

        return new PersonalScanMetricsResponse(today, totalScans, loadedOnTruck, arrivedAtTnl, handedToHauler);
    }

    @Override
    @Transactional(readOnly = true)
    public PersonalParcelHistoryResponse getPersonalParcelHistory(String actingStaffUserId, String trackingId) {
        if (trackingId == null || trackingId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tracking ID is required");
        }
        String cleanTrackingId = trackingId.trim();

        if (!trackingEventRepository.hasStaffScannedParcel(cleanTrackingId, actingStaffUserId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Parcel unit not found in personal scan history");
        }

        ParcelUnit parcel = parcelUnitRepository.findById(cleanTrackingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Parcel unit not found in personal scan history"));

        List<TrackingEvent> events = trackingEventRepository.findPersonalEventsForParcel(
                cleanTrackingId, actingStaffUserId);

        List<PersonalTrackingEventResponse> eventResponses = events.stream()
                .map(this::mapToPersonalTrackingEventResponse)
                .collect(Collectors.toList());

        Shipment shipment = parcel.getShipment();
        String shipmentId = shipment != null ? shipment.getShipmentId() : null;
        Integer packageIndex = parcel.getSeq() != null ? parcel.getSeq() : 1;
        Integer packageCount = (shipment != null && shipment.getQuantity() != null) ? shipment.getQuantity() : 1;

        Vehicle currentVehicle = parcel.getCurrentVehicle();
        String currentVehicleId = currentVehicle != null ? currentVehicle.getVehicleId() : null;
        String currentVehiclePlateNumber = currentVehicle != null ? currentVehicle.getPlateNumber() : null;

        String currentStatusCode = parcel.getCurrentStatus() != null ? parcel.getCurrentStatus().name() : null;
        String currentStatusDisplay = formatStatusDisplay(parcel.getCurrentStatus());
        String labelStatusCode = parcel.getLabelStatus() != null ? parcel.getLabelStatus().name() : LabelStatus.NOT_PRINTED.name();
        String labelStatusDisplay = formatLabelStatus(parcel.getLabelStatus());

        return new PersonalParcelHistoryResponse(
                parcel.getTrackingId(),
                shipmentId,
                packageIndex,
                packageCount,
                currentStatusCode,
                currentStatusDisplay,
                labelStatusCode,
                labelStatusDisplay,
                currentVehicleId,
                currentVehiclePlateNumber,
                eventResponses
        );
    }

    private PersonalTrackingEventResponse mapToPersonalTrackingEventResponse(TrackingEvent event) {
        ParcelUnit parcel = event.getParcelUnit();
        Shipment shipment = parcel != null ? parcel.getShipment() : null;
        Vehicle vehicle = event.getVehicle();

        String trackingId = parcel != null ? parcel.getTrackingId() : null;
        String shipmentId = shipment != null ? shipment.getShipmentId() : null;
        Integer packageIndex = parcel != null && parcel.getSeq() != null ? parcel.getSeq() : 1;
        Integer packageCount = (shipment != null && shipment.getQuantity() != null) ? shipment.getQuantity() : 1;
        String statusCode = event.getStatus() != null ? event.getStatus().name() : null;
        String statusDisplay = formatStatusDisplay(event.getStatus());
        String vehicleId = vehicle != null ? vehicle.getVehicleId() : null;
        String vehiclePlateNumber = vehicle != null ? vehicle.getPlateNumber() : null;
        LocalDateTime timestamp = event.getEventTimestamp();
        String syncStatus = "SYNCED";

        return new PersonalTrackingEventResponse(
                event.getEventId(),
                trackingId,
                shipmentId,
                packageIndex,
                packageCount,
                statusCode,
                statusDisplay,
                vehicleId,
                vehiclePlateNumber,
                timestamp,
                syncStatus
        );
    }

    private String formatLabelStatus(LabelStatus labelStatus) {
        if (labelStatus == null) return "Pending";
        switch (labelStatus) {
            case PRINTED: return "Printed";
            case REPRINTED: return "Reprinted";
            case NOT_PRINTED:
            default: return "Pending";
        }
    }

    private String formatStatus(ParcelStatus status) {
        if (status == null) return "Registered";
        switch (status) {
            case QR_GENERATED: return "QR Generated";
            case LOADED_ON_TRUCK: return "Loaded on Truck";
            case ARRIVED_AT_TNL: return "Arrived at TNL";
            case LOADED_TO_HAULER: return "Loaded to Hauler";
            case COMPLETED: return "Completed";
            case REGISTERED:
            default: return "Registered";
        }
    }

    private String formatStatusDisplay(ParcelStatus status) {
        if (status == null) return "Registered";
        switch (status) {
            case QR_GENERATED: return "QR Generated";
            case LOADED_ON_TRUCK: return "Loaded on Truck";
            case ARRIVED_AT_TNL: return "Outload / Arrive TNL";
            case LOADED_TO_HAULER: return "Loaded to Hauler";
            case COMPLETED: return "Completed";
            case REGISTERED:
            default: return "Registered";
        }
    }

    private static class ScanTransitionResult {
        private final TrackingScanResponse response;
        private final boolean transitionApplied;

        public ScanTransitionResult(TrackingScanResponse response, boolean transitionApplied) {
            this.response = response;
            this.transitionApplied = transitionApplied;
        }

        public TrackingScanResponse getResponse() {
            return response;
        }

        public boolean isTransitionApplied() {
            return transitionApplied;
        }
    }
}
