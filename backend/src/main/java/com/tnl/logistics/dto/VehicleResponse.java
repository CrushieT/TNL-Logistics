package com.tnl.logistics.dto;

import java.time.LocalDateTime;

public class VehicleResponse {

    private String vehicleId;
    private String plateNumber;
    private String vehicleType;
    private String description;
    private String status;
    private String remarks;
    private Long onTruckCount;
    private Boolean active;
    private LocalDateTime createdAt;

    public VehicleResponse() {}

    public VehicleResponse(String vehicleId, String plateNumber, String description, Boolean active, LocalDateTime createdAt) {
        this.vehicleId = vehicleId;
        this.plateNumber = plateNumber;
        this.vehicleType = "6-Wheeler Forward";
        this.description = description;
        this.status = Boolean.FALSE.equals(active) ? "Inactive" : "Active";
        this.remarks = "—";
        this.onTruckCount = 0L;
        this.active = active;
        this.createdAt = createdAt;
    }

    public VehicleResponse(String vehicleId, String plateNumber, String vehicleType, String description,
                           String status, String remarks, Long onTruckCount, Boolean active, LocalDateTime createdAt) {
        this.vehicleId = vehicleId;
        this.plateNumber = plateNumber;
        this.vehicleType = vehicleType;
        this.description = description;
        this.status = status;
        this.remarks = remarks;
        this.onTruckCount = onTruckCount;
        this.active = active;
        this.createdAt = createdAt;
    }

    public String getVehicleId() { return vehicleId; }
    public void setVehicleId(String vehicleId) { this.vehicleId = vehicleId; }

    public String getPlateNumber() { return plateNumber; }
    public void setPlateNumber(String plateNumber) { this.plateNumber = plateNumber; }

    public String getVehicleType() { return vehicleType; }
    public void setVehicleType(String vehicleType) { this.vehicleType = vehicleType; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public Long getOnTruckCount() { return onTruckCount; }
    public void setOnTruckCount(Long onTruckCount) { this.onTruckCount = onTruckCount; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
