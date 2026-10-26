package com.tnl.logistics.dto;

import jakarta.validation.constraints.NotBlank;

public class WaybillReturnScanRequest {
    @NotBlank
    private String trackingId;

    public String getTrackingId() { return trackingId; }
    public void setTrackingId(String trackingId) { this.trackingId = trackingId; }
}
