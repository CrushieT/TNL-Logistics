package com.tnl.logistics.service;

import com.tnl.logistics.dto.VehicleRequest;
import com.tnl.logistics.dto.VehicleResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface VehicleService {

    VehicleResponse createVehicle(VehicleRequest request);

    List<VehicleResponse> getActiveVehicles();

    Page<VehicleResponse> getActiveVehicleOptions(String search, Pageable pageable);

    List<VehicleResponse> getAllVehicles();

    VehicleResponse getVehicleById(String vehicleId);

    VehicleResponse updateVehicle(String vehicleId, VehicleRequest request);

    void deactivateVehicle(String vehicleId);
}
