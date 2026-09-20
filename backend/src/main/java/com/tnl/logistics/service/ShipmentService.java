package com.tnl.logistics.service;

import com.tnl.logistics.dto.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

/**
 * Service interface for shipment processing, tracking, and retrieval.
 */
public interface ShipmentService {

    ShipmentResponse registerShipment(ShipmentRegistrationRequest request, String actingStaffUserId);

    Page<ShipmentSummaryResponse> getShipments(String search, String status, String paymentStatus, String vehicleId, String labelStatus, Pageable pageable);

    default Page<ShipmentSummaryResponse> getShipments(String search, String status, String paymentStatus, String vehicleId, Pageable pageable) {
        return getShipments(search, status, paymentStatus, vehicleId, null, pageable);
    }

    default Page<ShipmentSummaryResponse> getShipments(String search, String status, String paymentStatus, Pageable pageable) {
        return getShipments(search, status, paymentStatus, null, null, pageable);
    }

    ShipmentDetailResponse getShipmentById(String shipmentId);

    ParcelUnitDetailResponse getParcelUnitByTrackingId(String trackingId);

    void recordLabelPrint(UUID printJobId, String shipmentId, List<String> packageIds, String actingStaffUserId, String printerId);
}
