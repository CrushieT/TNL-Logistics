package com.tnl.logistics.dto;

import com.tnl.logistics.model.ParcelStatus;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public class BatchTrackingScanRequest {

    @NotEmpty(message = "At least one tracking ID must be provided")
    private List<String> trackingIds;

    @NotNull(message = "Target status is required")
    private ParcelStatus targetStatus;

    private String vehicleId;
    private String remarks;

    public BatchTrackingScanRequest() {}

    public BatchTrackingScanRequest(List<String> trackingIds, ParcelStatus targetStatus, String vehicleId, String remarks) {
        this.trackingIds = trackingIds;
        this.targetStatus = targetStatus;
        this.vehicleId = vehicleId;
        this.remarks = remarks;
    }

    public List<String> getTrackingIds() { return trackingIds; }
    public void setTrackingIds(List<String> trackingIds) { this.trackingIds = trackingIds; }

    public ParcelStatus getTargetStatus() { return targetStatus; }
    public void setTargetStatus(ParcelStatus targetStatus) { this.targetStatus = targetStatus; }

    public String getVehicleId() { return vehicleId; }
    public void setVehicleId(String vehicleId) { this.vehicleId = vehicleId; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
}
