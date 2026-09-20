package com.tnl.logistics.dto;

import java.time.LocalDateTime;

public class TrackingScanResponse {

    private String trackingId;
    private String previousStatus;
    private String newStatus;
    private String previousStatusCode;
    private String newStatusCode;
    private Boolean transitionApplied;
    private String vehicleId;
    private String vehiclePlateNumber;
    private LocalDateTime timestamp;
    private String actingStaff;
    private String shipmentId;
    private String statusRollup;

    public TrackingScanResponse() {}

    public TrackingScanResponse(String trackingId, String previousStatus, String newStatus,
                                String vehicleId, String vehiclePlateNumber, LocalDateTime timestamp,
                                String actingStaff, String shipmentId, String statusRollup) {
        this.trackingId = trackingId;
        this.previousStatus = previousStatus;
        this.newStatus = newStatus;
        this.vehicleId = vehicleId;
        this.vehiclePlateNumber = vehiclePlateNumber;
        this.timestamp = timestamp;
        this.actingStaff = actingStaff;
        this.shipmentId = shipmentId;
        this.statusRollup = statusRollup;
    }

    public TrackingScanResponse(String trackingId, String previousStatus, String newStatus,
                                String previousStatusCode, String newStatusCode, Boolean transitionApplied,
                                String vehicleId, String vehiclePlateNumber, LocalDateTime timestamp,
                                String actingStaff, String shipmentId, String statusRollup) {
        this.trackingId = trackingId;
        this.previousStatus = previousStatus;
        this.newStatus = newStatus;
        this.previousStatusCode = previousStatusCode;
        this.newStatusCode = newStatusCode;
        this.transitionApplied = transitionApplied;
        this.vehicleId = vehicleId;
        this.vehiclePlateNumber = vehiclePlateNumber;
        this.timestamp = timestamp;
        this.actingStaff = actingStaff;
        this.shipmentId = shipmentId;
        this.statusRollup = statusRollup;
    }

    public String getTrackingId() { return trackingId; }
    public void setTrackingId(String trackingId) { this.trackingId = trackingId; }

    public String getPreviousStatus() { return previousStatus; }
    public void setPreviousStatus(String previousStatus) { this.previousStatus = previousStatus; }

    public String getNewStatus() { return newStatus; }
    public void setNewStatus(String newStatus) { this.newStatus = newStatus; }

    public String getPreviousStatusCode() { return previousStatusCode; }
    public void setPreviousStatusCode(String previousStatusCode) { this.previousStatusCode = previousStatusCode; }

    public String getNewStatusCode() { return newStatusCode; }
    public void setNewStatusCode(String newStatusCode) { this.newStatusCode = newStatusCode; }

    public Boolean getTransitionApplied() { return transitionApplied; }
    public void setTransitionApplied(Boolean transitionApplied) { this.transitionApplied = transitionApplied; }

    public String getVehicleId() { return vehicleId; }
    public void setVehicleId(String vehicleId) { this.vehicleId = vehicleId; }

    public String getVehiclePlateNumber() { return vehiclePlateNumber; }
    public void setVehiclePlateNumber(String vehiclePlateNumber) { this.vehiclePlateNumber = vehiclePlateNumber; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public String getActingStaff() { return actingStaff; }
    public void setActingStaff(String actingStaff) { this.actingStaff = actingStaff; }

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

    public String getStatusRollup() { return statusRollup; }
    public void setStatusRollup(String statusRollup) { this.statusRollup = statusRollup; }
}
