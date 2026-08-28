package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.ShipmentService;
import com.tnl.logistics.service.SseService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service implementation for shipment processing, tracking, and retrieval.
 */
@Service
@Transactional
public class ShipmentServiceImpl implements ShipmentService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("h:mm a");

    private final ShipmentRepository shipmentRepository;
    private final ParcelUnitRepository parcelUnitRepository;
    private final ClientRepository clientRepository;
    private final PaymentRepository paymentRepository;
    private final AppUserRepository appUserRepository;
    private final TrackingEventRepository trackingEventRepository;
    private final WaybillRepository waybillRepository;
    private final SseService sseService;

    public ShipmentServiceImpl(ShipmentRepository shipmentRepository,
                               ParcelUnitRepository parcelUnitRepository,
                               ClientRepository clientRepository,
                               PaymentRepository paymentRepository,
                               AppUserRepository appUserRepository,
                               TrackingEventRepository trackingEventRepository,
                               WaybillRepository waybillRepository,
                               SseService sseService) {
        this.shipmentRepository = shipmentRepository;
        this.parcelUnitRepository = parcelUnitRepository;
        this.clientRepository = clientRepository;
        this.paymentRepository = paymentRepository;
        this.appUserRepository = appUserRepository;
        this.trackingEventRepository = trackingEventRepository;
        this.waybillRepository = waybillRepository;
        this.sseService = sseService;
    }

    @Override
    public synchronized ShipmentResponse registerShipment(ShipmentRegistrationRequest request, String actingStaffUsername) {
        Client client = clientRepository.findById(request.getClientId())
                .orElseThrow(() -> new IllegalArgumentException("Client not found with ID: " + request.getClientId()));

        if (Boolean.FALSE.equals(client.getActive())) {
            throw new IllegalArgumentException("Cannot register shipment for inactive client: " + client.getName());
        }

        AppUser actingStaff = appUserRepository.findByUsername(actingStaffUsername)
                .orElseThrow(() -> new IllegalArgumentException("Staff user not found: " + actingStaffUsername));

        // 1. Pricing Model Calculations
        BigDecimal totalAmount;
        BigDecimal otherCharges = request.getOtherCharges() != null ? request.getOtherCharges() : BigDecimal.ZERO;

        if (request.getChargeModel() == ChargeModel.FLAT) {
            totalAmount = request.getShippingFee().add(otherCharges);
        } else {
            totalAmount = request.getShippingFee()
                    .multiply(new BigDecimal(request.getQuantity()))
                    .add(otherCharges);
        }

        // 2. Generate Sequential Shipment ID: SHP-YYYY-XXX
        String currentYear = String.valueOf(LocalDate.now().getYear());
        String shipmentPrefix = "SHP-" + currentYear + "-";
        String maxShipmentId = shipmentRepository.findMaxShipmentIdWithPrefix(shipmentPrefix + "%").orElse(null);
        int nextShipmentSeq = 1;
        if (maxShipmentId != null && maxShipmentId.length() >= shipmentPrefix.length() + 3) {
            String seqStr = maxShipmentId.substring(shipmentPrefix.length());
            try {
                nextShipmentSeq = Integer.parseInt(seqStr) + 1;
            } catch (NumberFormatException ignored) {}
        }
        String shipmentId = String.format("SHP-%s-%03d", currentYear, nextShipmentSeq);

        // 3. Save Shipment Entity
        Shipment shipment = new Shipment(
                shipmentId,
                client,
                request.getRecipientName(),
                request.getRecipientAddress(),
                request.getRecipientContact(),
                request.getQuantity(),
                request.getChargeModel(),
                request.getShippingFee(),
                otherCharges,
                totalAmount,
                request.getPaidAtRegistration() != null ? request.getPaidAtRegistration() : false,
                request.getRegisteredVia()
        );
        shipment.setDescription(request.getDescription());
        shipment.setRoute(request.getRoute());
        shipmentRepository.save(shipment);

        // 4. Generate Sequential Tracking IDs (TRK-YYYY-XXXXXX) & Process Parcel Units
        List<String> trackingIds = new ArrayList<>();
        String trackingPrefix = "TRK-" + currentYear + "-";
        String maxTrackingId = parcelUnitRepository.findMaxTrackingIdWithPrefix(trackingPrefix + "%").orElse(null);
        int nextTrackingSeq = 1;
        if (maxTrackingId != null && maxTrackingId.length() >= trackingPrefix.length() + 6) {
            String seqStr = maxTrackingId.substring(trackingPrefix.length());
            try {
                nextTrackingSeq = Integer.parseInt(seqStr) + 1;
            } catch (NumberFormatException ignored) {}
        }

        for (ParcelUnitRequest parcelReq : request.getParcels()) {
            String trackingId = String.format("TRK-%s-%06d", currentYear, nextTrackingSeq++);
            trackingIds.add(trackingId);

            // Auto-calculate volume in cbm: (L x H x W cm) / 1,000,000
            BigDecimal volumeCbm = null;
            if (parcelReq.getLengthCm() != null && parcelReq.getHeightCm() != null && parcelReq.getWidthCm() != null) {
                volumeCbm = parcelReq.getLengthCm()
                        .multiply(parcelReq.getHeightCm())
                        .multiply(parcelReq.getWidthCm())
                        .divide(new BigDecimal("1000000.0"), 4, RoundingMode.HALF_UP);
            }

            ParcelUnit unit = new ParcelUnit(
                    trackingId,
                    shipment,
                    parcelReq.getSeq(),
                    parcelReq.getWeightKg(),
                    parcelReq.getLengthCm(),
                    parcelReq.getHeightCm(),
                    parcelReq.getWidthCm(),
                    volumeCbm
            );
            unit.setCurrentStatus(ParcelStatus.REGISTERED);
            parcelUnitRepository.save(unit);

            // Audit log initial REGISTERED tracking scan event
            TrackingEvent regEvent = new TrackingEvent(
                    unit,
                    ParcelStatus.REGISTERED,
                    actingStaff,
                    "Initial registration via " + request.getRegisteredVia()
            );
            trackingEventRepository.save(regEvent);

            // Audit log QR_GENERATED tracking scan event
            TrackingEvent qrEvent = new TrackingEvent(
                    unit,
                    ParcelStatus.QR_GENERATED,
                    actingStaff,
                    "In-memory QR vector generation"
            );
            trackingEventRepository.save(qrEvent);
        }

        // 5. Process Auto-Payment if Paid at Registration
        if (Boolean.TRUE.equals(request.getPaidAtRegistration())) {
            Payment payment = new Payment(
                    shipment,
                    totalAmount,
                    PaymentMethod.CASH,
                    LocalDate.now()
            );
            payment.setReferenceNo("PAID-AT-REGISTRATION");
            paymentRepository.save(payment);
        }

        // 6. Broadcast real-time SSE event for new shipment
        try {
            sseService.broadcastShipmentCreated(mapToSummaryResponse(shipment));
        } catch (Exception ignored) {}

        return new ShipmentResponse(
                shipment.getShipmentId(),
                client.getClientId(),
                shipment.getRecipientName(),
                totalAmount,
                shipment.getPaidAtRegistration(),
                trackingIds
        );
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ShipmentSummaryResponse> getShipments(String search, String status, String paymentStatus, Pageable pageable) {
        String cleanSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;
        Page<Shipment> shipmentsPage = shipmentRepository.searchShipments(cleanSearch, pageable);

        List<ShipmentSummaryResponse> summaries = shipmentsPage.getContent().stream()
                .map(this::mapToSummaryResponse)
                .filter(s -> {
                    if (status != null && !status.equalsIgnoreCase("ALL")) {
                        if (!s.getStatus().equalsIgnoreCase(status)) return false;
                    }
                    if (paymentStatus != null && !paymentStatus.equalsIgnoreCase("ALL")) {
                        if (!s.getPayment().equalsIgnoreCase(paymentStatus)) return false;
                    }
                    return true;
                })
                .collect(Collectors.toList());

        return new PageImpl<>(summaries, pageable, shipmentsPage.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public ShipmentDetailResponse getShipmentById(String shipmentId) {
        Shipment shipment = shipmentRepository.findById(shipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Shipment not found: " + shipmentId));

        List<ParcelUnit> parcels = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId);
        List<Payment> payments = paymentRepository.findByShipment_ShipmentId(shipmentId);

        BigDecimal totalPaid = payments.stream()
                .map(Payment::getAmountPaid)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal balance = shipment.getTotalAmount().subtract(totalPaid);
        if (balance.compareTo(BigDecimal.ZERO) < 0) balance = BigDecimal.ZERO;

        String paymentStr = totalPaid.compareTo(shipment.getTotalAmount()) >= 0 ? "Paid"
                : (totalPaid.compareTo(BigDecimal.ZERO) > 0 ? "Partial" : "Unpaid");

        RollupStatus rollup = computeRollupStatus(parcels);

        ShipmentDetailResponse resp = new ShipmentDetailResponse();
        resp.setShipmentId(shipment.getShipmentId());
        resp.setOrigin(shipment.getRegisteredVia() == RegisteredVia.DESKTOP_OFFICE ? "Desktop Office" : "Mobile Field");
        resp.setClientId(shipment.getClient().getClientId());
        resp.setClient(shipment.getClient().getName());
        resp.setRoute(shipment.getRoute() != null ? shipment.getRoute() : "Manila → TNL Baguio");
        resp.setRecipient(shipment.getRecipientName());
        resp.setRecipientDetails(new RecipientDetailsDto(
                shipment.getRecipientName(),
                shipment.getRecipientContact(),
                shipment.getRecipientAddress()
        ));
        resp.setRegisteredOn(shipment.getDateRegistered() != null
                ? shipment.getDateRegistered().format(DATE_FORMATTER) + " · " + resp.getOrigin()
                : "Aug 24, 2026");
        resp.setDescription(shipment.getDescription() != null ? shipment.getDescription() : "General Goods");
        resp.setQuantity(shipment.getQuantity());
        resp.setStatus(rollup.overallStatus);
        resp.setStatusRollup(rollup.statusRollup);
        resp.setPayment(paymentStr);
        resp.setChargeModel(shipment.getChargeModel() == ChargeModel.PER_PARCEL ? "Per unit" : "Flat");
        resp.setShippingFee(shipment.getShippingFee());
        resp.setOtherCharges(shipment.getOtherCharges());
        resp.setTotalAmount(shipment.getTotalAmount());
        resp.setAmountPaid(totalPaid);
        resp.setBalance(balance);
        resp.setPaidAtRegistration(shipment.getPaidAtRegistration());

        // Destination derivation
        String destination = "TNL Baguio Hub";
        if (shipment.getRoute() != null && shipment.getRoute().contains("→")) {
            String[] parts = shipment.getRoute().split("→");
            if (parts.length > 1) {
                destination = parts[1].trim();
            }
        }
        resp.setDestination(destination);

        // Dimensions and Weight calculation
        BigDecimal actualWeight = BigDecimal.ZERO;
        BigDecimal length = new BigDecimal("50");
        BigDecimal width = new BigDecimal("40");
        BigDecimal height = new BigDecimal("35");

        if (!parcels.isEmpty()) {
            ParcelUnit first = parcels.get(0);
            if (first.getLengthCm() != null) length = first.getLengthCm();
            if (first.getWidthCm() != null) width = first.getWidthCm();
            if (first.getHeightCm() != null) height = first.getHeightCm();

            for (ParcelUnit p : parcels) {
                if (p.getWeightKg() != null) {
                    actualWeight = actualWeight.add(p.getWeightKg());
                }
            }
        }
        if (actualWeight.compareTo(BigDecimal.ZERO) == 0) {
            actualWeight = new BigDecimal("2.5");
        }

        // Volume in cm3: L x W x H per unit * quantity
        BigDecimal unitVolumeCm3 = length.multiply(width).multiply(height);
        BigDecimal totalVolumeCm3 = unitVolumeCm3.multiply(new BigDecimal(shipment.getQuantity()));

        // Volumetric weight: totalVolumeCm3 / 5000
        BigDecimal volumetricWeight = totalVolumeCm3.divide(new BigDecimal("5000"), 2, RoundingMode.HALF_UP);

        // Billable weight: max(actualWeight, volumetricWeight)
        BigDecimal billableWeight = actualWeight.max(volumetricWeight);

        resp.setLengthCm(length);
        resp.setWidthCm(width);
        resp.setHeightCm(height);
        resp.setWeightKg(actualWeight);
        resp.setVolumeCm3(totalVolumeCm3);
        resp.setVolumetricWeightKg(volumetricWeight);
        resp.setBillableWeightKg(billableWeight);

        // Waybill summary
        Waybill waybill = waybillRepository.findByShipment_ShipmentId(shipment.getShipmentId()).orElse(null);
        if (waybill != null) {
            String wbStatusLabel = waybill.getStatus() == com.tnl.logistics.model.WaybillStatus.SIGNED_COMPLETED
                    ? "Waybill: Signed / Completed"
                    : (waybill.getStatus() == com.tnl.logistics.model.WaybillStatus.SENT_TO_HAULER ? "Waybill: Sent to Hauler" : "Waybill: Generated");
            resp.setWaybillStatus(wbStatusLabel);
            resp.setHauler(waybill.getHaulerName());
            resp.setWaybillGeneratedDate(waybill.getGeneratedAt() != null ? waybill.getGeneratedAt().format(DATE_FORMATTER) : "—");
            resp.setSignedBy(waybill.getSignedBy());
        } else {
            resp.setWaybillStatus("Waybill: Not Generated");
            resp.setHauler("—");
            resp.setWaybillGeneratedDate("—");
            resp.setSignedBy(null);
        }

        List<ParcelUnitResponse> unitResponses = parcels.stream().map(p -> new ParcelUnitResponse(
                p.getTrackingId(),
                p.getSeq(),
                shipment.getQuantity(),
                formatStatus(p.getCurrentStatus()),
                p.getLabelStatus() == LabelStatus.PRINTED ? "Printed" : "Pending",
                p.getReprintCount(),
                p.getWeightKg(),
                p.getLengthCm(),
                p.getWidthCm(),
                p.getHeightCm(),
                p.getVolumeCbm()
        )).collect(Collectors.toList());

        resp.setUnits(unitResponses);
        return resp;
    }

    @Override
    @Transactional(readOnly = true)
    public ParcelUnitDetailResponse getParcelUnitByTrackingId(String trackingId) {
        ParcelUnit parcel = parcelUnitRepository.findById(trackingId)
                .orElseThrow(() -> new IllegalArgumentException("Parcel unit not found: " + trackingId));

        Shipment shipment = parcel.getShipment();
        List<TrackingEvent> events = trackingEventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(trackingId);

        ParcelUnitDetailResponse resp = new ParcelUnitDetailResponse();
        resp.setTrackingId(parcel.getTrackingId());
        resp.setPackageIndex(parcel.getSeq());
        resp.setPackageCount(shipment.getQuantity());
        resp.setRecipientName(shipment.getRecipientName());
        resp.setShipmentId(shipment.getShipmentId());
        resp.setStatus(formatStatus(parcel.getCurrentStatus()));
        resp.setLabelStatus(parcel.getLabelStatus() == LabelStatus.PRINTED ? "Printed" : "Pending");
        resp.setClient(shipment.getClient().getName());
        resp.setWeight(parcel.getWeightKg() != null ? parcel.getWeightKg() : BigDecimal.ONE);
        resp.setLengthCm(parcel.getLengthCm());
        resp.setWidthCm(parcel.getWidthCm());
        resp.setHeightCm(parcel.getHeightCm());
        resp.setVolumeCbm(parcel.getVolumeCbm());
        resp.setRoute(shipment.getRoute() != null ? shipment.getRoute() : "Manila → TNL Baguio");

        List<TrackingEventResponse> history = events.stream().map(e -> new TrackingEventResponse(
                formatStatus(e.getStatus()),
                e.getEventTimestamp().format(DATE_FORMATTER),
                e.getEventTimestamp().format(TIME_FORMATTER),
                e.getStaff() != null ? e.getStaff().getFullName() : "Office Staff",
                e.getRemarks(),
                true,
                e.getEventTimestamp()
        )).collect(Collectors.toList());
        resp.setHistory(history);

        int totalLabelsPrinted = parcel.getLabelStatus() == LabelStatus.PRINTED ? (1 + parcel.getReprintCount()) : 0;

        resp.setPrinting(new PrintInfoDto(
                parcel.getLabelStatus() == LabelStatus.PRINTED ? "Printed" : "Pending",
                shipment.getDateRegistered() != null ? shipment.getDateRegistered().format(DATE_FORMATTER) + " · " + shipment.getDateRegistered().format(TIME_FORMATTER) : "Aug 24, 2026",
                "Maria Santos",
                "Brother RJ-2035B",
                totalLabelsPrinted > 0 ? totalLabelsPrinted : 1
        ));

        return resp;
    }

    @Override
    public void recordLabelPrint(String shipmentId, List<String> packageIds, String actingStaffUsername) {
        List<ParcelUnit> parcels;
        if (packageIds == null || packageIds.isEmpty()) {
            parcels = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId);
        } else {
            parcels = parcelUnitRepository.findAllById(packageIds);
        }

        for (ParcelUnit parcel : parcels) {
            if (parcel.getLabelStatus() == LabelStatus.NOT_PRINTED) {
                // First print: marks as Printed, keeping reprintCount at 0
                parcel.setLabelStatus(LabelStatus.PRINTED);
            } else {
                // Subsequent prints: increment reprintCount (1, 2, 3...)
                parcel.setReprintCount(parcel.getReprintCount() + 1);
            }
            parcelUnitRepository.save(parcel);
        }

        try {
            sseService.broadcastLabelPrint(shipmentId, packageIds);
        } catch (Exception ignored) {}
    }

    private ShipmentSummaryResponse mapToSummaryResponse(Shipment s) {
        List<ParcelUnit> parcels = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(s.getShipmentId());
        List<Payment> payments = paymentRepository.findByShipment_ShipmentId(s.getShipmentId());

        BigDecimal totalPaid = payments.stream()
                .map(Payment::getAmountPaid)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal balance = s.getTotalAmount().subtract(totalPaid);
        if (balance.compareTo(BigDecimal.ZERO) < 0) balance = BigDecimal.ZERO;

        String paymentStr = totalPaid.compareTo(s.getTotalAmount()) >= 0 ? "Paid"
                : (totalPaid.compareTo(BigDecimal.ZERO) > 0 ? "Partial" : "Unpaid");

        RollupStatus rollup = computeRollupStatus(parcels);

        String dateLabel = s.getDateRegistered() != null
                ? s.getDateRegistered().format(DATE_FORMATTER)
                : "Aug 24, 2026";

        return new ShipmentSummaryResponse(
                s.getShipmentId(),
                s.getClient().getClientId(),
                s.getClient().getName(),
                s.getRecipientName(),
                s.getRecipientContact(),
                s.getQuantity(),
                rollup.overallStatus,
                rollup.statusRollup,
                paymentStr,
                s.getTotalAmount(),
                totalPaid,
                balance,
                s.getRoute() != null ? s.getRoute() : "Manila → TNL Baguio",
                s.getDateRegistered(),
                dateLabel
        );
    }

    private static class RollupStatus {
        String overallStatus;
        String statusRollup;
        RollupStatus(String overallStatus, String statusRollup) {
            this.overallStatus = overallStatus;
            this.statusRollup = statusRollup;
        }
    }

    private RollupStatus computeRollupStatus(List<ParcelUnit> parcels) {
        if (parcels.isEmpty()) {
            return new RollupStatus("Registered", "0 / 0 Registered");
        }

        int total = parcels.size();
        Map<ParcelStatus, Long> counts = parcels.stream()
                .collect(Collectors.groupingBy(ParcelUnit::getCurrentStatus, Collectors.counting()));

        if (counts.containsKey(ParcelStatus.COMPLETED)) {
            long c = counts.get(ParcelStatus.COMPLETED);
            return new RollupStatus("Completed", c + " / " + total + " Completed");
        }
        if (counts.containsKey(ParcelStatus.LOADED_TO_HAULER)) {
            long c = counts.get(ParcelStatus.LOADED_TO_HAULER);
            return new RollupStatus("Loaded to Hauler", c + " / " + total + " Loaded to Hauler");
        }
        if (counts.containsKey(ParcelStatus.ARRIVED_AT_TNL)) {
            long c = counts.get(ParcelStatus.ARRIVED_AT_TNL);
            return new RollupStatus("Arrived at TNL", c + " / " + total + " Arrived at TNL");
        }
        if (counts.containsKey(ParcelStatus.LOADED_ON_TRUCK)) {
            long c = counts.get(ParcelStatus.LOADED_ON_TRUCK);
            return new RollupStatus("Loaded on Truck", c + " / " + total + " Loaded on Truck");
        }
        if (counts.containsKey(ParcelStatus.QR_GENERATED)) {
            long c = counts.get(ParcelStatus.QR_GENERATED);
            return new RollupStatus("QR Generated", c + " / " + total + " QR Generated");
        }

        long c = counts.getOrDefault(ParcelStatus.REGISTERED, (long) total);
        return new RollupStatus("Registered", c + " / " + total + " Registered");
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
}
