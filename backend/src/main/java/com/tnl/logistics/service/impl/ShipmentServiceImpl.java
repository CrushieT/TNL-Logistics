package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.ParcelUnitRequest;
import com.tnl.logistics.dto.ShipmentRegistrationRequest;
import com.tnl.logistics.dto.ShipmentResponse;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.ShipmentService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service implementation for shipment processing and registration.
 */
@Service
@Transactional
public class ShipmentServiceImpl implements ShipmentService {

    private final ShipmentRepository shipmentRepository;
    private final ParcelUnitRepository parcelUnitRepository;
    private final ClientRepository clientRepository;
    private final PaymentRepository paymentRepository;
    private final AppUserRepository appUserRepository;
    private final TrackingEventRepository trackingEventRepository;

    public ShipmentServiceImpl(ShipmentRepository shipmentRepository,
                               ParcelUnitRepository parcelUnitRepository,
                               ClientRepository clientRepository,
                               PaymentRepository paymentRepository,
                               AppUserRepository appUserRepository,
                               TrackingEventRepository trackingEventRepository) {
        this.shipmentRepository = shipmentRepository;
        this.parcelUnitRepository = parcelUnitRepository;
        this.clientRepository = clientRepository;
        this.paymentRepository = paymentRepository;
        this.appUserRepository = appUserRepository;
        this.trackingEventRepository = trackingEventRepository;
    }

    @Override
    public synchronized ShipmentResponse registerShipment(ShipmentRegistrationRequest request, String actingStaffUsername) {
        Client client = clientRepository.findById(request.getClientId())
                .orElseThrow(() -> new IllegalArgumentException("Client not found with ID: " + request.getClientId()));

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
            TrackingEvent event = new TrackingEvent(
                    unit,
                    ParcelStatus.REGISTERED,
                    actingStaff,
                    "Initial registration via " + request.getRegisteredVia()
            );
            trackingEventRepository.save(event);
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
    public List<ShipmentResponse> getAllShipments() {
        return shipmentRepository.findAll().stream()
                .map(s -> new ShipmentResponse(
                        s.getShipmentId(),
                        s.getClient().getClientId(),
                        s.getRecipientName(),
                        s.getTotalAmount(),
                        s.getPaidAtRegistration(),
                        List.of()
                ))
                .collect(Collectors.toList());
    }
}
