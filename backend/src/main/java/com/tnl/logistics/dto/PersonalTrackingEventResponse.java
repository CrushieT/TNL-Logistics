package com.tnl.logistics.dto;

import java.time.LocalDateTime;

public class PersonalTrackingEventResponse {

    private Long eventId;
    private String trackingId;
    private String shipmentId;
    private Integer packageIndex;
    private Integer packageCount;
    private String statusCode;
    private String statusDisplay;
    private String vehicleId;
    private String vehiclePlateNumber;
    private LocalDateTime timestamp;
    private String syncStatus;

    public PersonalTrackingEventResponse() {}

    public PersonalTrackingEventResponse(Long eventId, String trackingId, String shipmentId,
                                         Integer packageIndex, Integer packageCount,
                                         String statusCode, String statusDisplay,
                                         String vehicleId, String vehiclePlateNumber,
                                         LocalDateTime timestamp, String syncStatus) {
        this.eventId = eventId;
        this.trackingId = trackingId;
        this.shipmentId = shipmentId;
        this.packageIndex = packageIndex;
        this.packageCount = packageCount;
        this.statusCode = statusCode;
        this.statusDisplay = statusDisplay;
        this.vehicleId = vehicleId;
        this.vehiclePlateNumber = vehiclePlateNumber;
        this.timestamp = timestamp;
        this.syncStatus = syncStatus;
    }

    public Long getEventId() { return eventId; }
    public void setEventId(Long eventId) { this.eventId = eventId; }

    public String getTrackingId() { return trackingId; }
    public void setTrackingId(String trackingId) { this.trackingId = trackingId; }

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

    public Integer getPackageIndex() { return packageIndex; }
    public void setPackageIndex(Integer packageIndex) { this.packageIndex = packageIndex; }

    public Integer getPackageCount() { return packageCount; }
    public void setPackageCount(Integer packageCount) { this.packageCount = packageCount; }

    public String getStatusCode() { return statusCode; }
    public void setStatusCode(String statusCode) { this.statusCode = statusCode; }

    public String getStatusDisplay() { return statusDisplay; }
    public void setStatusDisplay(String statusDisplay) { this.statusDisplay = statusDisplay; }

    public String getVehicleId() { return vehicleId; }
    public void setVehicleId(String vehicleId) { this.vehicleId = vehicleId; }

    public String getVehiclePlateNumber() { return vehiclePlateNumber; }
    public void setVehiclePlateNumber(String vehiclePlateNumber) { this.vehiclePlateNumber = vehiclePlateNumber; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public String getSyncStatus() { return syncStatus; }
    public void setSyncStatus(String syncStatus) { this.syncStatus = syncStatus; }
}
