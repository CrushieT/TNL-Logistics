package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.WaybillService;
import com.tnl.logistics.service.IdentifierCounterService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.AccessDeniedException;

/**
 * Service implementation for Waybill generation, custody state transitions, and Proof of Delivery.
 */
@Service
@Transactional
public class WaybillServiceImpl implements WaybillService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy");
    private static final String COMPLETION_DENIED_MESSAGE = "Waybill completion is not permitted.";
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy · h:mm a");

    private final WaybillRepository waybillRepository;
    private final ShipmentRepository shipmentRepository;
    private final ParcelUnitRepository parcelUnitRepository;
    private final TrackingEventRepository trackingEventRepository;
    private final AppUserRepository appUserRepository;
    private final IdentifierCounterService identifierCounterService;
    private final com.tnl.logistics.service.ParcelCustodyLocks custodyLocks;
    private final WaybillReconciliationEventRepository reconciliations;
    private final com.tnl.logistics.service.SseService sseService;

    public WaybillServiceImpl(WaybillRepository waybillRepository,
                              ShipmentRepository shipmentRepository,
                              ParcelUnitRepository parcelUnitRepository,
                              TrackingEventRepository trackingEventRepository,
                              AppUserRepository appUserRepository,
                              IdentifierCounterService identifierCounterService,
                              com.tnl.logistics.service.ParcelCustodyLocks custodyLocks,
                              WaybillReconciliationEventRepository reconciliations,
                              com.tnl.logistics.service.SseService sseService) {
        this.waybillRepository = waybillRepository;
        this.shipmentRepository = shipmentRepository;
        this.parcelUnitRepository = parcelUnitRepository;
        this.trackingEventRepository = trackingEventRepository;
        this.appUserRepository = appUserRepository;
        this.identifierCounterService = identifierCounterService;
        this.custodyLocks = custodyLocks;
        this.reconciliations = reconciliations;
        this.sseService = sseService;
    }

    @Override
    @Transactional(readOnly = true)
    public void assertViewer(String actingUserId) {
        AppUser actor = appUserRepository.findById(actingUserId)
                .orElseThrow(() -> new AccessDeniedException("Active waybill staff account required"));
        if (!Boolean.TRUE.equals(actor.getActive()) ||
                (actor.getRole() != UserRole.ADMIN &&
                        actor.getRole() != UserRole.DISPATCH_STAFF)) {
            throw new AccessDeniedException("Active waybill staff account required");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<WaybillShipmentOptionResponse> getShipmentOptions() {
        List<Shipment> shipments = shipmentRepository.findAllByOrderByDateRegisteredDesc();
        return buildShipmentOptions(shipments);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<WaybillShipmentOptionResponse> getShipmentOptions(String search, Pageable pageable) {
        String normalizedSearch = search == null || search.isBlank() ? null : search.trim();
        Page<Shipment> shipmentPage = shipmentRepository.findShipmentOptions(normalizedSearch, pageable);
        List<WaybillShipmentOptionResponse> options = buildShipmentOptions(shipmentPage.getContent());
        return new PageImpl<>(options, pageable, shipmentPage.getTotalElements());
    }

    private List<WaybillShipmentOptionResponse> buildShipmentOptions(List<Shipment> shipments) {
        if (shipments.isEmpty()) {
            return Collections.emptyList();
        }

        List<String> shipmentIds = shipments.stream()
                .map(Shipment::getShipmentId)
                .collect(Collectors.toList());

        List<Waybill> waybills = waybillRepository.findByShipment_ShipmentIdIn(shipmentIds);
        Map<String, Waybill> waybillMap = waybills.stream()
                .filter(w -> w.getShipment() != null)
                .collect(Collectors.toMap(w -> w.getShipment().getShipmentId(), w -> w, (w1, w2) ->
                        w1.getGeneratedAt().isAfter(w2.getGeneratedAt()) ? w1 : w2));

        List<ParcelUnit> scopedParcels = parcelUnitRepository.findByShipment_ShipmentIdInOrderBySeqAsc(shipmentIds);
        Map<String, List<String>> trackingMap = scopedParcels.stream()
                .filter(p -> p.getShipment() != null && p.getTrackingId() != null)
                .collect(Collectors.groupingBy(
                        p -> p.getShipment().getShipmentId(),
                        Collectors.mapping(ParcelUnit::getTrackingId, Collectors.toList())
                ));
        Map<String, Long> completedByShipment = scopedParcels.stream()
                .filter(parcel -> parcel.getCurrentStatus() == ParcelStatus.COMPLETED)
                .collect(Collectors.groupingBy(parcel -> parcel.getShipment().getShipmentId(), Collectors.counting()));

        return shipments.stream().map(s -> {
            Waybill w = waybillMap.get(s.getShipmentId());
            String statusStr = "Not Generated";
            String wbId = null;
            if (w != null) {
                wbId = w.getWaybillId();
                if (w.getStatus() == WaybillStatus.SENT_TO_HAULER) {
                    statusStr = "Sent to Hauler";
                } else if (w.getStatus() == WaybillStatus.SIGNED_COMPLETED) {
                    statusStr = statusLabel(w);
                } else {
                    statusStr = "Generated";
                }
            }

            List<String> trackingNumbers = trackingMap.getOrDefault(s.getShipmentId(), java.util.Collections.emptyList());
            long completed = completedByShipment.getOrDefault(s.getShipmentId(), 0L);
            if (completed > 0 && completed < trackingNumbers.size()
                    && (w == null || w.getReconciliationOutcome() == null)) {
                statusStr = completed + " of " + trackingNumbers.size() + " completed";
            }

            return new WaybillShipmentOptionResponse(
                    s.getShipmentId(),
                    s.getClient() != null ? s.getClient().getName() : "—",
                    s.getRecipientName(),
                    s.getRoute() != null ? s.getRoute() : "TNL Baguio Hub",
                    s.getQuantity(),
                    wbId,
                    statusStr,
                    trackingNumbers
            );
        }).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<HaulerStaffOptionResponse> getHaulerStaffOptions() {
        List<HaulerStaffOptionResponse> options = new ArrayList<>();

        List<AppUser> dispatchStaff = appUserRepository.findByRoleAndActiveTrue(UserRole.DISPATCH_STAFF);
        for (AppUser u : dispatchStaff) {
            options.add(new HaulerStaffOptionResponse(u.getUserId(), u.getFullName(), u.getFullName()));
        }

        if (options.isEmpty()) {
            List<AppUser> courierStaff = appUserRepository.findByRoleAndActiveTrue(UserRole.COURIER_STAFF);
            for (AppUser user : courierStaff) {
                options.add(new HaulerStaffOptionResponse(
                        user.getUserId(), user.getFullName(), user.getFullName()));
            }
        }

        return options;
    }

    @Override
    @Transactional(readOnly = true)
    public List<WaybillManifestResponse> getByShipmentId(String shipmentId) {
        Shipment shipment = shipmentRepository.findById(shipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Shipment not found: " + shipmentId));
        return waybillRepository.findByShipment_ShipmentIdOrderByGeneratedAtDesc(shipmentId).stream()
                .map(waybill -> buildManifestResponse(shipment, waybill,
                        parcelUnitRepository.findByWaybill_WaybillIdOrderBySeqAsc(waybill.getWaybillId())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public WaybillManifestResponse getManifestById(String waybillId) {
        Waybill waybill = requireWaybill(waybillId);
        return buildManifestResponse(waybill.getShipment(), waybill,
                parcelUnitRepository.findByWaybill_WaybillIdOrderBySeqAsc(waybillId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ParcelUnitResponse> getAvailableUnits(String shipmentId) {
        Shipment shipment = shipmentRepository.findById(shipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Shipment not found: " + shipmentId));
        return parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId).stream()
                .filter(parcel -> !parcel.isLost() && parcel.getWaybill() == null
                        && (parcel.getCurrentStatus() == ParcelStatus.LOADED_TO_HAULER
                        || parcel.getCurrentStatus() == ParcelStatus.ARRIVED_AT_TNL))
                .map(parcel -> toParcelResponse(parcel, shipment.getQuantity())).toList();
    }

    @Override
    public WaybillManifestResponse generate(WaybillGenerationRequest request, String actingStaffUserId) {
        AppUser actor = requireDispatchStaff(actingStaffUserId);
        String key = request.getIdempotencyKey().trim();
        if (key.length() > 100) throw new IllegalArgumentException("Idempotency key is too long");
        List<String> ids = normalizeIds(request.getTrackingIds());
        if (parcelUnitRepository.findByShipment_ShipmentIdAndTrackingIdIn(request.getShipmentId(), ids).size() != ids.size()) {
            throw new IllegalArgumentException("Every parcel must belong to the requested shipment.");
        }
        List<ParcelUnit> lockedParcels = custodyLocks.lockParcels(ids);
        Shipment shipment = lockedParcels.get(0).getShipment();

        Waybill replay = waybillRepository.findByGenerationKey(key).orElse(null);
        if (replay != null) {
            Set<String> existingIds = parcelUnitRepository.findByWaybill_WaybillIdOrderBySeqAsc(replay.getWaybillId()).stream()
                    .map(ParcelUnit::getTrackingId).collect(Collectors.toSet());
            if (!replay.getShipment().getShipmentId().equals(shipment.getShipmentId())
                    || !existingIds.equals(new HashSet<>(ids))) {
                throw new IllegalStateException("Idempotency key was used for a different manifest");
            }
            return getManifestById(replay.getWaybillId());
        }

        List<ParcelUnit> parcels = new ArrayList<>();
        for (ParcelUnit parcel : lockedParcels) {
            String trackingId = parcel.getTrackingId();
            if (!parcel.getShipment().getShipmentId().equals(shipment.getShipmentId())) {
                throw new IllegalArgumentException("Parcel is not in shipment: " + trackingId);
            }
            if (parcel.isLost() || parcel.getCurrentStatus() != ParcelStatus.LOADED_TO_HAULER || parcel.getWaybill() != null) {
                throw new IllegalStateException("Parcel is not loaded and unassigned: " + trackingId);
            }
            parcels.add(parcel);
        }

        int year = LocalDate.now().getYear();
        long sequence = identifierCounterService.next(IdentifierCounterService.IdentifierFamily.WAYBILL, year);
        Waybill waybill = new Waybill(String.format("WYB-%d-%04d", year, sequence), shipment, actor,
                request.getHaulerName() == null || request.getHaulerName().isBlank() ? "Hauler" : request.getHaulerName().trim());
        waybill.setGenerationKey(key);
        waybill.setDriverName(request.getDriverName());
        waybill.setDriverContact(request.getDriverContact());
        waybill.setVehiclePlate(request.getVehiclePlate());
        waybill.setRemarks(request.getRemarks());
        waybillRepository.save(waybill);
        for (ParcelUnit parcel : parcels) parcel.setWaybill(waybill);
        parcelUnitRepository.saveAll(parcels);
        parcelUnitRepository.flush();
        sseService.broadcastEvent("WAYBILL_UPDATE", Map.of("shipmentId", shipment.getShipmentId(), "waybillId", waybill.getWaybillId()));
        return buildManifestResponse(shipment, waybill, parcels);
    }

    @Override
    public WaybillManifestResponse sendToHauler(String waybillId, String actingStaffUserId) {
        AppUser actor = requireDispatchStaff(actingStaffUserId);
        Waybill waybill = lockExistingManifest(waybillId, "Waybill not found: " + waybillId);
        List<ParcelUnit> manifest = custodyLocks.lockManifestParcels(waybillId);
        if (manifest.isEmpty() || manifest.stream().allMatch(ParcelUnit::isLost)) {
            throw new IllegalStateException("An all-lost waybill cannot be sent. Admin must close it as all lost.");
        }
        if (waybill.getStatus() == WaybillStatus.SENT_TO_HAULER) return getManifestById(waybillId);
        if (waybill.getStatus() != WaybillStatus.GENERATED) {
            throw new IllegalStateException("Cannot send waybill in status " + waybill.getStatus());
        }
        waybill.setStatus(WaybillStatus.SENT_TO_HAULER);
        waybill.setSentBy(actor);
        waybill.setDispatchedAt(LocalDateTime.now());
        sseService.broadcastEvent("WAYBILL_UPDATE", Map.of("shipmentId", waybill.getShipment().getShipmentId(), "waybillId", waybillId));
        return getManifestById(waybillId);
    }

    @Override
    public WaybillManifestResponse markSignedCompleted(String waybillId, WaybillStatusUpdateRequest request, String actingStaffUserId) {
        AppUser actor = requireDispatchStaff(actingStaffUserId);
        if (request == null || request.getConfirmedWaybillId() == null
                || !waybillId.equals(request.getConfirmedWaybillId())) {
            throw new IllegalArgumentException(COMPLETION_DENIED_MESSAGE);
        }
        Waybill waybill = lockExistingManifest(waybillId, COMPLETION_DENIED_MESSAGE);
        Shipment shipment = waybill.getShipment();
        if ((request.getManifestRevision() == null && waybill.getManifestRevision() > 0)
                || (request.getManifestRevision() != null && request.getManifestRevision() != waybill.getManifestRevision())) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,
                    "Manifest changed. Refresh and scan the printed QR again.");
        }
        if (waybill.getStatus() == WaybillStatus.SIGNED_COMPLETED) return getManifestById(waybillId);
        if (waybill.getStatus() != WaybillStatus.SENT_TO_HAULER) {
            throw new IllegalStateException(COMPLETION_DENIED_MESSAGE);
        }
        List<ParcelUnit> parcels = custodyLocks.lockManifestParcels(waybillId);
        if (parcels.isEmpty()) throw new IllegalStateException(COMPLETION_DENIED_MESSAGE);
        if (parcels.stream().allMatch(ParcelUnit::isLost)) {
            throw new IllegalStateException("Admin must explicitly close an all-lost waybill.");
        }
        for (ParcelUnit parcel : parcels) {
            if (!parcel.isLost() && parcel.getCurrentStatus() != ParcelStatus.COMPLETED
                    && parcel.getCurrentStatus() != ParcelStatus.LOADED_TO_HAULER) {
                throw new IllegalStateException(COMPLETION_DENIED_MESSAGE);
            }
        }
        LocalDateTime signedAt = LocalDateTime.now();
        String signatory = (request.getSignedBy() != null && !request.getSignedBy().isBlank())
                ? request.getSignedBy().trim() : null;
        String eventRemark = signatory != null
                ? "Signed waybill " + waybillId + " by " + signatory
                : "Signed waybill " + waybillId + " completed";
        for (ParcelUnit parcel : parcels) {
            if (parcel.isLost() || parcel.getCurrentStatus() == ParcelStatus.COMPLETED) continue;
            parcel.setCurrentStatus(ParcelStatus.COMPLETED);
            parcel.setCurrentVehicle(null);
            trackingEventRepository.save(new TrackingEvent(parcel, ParcelStatus.COMPLETED, null, actor, eventRemark));
        }
        parcelUnitRepository.saveAll(parcels);
        waybill.setStatus(WaybillStatus.SIGNED_COMPLETED);
        waybill.setCompletedBy(actor);
        waybill.setSignedBy(signatory);
        waybill.setSignedAt(signedAt);
        waybill.setRemarks(request.getRemarks());
        waybill.setReconciliationOutcome(parcels.stream().anyMatch(ParcelUnit::isLost) ? "WITH_LOSS" : "ALL_DELIVERED");
        reconciliations.save(new WaybillReconciliationEvent(waybill, "CLOSED", null, actingStaffUserId, null, request.getManifestRevision()));
        sseService.broadcastEvent("WAYBILL_UPDATE", Map.of("shipmentId", shipment.getShipmentId(), "waybillId", waybillId));
        parcelUnitRepository.flush();
        return buildManifestResponse(shipment, waybill, parcels);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<WaybillSummaryResponse> getWaybills(String search, WaybillStatus status, String client, Pageable pageable) {
        String cleanSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;
        String cleanClient = (client != null && !client.isBlank() && !client.equalsIgnoreCase("ALL"))
                ? client.trim()
                : null;

        Page<Waybill> page = waybillRepository.searchWaybills(cleanSearch, status, cleanClient, pageable);
        List<String> waybillIds = page.getContent().stream()
                .map(Waybill::getWaybillId)
                .toList();
        Map<String, Long> parcelCounts = waybillIds.isEmpty()
                ? Collections.emptyMap()
                : parcelUnitRepository.countByWaybillIds(waybillIds).stream()
                        .collect(Collectors.toMap(row -> (String) row[0], row -> (Long) row[1]));

        List<WaybillSummaryResponse> summaries = page.getContent().stream().map(w -> {
            Shipment s = w.getShipment();
            String statusLabel = statusLabel(w);

            return new WaybillSummaryResponse(
                    w.getWaybillId(),
                    s.getShipmentId(),
                    s.getClient() != null ? s.getClient().getName() : "—",
                    s.getRecipientName(),
                    s.getRoute() != null ? s.getRoute() : "TNL Baguio Hub",
                    Math.toIntExact(parcelCounts.getOrDefault(w.getWaybillId(), 0L)),
                    w.getHaulerName(),
                    w.getStatus(),
                    statusLabel,
                    w.getGeneratedAt(),
                    w.getGeneratedAt() != null ? w.getGeneratedAt().format(DATE_FORMATTER) : "—",
                    w.getSignedBy(),
                    w.getSignedAt()
            );
        }).collect(Collectors.toList());

        return new PageImpl<>(summaries, pageable, page.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<WaybillOptionResponse> getWaybillOptions(String search, WaybillStatus status, Pageable pageable) {
        String normalizedSearch = search == null || search.isBlank() ? null : search.trim();
        Page<Waybill> waybillPage = waybillRepository.findWaybillOptions(normalizedSearch, status, pageable);
        List<String> waybillIds = waybillPage.getContent().stream()
                .map(Waybill::getWaybillId)
                .toList();
        Map<String, Long> parcelCounts = waybillIds.isEmpty()
                ? Collections.emptyMap()
                : parcelUnitRepository.countByWaybillIds(waybillIds).stream()
                        .collect(Collectors.toMap(row -> (String) row[0], row -> (Long) row[1]));

        List<WaybillOptionResponse> options = waybillPage.getContent().stream()
                .map(waybill -> new WaybillOptionResponse(
                        waybill.getWaybillId(),
                        waybill.getShipment().getShipmentId(),
                        parcelCounts.getOrDefault(waybill.getWaybillId(), 0L),
                        waybill.getStatus(),
                        statusLabel(waybill),
                        waybill.getGeneratedAt()))
                .toList();
        return new PageImpl<>(options, pageable, waybillPage.getTotalElements());
    }

    private Waybill requireWaybill(String waybillId) {
        return waybillRepository.findById(waybillId)
                .orElseThrow(() -> new IllegalArgumentException("Waybill not found: " + waybillId));
    }

    private AppUser requireDispatchStaff(String userId) {
        AppUser actor = appUserRepository.findById(userId)
                .orElseThrow(() -> new AccessDeniedException("Active Dispatch Staff account required"));
        if (!Boolean.TRUE.equals(actor.getActive()) || actor.getRole() != UserRole.DISPATCH_STAFF) {
            throw new AccessDeniedException("Active Dispatch Staff account required");
        }
        return actor;
    }

    private List<String> normalizeIds(List<String> trackingIds) {
        if (trackingIds == null || trackingIds.isEmpty()) throw new IllegalArgumentException("Tracking IDs are required");
        List<String> normalized = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (String trackingId : trackingIds) {
            if (trackingId == null || trackingId.isBlank()) throw new IllegalArgumentException("Tracking ID must not be blank");
            String trimmed = trackingId.trim();
            if (!seen.add(trimmed)) throw new IllegalArgumentException("Duplicate tracking ID: " + trimmed);
            normalized.add(trimmed);
        }
        return normalized;
    }

    private ParcelUnitResponse toParcelResponse(ParcelUnit parcel, int shipmentQuantity) {
        ParcelUnitResponse response = new ParcelUnitResponse(parcel.getTrackingId(), parcel.getSeq(), shipmentQuantity,
                parcel.getCurrentStatus().name(), parcel.getLabelStatus().name(), parcel.getReprintCount(),
                parcel.getWeightKg(), parcel.getLengthCm(), parcel.getWidthCm(), parcel.getHeightCm(), parcel.getVolumeCbm());
        response.setLost(parcel.isLost());
        response.setRevision(parcel.getRevision());
        return response;
    }

    private String statusLabel(Waybill waybill) {
        if (waybill.getStatus() == WaybillStatus.SIGNED_COMPLETED) {
            if ("ALL_LOST".equals(waybill.getReconciliationOutcome())) return "Closed as All Lost";
            if ("WITH_LOSS".equals(waybill.getReconciliationOutcome())) return "Closed with Loss";
            return "Signed / Completed";
        }
        return waybill.getStatus() == WaybillStatus.SENT_TO_HAULER ? "Sent to Hauler" : "Generated";
    }

    private Waybill lockExistingManifest(String waybillId, String missingMessage) {
        try {
            return custodyLocks.lockManifest(waybillId);
        } catch (org.springframework.web.server.ResponseStatusException exception) {
            if (exception.getStatusCode() == org.springframework.http.HttpStatus.NOT_FOUND) {
                throw new IllegalArgumentException(missingMessage);
            }
            throw exception;
        }
    }

    private WaybillManifestResponse buildManifestResponse(Shipment s, Waybill w, List<ParcelUnit> parcels) {
        WaybillManifestResponse resp = new WaybillManifestResponse();
        resp.setShipmentId(s.getShipmentId());
        resp.setDescription(s.getDescription() != null ? s.getDescription() : "General Goods");
        resp.setTotalQuantity(parcels.size());
        int delivered = (int) parcels.stream().filter(parcel -> !parcel.isLost() && parcel.getCurrentStatus() == ParcelStatus.COMPLETED).count();
        int lost = (int) parcels.stream().filter(ParcelUnit::isLost).count();
        resp.setDeliveredCount(delivered);
        resp.setLostCount(lost);
        resp.setRemainingCount(parcels.size() - delivered - lost);
        resp.setRoute(s.getRoute() != null ? s.getRoute() : "Manila → TNL Baguio Hub");

        // Destination Hub derivation
        String destinationHub = "TNL Baguio Hub";
        if (s.getRoute() != null && s.getRoute().contains("→")) {
            String[] parts = s.getRoute().split("→");
            if (parts.length > 1) {
                destinationHub = parts[1].trim();
            }
        }
        resp.setDestinationHub(destinationHub);

        // Shipper info
        if (s.getClient() != null) {
            resp.setClientName(s.getClient().getName());
            resp.setClientAddress(s.getClient().getAddress());
            resp.setClientContact(s.getClient().getContactNumber());
        }

        // Consignee info
        resp.setRecipientName(s.getRecipientName());
        resp.setRecipientAddress(s.getRecipientAddress());
        resp.setRecipientContact(s.getRecipientContact());

        // Waybill info
        if (w != null) {
            resp.setWaybillId(w.getWaybillId());
            resp.setStatus(w.getStatus());
            resp.setStatusLabel(statusLabel(w));
            resp.setManifestRevision(w.getManifestRevision());
            resp.setReconciliationOutcome(w.getReconciliationOutcome());
            resp.setHaulerName(w.getHaulerName());
            resp.setDriverName(w.getDriverName());
            resp.setDriverContact(w.getDriverContact());
            resp.setVehiclePlate(w.getVehiclePlate());
            resp.setGeneratedAt(w.getGeneratedAt());
            resp.setGeneratedDate(w.getGeneratedAt() != null ? w.getGeneratedAt().format(DATE_TIME_FORMATTER) : "—");
            resp.setDispatchedAt(w.getDispatchedAt());
            resp.setDispatchedDate(w.getDispatchedAt() != null ? w.getDispatchedAt().format(DATE_TIME_FORMATTER) : null);
            resp.setSignedBy(w.getSignedBy());
            resp.setSignedAt(w.getSignedAt());
            resp.setSignedDate(w.getSignedAt() != null ? w.getSignedAt().format(DATE_FORMATTER) : null);
            resp.setReleasedByAdminName(w.getGeneratedBy() != null ? w.getGeneratedBy().getFullName() : null);
        } else {
            resp.setWaybillId(null);
            resp.setStatus(null);
            resp.setStatusLabel("Not Generated");
            resp.setHaulerName("—");
            resp.setReleasedByAdminName(null);
        }

        // Weight & Volume totals
        BigDecimal totalWeight = BigDecimal.ZERO;
        BigDecimal totalVolume = BigDecimal.ZERO;

        List<ParcelUnitResponse> unitResponses = new ArrayList<>();
        for (ParcelUnit p : parcels) {
            if (p.getWeightKg() != null) {
                totalWeight = totalWeight.add(p.getWeightKg());
            }
            if (p.getVolumeCbm() != null) {
                totalVolume = totalVolume.add(p.getVolumeCbm());
            }

            unitResponses.add(toParcelResponse(p, s.getQuantity()));
        }

        if (totalWeight.compareTo(BigDecimal.ZERO) == 0) {
            totalWeight = BigDecimal.ZERO;
        }

        resp.setTotalWeightKg(totalWeight);
        resp.setTotalVolumeCbm(totalVolume);
        resp.setParcels(unitResponses);

        return resp;
    }
}
