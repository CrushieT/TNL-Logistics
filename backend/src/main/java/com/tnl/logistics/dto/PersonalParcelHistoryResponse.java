package com.tnl.logistics.dto;

import java.util.List;

public class PersonalParcelHistoryResponse {

    private String trackingId;
    private String shipmentId;
    private Integer packageIndex;
    private Integer packageCount;
    private String currentStatusCode;
    private String currentStatusDisplay;
    private String labelStatusCode;
    private String labelStatusDisplay;
    private String currentVehicleId;
    private String currentVehiclePlateNumber;
    private List<PersonalTrackingEventResponse> events;

    public PersonalParcelHistoryResponse() {}

    public PersonalParcelHistoryResponse(String trackingId, String shipmentId,
                                         Integer packageIndex, Integer packageCount,
                                         String currentStatusCode, String currentStatusDisplay,
                                         String labelStatusCode, String labelStatusDisplay,
                                         String currentVehicleId, String currentVehiclePlateNumber,
                                         List<PersonalTrackingEventResponse> events) {
        this.trackingId = trackingId;
        this.shipmentId = shipmentId;
        this.packageIndex = packageIndex;
        this.packageCount = packageCount;
        this.currentStatusCode = currentStatusCode;
        this.currentStatusDisplay = currentStatusDisplay;
        this.labelStatusCode = labelStatusCode;
        this.labelStatusDisplay = labelStatusDisplay;
        this.currentVehicleId = currentVehicleId;
        this.currentVehiclePlateNumber = currentVehiclePlateNumber;
        this.events = events;
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

    public String getCurrentStatusDisplay() { return currentStatusDisplay; }
    public void setCurrentStatusDisplay(String currentStatusDisplay) { this.currentStatusDisplay = currentStatusDisplay; }

    public String getLabelStatusCode() { return labelStatusCode; }
    public void setLabelStatusCode(String labelStatusCode) { this.labelStatusCode = labelStatusCode; }

    public String getLabelStatusDisplay() { return labelStatusDisplay; }
    public void setLabelStatusDisplay(String labelStatusDisplay) { this.labelStatusDisplay = labelStatusDisplay; }

    public String getCurrentVehicleId() { return currentVehicleId; }
    public void setCurrentVehicleId(String currentVehicleId) { this.currentVehicleId = currentVehicleId; }

    public String getCurrentVehiclePlateNumber() { return currentVehiclePlateNumber; }
    public void setCurrentVehiclePlateNumber(String currentVehiclePlateNumber) { this.currentVehiclePlateNumber = currentVehiclePlateNumber; }

    public List<PersonalTrackingEventResponse> getEvents() { return events; }
    public void setEvents(List<PersonalTrackingEventResponse> events) { this.events = events; }
}
