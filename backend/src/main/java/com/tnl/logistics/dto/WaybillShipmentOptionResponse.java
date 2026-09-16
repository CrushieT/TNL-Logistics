package com.tnl.logistics.dto;

import java.util.ArrayList;
import java.util.List;

public class WaybillShipmentOptionResponse {
    private String shipmentId;
    private String clientName;
    private String recipientName;
    private String destination;
    private Integer quantity;
    private String waybillId;
    private String waybillStatus; // "Not Generated", "Sent to Hauler", "Signed / Completed"
    private List<String> trackingNumbers = new ArrayList<>();

    public WaybillShipmentOptionResponse() {}

    public WaybillShipmentOptionResponse(String shipmentId, String clientName, String recipientName,
                                        String destination, Integer quantity, String waybillId,
                                        String waybillStatus, List<String> trackingNumbers) {
        this.shipmentId = shipmentId;
        this.clientName = clientName;
        this.recipientName = recipientName;
        this.destination = destination;
        this.quantity = quantity;
        this.waybillId = waybillId;
        this.waybillStatus = waybillStatus;
        this.trackingNumbers = trackingNumbers != null ? trackingNumbers : new ArrayList<>();
    }

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }

    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }

    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }

    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }

    public String getWaybillId() { return waybillId; }
    public void setWaybillId(String waybillId) { this.waybillId = waybillId; }

    public String getWaybillStatus() { return waybillStatus; }
    public void setWaybillStatus(String waybillStatus) { this.waybillStatus = waybillStatus; }

    public List<String> getTrackingNumbers() { return trackingNumbers; }
    public void setTrackingNumbers(List<String> trackingNumbers) { this.trackingNumbers = trackingNumbers; }
}
