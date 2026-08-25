package com.tnl.logistics.dto;

import com.tnl.logistics.model.ParcelStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class TrackingScanRequest {

    @NotBlank(message = "Tracking ID is required")
    private String trackingId;

    @NotNull(message = "Target status is required")
    private ParcelStatus targetStatus;

    private String vehicleId;
    private String remarks;

    public TrackingScanRequest() {}

    public TrackingScanRequest(String trackingId, ParcelStatus targetStatus, String vehicleId, String remarks) {
        this.trackingId = trackingId;
        this.targetStatus = targetStatus;
        this.vehicleId = vehicleId;
        this.remarks = remarks;
    }

    public String getTrackingId() { return trackingId; }
    public void setTrackingId(String trackingId) { this.trackingId = trackingId; }

    public ParcelStatus getTargetStatus() { return targetStatus; }
    public void setTargetStatus(ParcelStatus targetStatus) { this.targetStatus = targetStatus; }

    public String getVehicleId() { return vehicleId; }
    public void setVehicleId(String vehicleId) { this.vehicleId = vehicleId; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
}
