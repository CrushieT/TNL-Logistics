package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.ShipmentService;
import com.tnl.logistics.service.SseService;
import com.tnl.logistics.service.IdentifierCounterService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
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
    private final PrintEventRepository printEventRepository;
    private final PrintAuditJobRepository printAuditJobRepository;
    private final com.tnl.logistics.service.SystemSettingService systemSettingService;
    private final IdentifierCounterService identifierCounterService;

    public ShipmentServiceImpl(ShipmentRepository shipmentRepository,
                               ParcelUnitRepository parcelUnitRepository,
                               ClientRepository clientRepository,
                               PaymentRepository paymentRepository,
                               AppUserRepository appUserRepository,
                               TrackingEventRepository trackingEventRepository,
                               WaybillRepository waybillRepository,
                               SseService sseService,
                               PrintEventRepository printEventRepository,
                               PrintAuditJobRepository printAuditJobRepository,
                               com.tnl.logistics.service.SystemSettingService systemSettingService,
                               IdentifierCounterService identifierCounterService) {
        this.shipmentRepository = shipmentRepository;
        this.parcelUnitRepository = parcelUnitRepository;
        this.clientRepository = clientRepository;
        this.paymentRepository = paymentRepository;
        this.appUserRepository = appUserRepository;
        this.trackingEventRepository = trackingEventRepository;
        this.waybillRepository = waybillRepository;
        this.sseService = sseService;
        this.printEventRepository = printEventRepository;
        this.printAuditJobRepository = printAuditJobRepository;
        this.systemSettingService = systemSettingService;
        this.identifierCounterService = identifierCounterService;
    }

    @Override
    public ShipmentResponse registerShipment(ShipmentRegistrationRequest request, String actingStaffUserId) {
        Client client = clientRepository.findById(request.getClientId())
                .orElseThrow(() -> new IllegalArgumentException("Client not found with ID: " + request.getClientId()));

        if (Boolean.FALSE.equals(client.getActive())) {
            throw new IllegalArgumentException("Cannot register shipment for inactive client: " + client.getName());
        }

        AppUser actingStaff = appUserRepository.findById(actingStaffUserId)
                .orElseThrow(() -> new IllegalArgumentException("Staff user not found: " + actingStaffUserId));

        // Validate parcel items count and contiguous sequence (Item 4)
        if (request.getParcels() == null || request.getParcels().isEmpty()) {
            throw new IllegalArgumentException("Shipment must contain at least one parcel unit.");
        }

        if (request.getQuantity() == null || !request.getQuantity().equals(request.getParcels().size())) {
            throw new IllegalArgumentException(String.format(
                    "Shipment quantity (%s) must match parcel items count (%d).",
                    request.getQuantity(),
                    request.getParcels().size()
            ));
        }

        List<Integer> seqNumbers = request.getParcels().stream()
                .map(ParcelUnitRequest::getSeq)
                .sorted()
                .toList();

        for (int i = 0; i < seqNumbers.size(); i++) {
            int expectedSeq = i + 1;
            Integer actualSeq = seqNumbers.get(i);
            if (actualSeq == null || actualSeq != expectedSeq) {
                throw new IllegalArgumentException(String.format(
                        "Parcel sequence numbers must form a contiguous sequence from 1 to %d without duplicates or gaps.",
                        seqNumbers.size()
                ));
            }
        }

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
        long nextShipmentSeq = identifierCounterService.next(IdentifierCounterService.IdentifierFamily.SHIPMENT, Integer.valueOf(currentYear));
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
        long nextTrackingSeq = identifierCounterService.next(
                IdentifierCounterService.IdentifierFamily.TRACKING,
                Integer.valueOf(currentYear),
                request.getParcels().size()
        );

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
            unit.setCurrentStatus(ParcelStatus.QR_GENERATED);
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
    public Page<ShipmentSummaryResponse> getShipments(String search, String status, String paymentStatus, String vehicleId, String labelStatus, Pageable pageable) {
        String cleanSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;
        String cleanStatus = normalizeStatus(status);
        String cleanPayment = normalizePayment(paymentStatus);
        String cleanVehicle = normalizeVehicle(vehicleId);
        String cleanLabel = normalizeLabel(labelStatus);

        Page<Shipment> shipmentsPage = shipmentRepository.searchShipmentsWithFilters(cleanSearch, cleanStatus, cleanPayment, cleanVehicle, cleanLabel, pageable);
        List<Shipment> shipments = shipmentsPage.getContent();
        if (shipments.isEmpty()) {
            return new PageImpl<>(Collections.emptyList(), pageable, shipmentsPage.getTotalElements());
        }

        List<String> shipmentIds = shipments.stream()
                .map(Shipment::getShipmentId)
                .collect(Collectors.toList());

        List<ParcelUnit> allParcels = parcelUnitRepository.findByShipment_ShipmentIdInOrderBySeqAsc(shipmentIds);
        Map<String, List<ParcelUnit>> parcelsByShipment = allParcels.stream()
                .filter(p -> p.getShipment() != null)
                .collect(Collectors.groupingBy(p -> p.getShipment().getShipmentId()));

        List<Payment> allPayments = paymentRepository.findByShipment_ShipmentIdIn(shipmentIds);
        Map<String, List<Payment>> paymentsByShipment = allPayments.stream()
                .filter(p -> p.getShipment() != null)
                .collect(Collectors.groupingBy(p -> p.getShipment().getShipmentId()));

        // Check if any parcels need vehicle fallback from tracking events
        List<String> trackingIdsNeedingVehicle = allParcels.stream()
                .filter(p -> p.getCurrentVehicle() == null)
                .map(ParcelUnit::getTrackingId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        Map<String, TrackingEvent> latestEventWithVehicleByTrackingId = new HashMap<>();
        if (!trackingIdsNeedingVehicle.isEmpty()) {
            List<TrackingEvent> events = trackingEventRepository.findByParcelUnit_TrackingIdInAndVehicleNotNullOrderByEventTimestampAsc(trackingIdsNeedingVehicle);
            for (TrackingEvent ev : events) {
                if (ev.getParcelUnit() != null) {
                    latestEventWithVehicleByTrackingId.put(ev.getParcelUnit().getTrackingId(), ev);
                }
            }
        }

        List<ShipmentSummaryResponse> summaries = shipments.stream()
                .map(s -> mapToSummaryResponse(
                        s,
                        parcelsByShipment.getOrDefault(s.getShipmentId(), Collections.emptyList()),
                        paymentsByShipment.getOrDefault(s.getShipmentId(), Collections.emptyList()),
                        latestEventWithVehicleByTrackingId
                ))
                .collect(Collectors.toList());

        return new PageImpl<>(summaries, pageable, shipmentsPage.getTotalElements());
    }

    private String normalizeVehicle(String vehicleId) {
        if (vehicleId == null || vehicleId.trim().isEmpty() || vehicleId.equalsIgnoreCase("ALL")) {
            return null;
        }
        return vehicleId.trim();
    }

    private String normalizeStatus(String status) {
        if (status == null || status.trim().isEmpty() || status.equalsIgnoreCase("ALL")) {
            return null;
        }
        return status.trim().toUpperCase().replace(" ", "_");
    }

    private String normalizePayment(String paymentStatus) {
        if (paymentStatus == null || paymentStatus.trim().isEmpty() || paymentStatus.equalsIgnoreCase("ALL")) {
            return null;
        }
        return paymentStatus.trim().toUpperCase();
    }

    private String normalizeLabel(String labelStatus) {
        if (labelStatus == null || labelStatus.trim().isEmpty() || labelStatus.equalsIgnoreCase("ALL")) {
            return null;
        }
        return labelStatus.trim().toUpperCase().replace(" ", "_");
    }

    private String extractDestination(String route) {
        if (route == null || route.isBlank()) {
            return null;
        }
        String[] routeParts = route.trim().split("\\s*(?:→|->|(?i:\\bto\\b))\\s*", 2);
        if (routeParts.length < 2 || routeParts[1].isBlank()) {
            return null;
        }
        return routeParts[1].trim();
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
        resp.setRoute(shipment.getRoute());
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

        resp.setDestination(extractDestination(shipment.getRoute()));

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

        // Volumetric weight: totalVolumeCm3 / divisor
        int divisor = (systemSettingService != null && systemSettingService.getVolumetricDivisor() != null)
                ? systemSettingService.getVolumetricDivisor()
                : 5000;
        BigDecimal volumetricWeight = totalVolumeCm3.divide(new BigDecimal(String.valueOf(divisor)), 2, RoundingMode.HALF_UP);

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

        List<TrackingEventResponse> history = events.stream().map(e -> {
            String vehiclePlate = null;
            if (e.getVehicle() != null) {
                vehiclePlate = e.getVehicle().getPlateNumber() != null ? e.getVehicle().getPlateNumber() : e.getVehicle().getVehicleId();
            }
            return new TrackingEventResponse(
                    formatStatus(e.getStatus()),
                    e.getEventTimestamp().format(DATE_FORMATTER),
                    e.getEventTimestamp().format(TIME_FORMATTER),
                    e.getStaff() != null ? e.getStaff().getFullName() : "Office Staff",
                    null,
                    vehiclePlate,
                    true,
                    e.getEventTimestamp()
            );
        }).collect(Collectors.toList());
        resp.setHistory(history);

        int totalLabelsPrinted = parcel.getLabelStatus() == LabelStatus.PRINTED ? (1 + parcel.getReprintCount()) : 0;

        List<PrintEvent> printEvents = printEventRepository.findByParcelUnit_TrackingIdOrderByPrintTimestampDescPrintIdDesc(trackingId);
        if (!printEvents.isEmpty()) {
            List<PrintEventItemResponse> printEventResponses = printEvents.stream().map(pe -> new PrintEventItemResponse(
                    pe.getKind() == PrintKind.REPRINT ? "Reprint" : "Print",
                    pe.getStaff() != null ? pe.getStaff().getFullName() : "Office Staff",
                    pe.getPrintTimestamp() != null ? pe.getPrintTimestamp().format(DATE_FORMATTER) + " " + pe.getPrintTimestamp().format(TIME_FORMATTER) : "—",
                    pe.getPrinterId()
            )).collect(Collectors.toList());
            resp.setPrintEvents(printEventResponses);
        } else if (parcel.getLabelStatus() == LabelStatus.PRINTED) {
            String fallbackDate = shipment.getDateRegistered() != null
                    ? shipment.getDateRegistered().format(DATE_FORMATTER) + " " + shipment.getDateRegistered().format(TIME_FORMATTER)
                    : "—";
            String fallbackStaff = events.stream()
                    .filter(e -> e.getStaff() != null)
                    .map(e -> e.getStaff().getFullName())
                    .findFirst()
                    .orElse("Office Staff");
            resp.setPrintEvents(List.of(new PrintEventItemResponse("Print", fallbackStaff, fallbackDate, "Brother RJ-2035B")));
        }

        Optional<PrintEvent> latestPrintOpt = printEventRepository.findTopByParcelUnit_TrackingIdOrderByPrintTimestampDescPrintIdDesc(trackingId);
        String printStatus = parcel.getLabelStatus() == LabelStatus.PRINTED ? "Printed" : "Pending";
        String printDate;
        String printStaff;
        String printPrinter;

        if (latestPrintOpt.isPresent()) {
            PrintEvent event = latestPrintOpt.get();
            printDate = event.getPrintTimestamp() != null
                    ? event.getPrintTimestamp().format(DATE_FORMATTER) + " · " + event.getPrintTimestamp().format(TIME_FORMATTER)
                    : "—";
            printStaff = event.getStaff() != null ? event.getStaff().getFullName() : "Office Staff";
            printPrinter = event.getPrinterId() != null ? event.getPrinterId() : "Brother RJ-2035B";
        } else if (parcel.getLabelStatus() == LabelStatus.PRINTED) {
            printDate = shipment.getDateRegistered() != null
                    ? shipment.getDateRegistered().format(DATE_FORMATTER) + " · " + shipment.getDateRegistered().format(TIME_FORMATTER)
                    : "—";
            printStaff = events.stream()
                    .filter(e -> e.getStaff() != null)
                    .map(e -> e.getStaff().getFullName())
                    .findFirst()
                    .orElse("Office Staff");
            printPrinter = "Brother RJ-2035B";
        } else {
            printDate = "—";
            printStaff = "—";
            printPrinter = "—";
        }

        resp.setPrinting(new PrintInfoDto(
                printStatus,
                printDate,
                printStaff,
                printPrinter,
                totalLabelsPrinted > 0 ? totalLabelsPrinted : 0
        ));

        return resp;
    }

    @Override
    public void recordLabelPrint(UUID printJobId, String shipmentId, List<String> packageIds,
                                 String actingStaffUserId, String printerId) {
        Shipment shipment = shipmentRepository.findByIdForUpdate(shipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Shipment not found with ID: " + shipmentId));

        AppUser actingStaff = appUserRepository.findById(actingStaffUserId)
                .orElseThrow(() -> new IllegalArgumentException("Staff user not found: " + actingStaffUserId));

        String assignedPrinter = normalizePrinterId(printerId);
        List<ParcelUnit> parcels = resolvePrintBatch(shipmentId, packageIds);
        List<String> trackingIds = parcels.stream()
                .map(ParcelUnit::getTrackingId)
                .sorted()
                .toList();
        String requestFingerprint = createPrintFingerprint(shipmentId, trackingIds, actingStaffUserId, assignedPrinter);
        String jobId = printJobId.toString();

        Optional<PrintAuditJob> existingJob = printAuditJobRepository.findById(jobId);
        if (existingJob.isPresent()) {
            if (existingJob.get().getRequestFingerprint().equals(requestFingerprint)) {
                return;
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Print job ID was already used with different audit details");
        }

        PrintAuditJob printAuditJob = printAuditJobRepository.saveAndFlush(
                new PrintAuditJob(jobId, shipment, actingStaff, assignedPrinter, requestFingerprint)
        );

        for (ParcelUnit parcel : parcels) {
            PrintKind printKind;
            if (parcel.getLabelStatus() == LabelStatus.NOT_PRINTED) {
                parcel.setLabelStatus(LabelStatus.PRINTED);
                printKind = PrintKind.PRINT;
            } else {
                parcel.setReprintCount(parcel.getReprintCount() + 1);
                printKind = PrintKind.REPRINT;
            }
            parcelUnitRepository.save(parcel);
            printEventRepository.save(new PrintEvent(
                    parcel, printKind, 1, actingStaff, assignedPrinter, printAuditJob
            ));
        }

        try {
            sseService.broadcastLabelPrint(shipmentId, trackingIds);
        } catch (Exception ignored) {}
    }

    private List<ParcelUnit> resolvePrintBatch(String shipmentId, List<String> packageIds) {
        if (packageIds == null || packageIds.isEmpty()) {
            List<ParcelUnit> allParcels = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId);
            if (allParcels.isEmpty()) {
                throw new IllegalArgumentException("Shipment has no parcel units: " + shipmentId);
            }
            return allParcels;
        }

        List<String> normalizedIds = packageIds.stream().map(String::trim).toList();
        if (new HashSet<>(normalizedIds).size() != normalizedIds.size()) {
            throw new IllegalArgumentException("Tracking IDs must not contain duplicates");
        }

        List<ParcelUnit> parcels = parcelUnitRepository
                .findByShipment_ShipmentIdAndTrackingIdIn(shipmentId, normalizedIds);
        if (parcels.size() != normalizedIds.size()) {
            throw new IllegalArgumentException("One or more tracking IDs do not belong to shipment: " + shipmentId);
        }
        parcels.sort(Comparator.comparing(ParcelUnit::getSeq));
        return parcels;
    }

    private String normalizePrinterId(String printerId) {
        if (printerId == null || printerId.isBlank()) {
            return null;
        }
        return printerId.trim();
    }

    private String createPrintFingerprint(String shipmentId, List<String> trackingIds,
                                          String staffUserId, String printerId) {
        String canonicalRequest = String.join("\n",
                shipmentId,
                String.join(",", trackingIds),
                staffUserId,
                printerId != null ? printerId : ""
        );
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(canonicalRequest.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }


    private ShipmentSummaryResponse mapToSummaryResponse(
            Shipment s,
            List<ParcelUnit> parcels,
            List<Payment> payments,
            Map<String, TrackingEvent> latestEventWithVehicleByTrackingId
    ) {
        if (parcels == null) parcels = Collections.emptyList();
        if (payments == null) payments = Collections.emptyList();

        BigDecimal totalPaid = payments.stream()
                .map(Payment::getAmountPaid)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal balance = s.getTotalAmount().subtract(totalPaid);
        if (balance.compareTo(BigDecimal.ZERO) < 0) balance = BigDecimal.ZERO;

        String paymentStr = totalPaid.compareTo(s.getTotalAmount()) >= 0 ? "Paid"
                : (totalPaid.compareTo(BigDecimal.ZERO) > 0 ? "Partial" : "Unpaid");

        RollupStatus rollup = computeRollupStatus(parcels);

        String dateLabel = s.getDateRegistered() != null
                ? s.getDateRegistered().format(DATE_FORMATTER)
                : "Aug 24, 2026";

        String vehicleId = null;
        String vehiclePlate = null;
        for (ParcelUnit p : parcels) {
            if (p.getCurrentVehicle() != null) {
                vehicleId = p.getCurrentVehicle().getVehicleId();
                vehiclePlate = p.getCurrentVehicle().getPlateNumber();
                break;
            }
        }
        if (vehicleId == null && !parcels.isEmpty() && latestEventWithVehicleByTrackingId != null) {
            for (ParcelUnit p : parcels) {
                TrackingEvent ev = latestEventWithVehicleByTrackingId.get(p.getTrackingId());
                if (ev != null && ev.getVehicle() != null) {
                    vehicleId = ev.getVehicle().getVehicleId();
                    vehiclePlate = ev.getVehicle().getPlateNumber();
                    break;
                }
            }
        }

        String clientId = s.getClient() != null ? s.getClient().getClientId() : null;
        String clientName = s.getClient() != null ? s.getClient().getName() : "—";

        boolean allLabelsPrinted = !parcels.isEmpty() && parcels.stream().allMatch(p -> p.getLabelStatus() == LabelStatus.PRINTED);
        String registeredVia = s.getRegisteredVia() != null ? s.getRegisteredVia().name() : null;

        return new ShipmentSummaryResponse(
                s.getShipmentId(),
                clientId,
                clientName,
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
                dateLabel,
                vehicleId,
                vehiclePlate,
                registeredVia,
                allLabelsPrinted
        );
    }

    private ShipmentSummaryResponse mapToSummaryResponse(Shipment s) {
        List<ParcelUnit> parcels = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(s.getShipmentId());
        List<Payment> payments = paymentRepository.findByShipment_ShipmentId(s.getShipmentId());
        Map<String, TrackingEvent> eventMap = new HashMap<>();
        if (!parcels.isEmpty()) {
            List<String> tIds = parcels.stream().map(ParcelUnit::getTrackingId).collect(Collectors.toList());
            List<TrackingEvent> events = trackingEventRepository.findByParcelUnit_TrackingIdInAndVehicleNotNullOrderByEventTimestampAsc(tIds);
            for (TrackingEvent ev : events) {
                if (ev.getParcelUnit() != null) {
                    eventMap.put(ev.getParcelUnit().getTrackingId(), ev);
                }
            }
        }
        return mapToSummaryResponse(s, parcels, payments, eventMap);
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
