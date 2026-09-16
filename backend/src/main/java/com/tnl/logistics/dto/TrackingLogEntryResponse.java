package com.tnl.logistics.dto;

import java.time.LocalDateTime;

/**
 * DTO representing an individual immutable parcel tracking audit log entry.
 */
public class TrackingLogEntryResponse {

    private Long eventId;
    private String trackingId;
    private String shipmentId;
    private String packageDisplay;
    private String status;
    private String statusDisplay;
    private String vehicleId;
    private String vehiclePlateNumber;
    private String staffUsername;
    private String staffName;
    private String staffRole;
    private String staffType;
    private String remarks;
    private LocalDateTime timestamp;
    private String formattedTimestamp;

    public TrackingLogEntryResponse() {}

    public TrackingLogEntryResponse(Long eventId, String trackingId, String shipmentId,
                                    String packageDisplay, String status, String statusDisplay,
                                    String vehicleId, String vehiclePlateNumber,
                                    String staffUsername, String staffName, String staffRole,
                                    String staffType, String remarks,
                                    LocalDateTime timestamp, String formattedTimestamp) {
        this.eventId = eventId;
        this.trackingId = trackingId;
        this.shipmentId = shipmentId;
        this.packageDisplay = packageDisplay;
        this.status = status;
        this.statusDisplay = statusDisplay;
        this.vehicleId = vehicleId;
        this.vehiclePlateNumber = vehiclePlateNumber;
        this.staffUsername = staffUsername;
        this.staffName = staffName;
        this.staffRole = staffRole;
        this.staffType = staffType;
        this.remarks = remarks;
        this.timestamp = timestamp;
        this.formattedTimestamp = formattedTimestamp;
    }

    public Long getEventId() { return eventId; }
    public void setEventId(Long eventId) { this.eventId = eventId; }

    public String getTrackingId() { return trackingId; }
    public void setTrackingId(String trackingId) { this.trackingId = trackingId; }

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

    public String getPackageDisplay() { return packageDisplay; }
    public void setPackageDisplay(String packageDisplay) { this.packageDisplay = packageDisplay; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getStatusDisplay() { return statusDisplay; }
    public void setStatusDisplay(String statusDisplay) { this.statusDisplay = statusDisplay; }

    public String getVehicleId() { return vehicleId; }
    public void setVehicleId(String vehicleId) { this.vehicleId = vehicleId; }

    public String getVehiclePlateNumber() { return vehiclePlateNumber; }
    public void setVehiclePlateNumber(String vehiclePlateNumber) { this.vehiclePlateNumber = vehiclePlateNumber; }

    public String getStaffUsername() { return staffUsername; }
    public void setStaffUsername(String staffUsername) { this.staffUsername = staffUsername; }

    public String getStaffName() { return staffName; }
    public void setStaffName(String staffName) { this.staffName = staffName; }

    public String getStaffRole() { return staffRole; }
    public void setStaffRole(String staffRole) { this.staffRole = staffRole; }

    public String getStaffType() { return staffType; }
    public void setStaffType(String staffType) { this.staffType = staffType; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public String getFormattedTimestamp() { return formattedTimestamp; }
    public void setFormattedTimestamp(String formattedTimestamp) { this.formattedTimestamp = formattedTimestamp; }
}
