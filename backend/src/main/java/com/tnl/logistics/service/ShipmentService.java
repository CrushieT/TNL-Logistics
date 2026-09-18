package com.tnl.logistics.service;

import com.tnl.logistics.dto.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * Service interface for shipment processing, tracking, and retrieval.
 */
public interface ShipmentService {

    ShipmentResponse registerShipment(ShipmentRegistrationRequest request, String actingStaffUserId);

    Page<ShipmentSummaryResponse> getShipments(String search, String status, String paymentStatus, String vehicleId, Pageable pageable);

    default Page<ShipmentSummaryResponse> getShipments(String search, String status, String paymentStatus, Pageable pageable) {
        return getShipments(search, status, paymentStatus, null, pageable);
    }

    ShipmentDetailResponse getShipmentById(String shipmentId);

    ParcelUnitDetailResponse getParcelUnitByTrackingId(String trackingId);

    void recordLabelPrint(String shipmentId, List<String> packageIds, String actingStaffUserId, String printerId);

    default void recordLabelPrint(String shipmentId, List<String> packageIds, String actingStaffUserId) {
        recordLabelPrint(shipmentId, packageIds, actingStaffUserId, null);
    }
}
