package com.tnl.logistics.dto;

import com.tnl.logistics.model.ParcelStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public class BatchTrackingScanRequest {

    @NotNull(message = "Tracking IDs list is required")
    @Size(min = 1, max = 100, message = "Batch scan must contain between 1 and 100 tracking IDs")
    private List<@NotBlank(message = "Tracking ID must not be blank") @Size(max = 64, message = "Tracking ID exceeds maximum length") String> trackingIds;

    @NotNull(message = "Target status is required")
    private ParcelStatus targetStatus;

    @Size(max = 64, message = "Vehicle ID exceeds maximum length")
    private String vehicleId;

    @Size(max = 255, message = "Remarks exceed maximum length")
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
