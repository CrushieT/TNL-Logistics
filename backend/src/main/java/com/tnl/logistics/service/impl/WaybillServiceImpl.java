package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.SseService;
import com.tnl.logistics.service.WaybillService;
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

/**
 * Service implementation for Waybill generation, custody state transitions, and Proof of Delivery.
 */
@Service
@Transactional
public class WaybillServiceImpl implements WaybillService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy");
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy · h:mm a");

    private final WaybillRepository waybillRepository;
    private final ShipmentRepository shipmentRepository;
    private final ParcelUnitRepository parcelUnitRepository;
    private final TrackingEventRepository trackingEventRepository;
    private final AppUserRepository appUserRepository;
    private final SseService sseService;

    public WaybillServiceImpl(WaybillRepository waybillRepository,
                              ShipmentRepository shipmentRepository,
                              ParcelUnitRepository parcelUnitRepository,
                              TrackingEventRepository trackingEventRepository,
                              AppUserRepository appUserRepository,
                              SseService sseService) {
        this.waybillRepository = waybillRepository;
        this.shipmentRepository = shipmentRepository;
        this.parcelUnitRepository = parcelUnitRepository;
        this.trackingEventRepository = trackingEventRepository;
        this.appUserRepository = appUserRepository;
        this.sseService = sseService;
    }

    @Override
    @Transactional(readOnly = true)
    public List<WaybillShipmentOptionResponse> getShipmentOptions() {
        List<Shipment> shipments = shipmentRepository.findAllByOrderByDateRegisteredDesc();
        List<Waybill> waybills = waybillRepository.findAll();
        Map<String, Waybill> waybillMap = waybills.stream()
                .collect(Collectors.toMap(w -> w.getShipment().getShipmentId(), w -> w, (w1, w2) -> w1));

        return shipments.stream().map(s -> {
            Waybill w = waybillMap.get(s.getShipmentId());
            String statusStr = "Not Generated";
            String wbId = null;
            if (w != null) {
                wbId = w.getWaybillId();
                if (w.getStatus() == WaybillStatus.SENT_TO_HAULER) {
                    statusStr = "Sent to Hauler";
                } else if (w.getStatus() == WaybillStatus.SIGNED_COMPLETED) {
                    statusStr = "Signed / Completed";
                } else {
                    statusStr = "Generated";
                }
            }

            return new WaybillShipmentOptionResponse(
                    s.getShipmentId(),
                    s.getClient() != null ? s.getClient().getName() : "—",
                    s.getRecipientName(),
                    s.getRoute() != null ? s.getRoute() : "TNL Baguio Hub",
                    s.getQuantity(),
                    wbId,
                    statusStr
            );
        }).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<HaulerStaffOptionResponse> getHaulerStaffOptions() {
        List<HaulerStaffOptionResponse> options = new ArrayList<>();

        // 1. Query specialized HAULER_STAFF users
        List<AppUser> haulerStaff = appUserRepository.findByStaffTypeAndActiveTrue(StaffType.HAULER_STAFF);
        for (AppUser u : haulerStaff) {
            options.add(new HaulerStaffOptionResponse(u.getUserId(), u.getFullName(), u.getStaffType(), null, u.getFullName()));
        }

        // 2. Query other active FIELD_STAFF only if no specialized hauler staff exist
        if (options.isEmpty()) {
            List<AppUser> otherField = appUserRepository.findByRoleAndActiveTrue(UserRole.FIELD_STAFF);
            for (AppUser u : otherField) {
                options.add(new HaulerStaffOptionResponse(u.getUserId(), u.getFullName(), u.getStaffType(), null, u.getFullName()));
            }
        }

        return options;
    }

    @Override
    @Transactional(readOnly = true)
    public WaybillManifestResponse getManifestByShipmentId(String shipmentId) {
        Shipment shipment = shipmentRepository.findById(shipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Shipment not found: " + shipmentId));

        Waybill waybill = waybillRepository.findByShipment_ShipmentId(shipmentId).orElse(null);
        List<ParcelUnit> parcels = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId);

        return buildManifestResponse(shipment, waybill, parcels);
    }

    @Override
    public synchronized WaybillManifestResponse sendToHauler(WaybillCreateRequest request, String actingStaffUsername) {
        Shipment shipment = shipmentRepository.findById(request.getShipmentId())
                .orElseThrow(() -> new IllegalArgumentException("Shipment not found: " + request.getShipmentId()));

        AppUser actingStaff = appUserRepository.findByUsername(actingStaffUsername)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + actingStaffUsername));

        Waybill waybill = waybillRepository.findByShipment_ShipmentId(request.getShipmentId()).orElse(null);

        if (waybill == null) {
            // Generate sequential ID: WYB-YYYY-XXXX (e.g. WYB-2026-0001)
            String currentYear = String.valueOf(LocalDate.now().getYear());
            String prefix = "WYB-" + currentYear + "-";
            String maxId = waybillRepository.findMaxWaybillIdWithPrefix(prefix + "%").orElse(null);
            int nextSeq = 1;
            if (maxId != null && maxId.length() >= prefix.length() + 4) {
                try {
                    nextSeq = Integer.parseInt(maxId.substring(prefix.length())) + 1;
                } catch (NumberFormatException ignored) {}
            }
            String waybillId = String.format("WYB-%s-%04d", currentYear, nextSeq);

            waybill = new Waybill(waybillId, shipment, actingStaff, request.getHaulerName().trim());
        }

        waybill.setHaulerName(request.getHaulerName().trim());
        if (request.getDriverName() != null && !request.getDriverName().isBlank()) {
            waybill.setDriverName(request.getDriverName().trim());
        }
        if (request.getDriverContact() != null && !request.getDriverContact().isBlank()) {
            waybill.setDriverContact(request.getDriverContact().trim());
        }
        if (request.getVehiclePlate() != null && !request.getVehiclePlate().isBlank()) {
            waybill.setVehiclePlate(request.getVehiclePlate().trim());
        }
        if (request.getRemarks() != null && !request.getRemarks().isBlank()) {
            waybill.setRemarks(request.getRemarks().trim());
        }

        waybill.setStatus(WaybillStatus.SENT_TO_HAULER);
        waybill.setDispatchedAt(LocalDateTime.now());

        Waybill saved = waybillRepository.save(waybill);
        List<ParcelUnit> parcels = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipment.getShipmentId());

        return buildManifestResponse(shipment, saved, parcels);
    }

    @Override
    public WaybillManifestResponse markSignedCompleted(String shipmentId, WaybillStatusUpdateRequest request, String actingStaffUsername) {
        Shipment shipment = shipmentRepository.findById(shipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Shipment not found: " + shipmentId));

        Waybill waybill = waybillRepository.findByShipment_ShipmentId(shipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Waybill has not been generated for shipment: " + shipmentId));

        String signedByName = (request.getSignedBy() != null && !request.getSignedBy().isBlank())
                ? request.getSignedBy().trim()
                : shipment.getRecipientName();

        LocalDateTime signedAtTime = request.getSignedAt() != null ? request.getSignedAt() : LocalDateTime.now();

        waybill.setStatus(WaybillStatus.SIGNED_COMPLETED);
        waybill.setSignedBy(signedByName);
        waybill.setSignedAt(signedAtTime);

        if (request.getRemarks() != null && !request.getRemarks().isBlank()) {
            waybill.setRemarks(request.getRemarks().trim());
        }

        AppUser actingStaff = appUserRepository.findByUsername(actingStaffUsername).orElse(null);

        Waybill saved = waybillRepository.save(waybill);
        List<ParcelUnit> parcels = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId);

        // Cascade status to COMPLETED for all parcel units and record TrackingEvents
        for (ParcelUnit parcel : parcels) {
            parcel.setCurrentStatus(ParcelStatus.COMPLETED);
            parcel.setCurrentVehicle(null);
            parcelUnitRepository.save(parcel);

            TrackingEvent event = new TrackingEvent(
                    parcel,
                    ParcelStatus.COMPLETED,
                    null,
                    actingStaff,
                    "Delivered & signed by " + signedByName
            );
            event.setEventTimestamp(signedAtTime);
            trackingEventRepository.save(event);

            try {
                TrackingScanResponse scanResp = new TrackingScanResponse(
                        parcel.getTrackingId(),
                        "Loaded to Hauler",
                        "Completed",
                        null,
                        null,
                        signedAtTime,
                        actingStaff != null ? actingStaff.getFullName() : "Admin",
                        shipmentId,
                        parcels.size() + " / " + parcels.size() + " Completed"
                );
                sseService.broadcastTrackingScan(scanResp);
            } catch (Exception ignored) {}
        }

        return buildManifestResponse(shipment, saved, parcels);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<WaybillSummaryResponse> getWaybills(String search, WaybillStatus status, String hauler, Pageable pageable) {
        String cleanSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;
        String cleanHauler = (hauler != null && !hauler.equalsIgnoreCase("ALL")) ? hauler.trim() : null;

        Page<Waybill> page = waybillRepository.searchWaybills(cleanSearch, status, cleanHauler, pageable);

        List<WaybillSummaryResponse> summaries = page.getContent().stream().map(w -> {
            Shipment s = w.getShipment();
            String statusLabel = w.getStatus() == WaybillStatus.SIGNED_COMPLETED ? "Signed / Completed"
                    : (w.getStatus() == WaybillStatus.SENT_TO_HAULER ? "Sent to Hauler" : "Generated");

            return new WaybillSummaryResponse(
                    w.getWaybillId(),
                    s.getShipmentId(),
                    s.getClient() != null ? s.getClient().getName() : "—",
                    s.getRecipientName(),
                    s.getRoute() != null ? s.getRoute() : "TNL Baguio Hub",
                    s.getQuantity(),
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

    private WaybillManifestResponse buildManifestResponse(Shipment s, Waybill w, List<ParcelUnit> parcels) {
        WaybillManifestResponse resp = new WaybillManifestResponse();
        resp.setShipmentId(s.getShipmentId());
        resp.setDescription(s.getDescription() != null ? s.getDescription() : "General Goods");
        resp.setTotalQuantity(s.getQuantity());
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
            resp.setStatusLabel(w.getStatus() == WaybillStatus.SIGNED_COMPLETED ? "Signed / Completed"
                    : (w.getStatus() == WaybillStatus.SENT_TO_HAULER ? "Sent to Hauler" : "Generated"));
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
            resp.setReleasedByAdminName(w.getGeneratedBy() != null ? w.getGeneratedBy().getFullName() : "Maria Santos");
        } else {
            resp.setWaybillId(null);
            resp.setStatus(null);
            resp.setStatusLabel("Not Generated");
            resp.setHaulerName("—");
            resp.setReleasedByAdminName("Maria Santos");
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

            unitResponses.add(new ParcelUnitResponse(
                    p.getTrackingId(),
                    p.getSeq(),
                    s.getQuantity(),
                    p.getCurrentStatus() != null ? p.getCurrentStatus().name() : "REGISTERED",
                    p.getLabelStatus() != null ? p.getLabelStatus().name() : "NOT_PRINTED",
                    p.getReprintCount(),
                    p.getWeightKg(),
                    p.getLengthCm(),
                    p.getWidthCm(),
                    p.getHeightCm(),
                    p.getVolumeCbm()
            ));
        }

        if (totalWeight.compareTo(BigDecimal.ZERO) == 0) {
            totalWeight = new BigDecimal("2.5").multiply(new BigDecimal(s.getQuantity()));
        }

        resp.setTotalWeightKg(totalWeight);
        resp.setTotalVolumeCbm(totalVolume);
        resp.setParcels(unitResponses);

        return resp;
    }
}
