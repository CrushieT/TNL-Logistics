package com.tnl.logistics.service;

import com.tnl.logistics.dto.ShipmentRegistrationRequest;
import com.tnl.logistics.dto.ShipmentResponse;
import java.util.List;

/**
 * Service interface for shipment processing and registration.
 */
public interface ShipmentService {

    ShipmentResponse registerShipment(ShipmentRegistrationRequest request, String actingStaffUsername);

    List<ShipmentResponse> getAllShipments();
}
