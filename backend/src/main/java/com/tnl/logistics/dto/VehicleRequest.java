package com.tnl.logistics.dto;

import jakarta.validation.constraints.NotBlank;

public class VehicleRequest {

    @NotBlank(message = "Plate number is required")
    private String plateNumber;

    @NotBlank(message = "Vehicle description is required")
    private String description;

    private Boolean active = true;

    public VehicleRequest() {}

    public VehicleRequest(String plateNumber, String description, Boolean active) {
        this.plateNumber = plateNumber;
        this.description = description;
        this.active = active;
    }

    public String getPlateNumber() { return plateNumber; }
    public void setPlateNumber(String plateNumber) { this.plateNumber = plateNumber; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}
