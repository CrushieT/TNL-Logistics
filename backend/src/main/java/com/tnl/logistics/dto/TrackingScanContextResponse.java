package com.tnl.logistics.dto;

/**
 * DTO representing the scan context for field staff scanning.
 * Excludes sensitive recipient, billing, and PII data.
 */
public class TrackingScanContextResponse {

    private String trackingId;
    private String shipmentId;
    private Integer packageIndex;
    private Integer packageCount;
    private String currentStatusCode;
    private String currentStatusLabel;
    private String nextStatusCode;
    private String nextStatusLabel;
    private Boolean requiresVehicle;
    private String assignedVehicleId;
    private String assignedVehiclePlateNumber;
    private Boolean canScan;

    public TrackingScanContextResponse() {}

    public TrackingScanContextResponse(String trackingId, String shipmentId, Integer packageIndex,
                                       Integer packageCount, String currentStatusCode, String currentStatusLabel,
                                       String nextStatusCode, String nextStatusLabel, Boolean requiresVehicle,
                                       String assignedVehicleId, String assignedVehiclePlateNumber, Boolean canScan) {
        this.trackingId = trackingId;
        this.shipmentId = shipmentId;
        this.packageIndex = packageIndex;
        this.packageCount = packageCount;
        this.currentStatusCode = currentStatusCode;
        this.currentStatusLabel = currentStatusLabel;
        this.nextStatusCode = nextStatusCode;
        this.nextStatusLabel = nextStatusLabel;
        this.requiresVehicle = requiresVehicle;
        this.assignedVehicleId = assignedVehicleId;
        this.assignedVehiclePlateNumber = assignedVehiclePlateNumber;
        this.canScan = canScan;
    }

    public String getTrackingId() { return trackingId; }
    public void setTrackingId(String trackingId) { this.trackingId = trackingId; }

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

    public Integer getPackageIndex() { return packageIndex; }
    public void setPackageIndex(Integer packageIndex) { this.packageIndex = packageIndex; }

    public Integer getPackageCount() { return packageCount; }
    public void setPackageCount(Integer packageCount) { this.packageCount = packageCount; }

    public String getCurrentStatusCode() { return currentStatusCode; }
    public void setCurrentStatusCode(String currentStatusCode) { this.currentStatusCode = currentStatusCode; }

    public String getCurrentStatusLabel() { return currentStatusLabel; }
    public void setCurrentStatusLabel(String currentStatusLabel) { this.currentStatusLabel = currentStatusLabel; }

    public String getNextStatusCode() { return nextStatusCode; }
    public void setNextStatusCode(String nextStatusCode) { this.nextStatusCode = nextStatusCode; }

    public String getNextStatusLabel() { return nextStatusLabel; }
    public void setNextStatusLabel(String nextStatusLabel) { this.nextStatusLabel = nextStatusLabel; }

    public Boolean getRequiresVehicle() { return requiresVehicle; }
    public void setRequiresVehicle(Boolean requiresVehicle) { this.requiresVehicle = requiresVehicle; }

    public String getAssignedVehicleId() { return assignedVehicleId; }
    public void setAssignedVehicleId(String assignedVehicleId) { this.assignedVehicleId = assignedVehicleId; }

    public String getAssignedVehiclePlateNumber() { return assignedVehiclePlateNumber; }
    public void setAssignedVehiclePlateNumber(String assignedVehiclePlateNumber) { this.assignedVehiclePlateNumber = assignedVehiclePlateNumber; }

    public Boolean getCanScan() { return canScan; }
    public void setCanScan(Boolean canScan) { this.canScan = canScan; }
}
