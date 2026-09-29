package com.tnl.logistics.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class VehicleRequest {

    @NotBlank(message = "Plate number is required")
    @Size(max = 20, message = "Plate number cannot exceed 20 characters")
    private String plateNumber;

    @Size(max = 50, message = "Vehicle type cannot exceed 50 characters")
    private String vehicleType = "6-Wheeler Forward";

    @NotBlank(message = "Vehicle description is required")
    @Size(max = 100, message = "Vehicle description cannot exceed 100 characters")
    private String description;

    @Size(max = 30, message = "Status cannot exceed 30 characters")
    private String status = "Active";

    @Size(max = 255, message = "Remarks cannot exceed 255 characters")
    private String remarks;

    private Boolean active = true;

    public VehicleRequest() {}

    public VehicleRequest(String plateNumber, String description, Boolean active) {
        this.plateNumber = plateNumber;
        this.description = description;
        this.active = active;
        this.vehicleType = "6-Wheeler Forward";
        this.status = Boolean.FALSE.equals(active) ? "Inactive" : "Active";
    }

    public VehicleRequest(String plateNumber, String vehicleType, String description, String status, String remarks, Boolean active) {
        this.plateNumber = plateNumber;
        this.vehicleType = vehicleType;
        this.description = description;
        this.status = status;
        this.remarks = remarks;
        this.active = active;
    }

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

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}
