package com.tnl.logistics.service;

import com.tnl.logistics.dto.VehicleRequest;
import com.tnl.logistics.dto.VehicleResponse;

import java.util.List;

public interface VehicleService {

    VehicleResponse createVehicle(VehicleRequest request);

    List<VehicleResponse> getActiveVehicles();

    List<VehicleResponse> getAllVehicles();

    VehicleResponse getVehicleById(String vehicleId);

    VehicleResponse updateVehicle(String vehicleId, VehicleRequest request);

    void deactivateVehicle(String vehicleId);
}
