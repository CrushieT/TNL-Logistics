package com.tnl.logistics.service;

import com.tnl.logistics.dto.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * Service interface for shipment processing, tracking, and retrieval.
 */
public interface ShipmentService {

    ShipmentResponse registerShipment(ShipmentRegistrationRequest request, String actingStaffUsername);

    Page<ShipmentSummaryResponse> getShipments(String search, String status, String paymentStatus, Pageable pageable);

    ShipmentDetailResponse getShipmentById(String shipmentId);

    ParcelUnitDetailResponse getParcelUnitByTrackingId(String trackingId);

    void recordLabelPrint(String shipmentId, List<String> packageIds, String actingStaffUsername);
}
