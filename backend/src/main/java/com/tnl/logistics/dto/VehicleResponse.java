package com.tnl.logistics.dto;

import java.time.LocalDateTime;

public class VehicleResponse {

    private String vehicleId;
    private String plateNumber;
    private String description;
    private Boolean active;
    private LocalDateTime createdAt;

    public VehicleResponse() {}

    public VehicleResponse(String vehicleId, String plateNumber, String description, Boolean active, LocalDateTime createdAt) {
        this.vehicleId = vehicleId;
        this.plateNumber = plateNumber;
        this.description = description;
        this.active = active;
        this.createdAt = createdAt;
    }

    public String getVehicleId() { return vehicleId; }
    public void setVehicleId(String vehicleId) { this.vehicleId = vehicleId; }

    public String getPlateNumber() { return plateNumber; }
    public void setPlateNumber(String plateNumber) { this.plateNumber = plateNumber; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
