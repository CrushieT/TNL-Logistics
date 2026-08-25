package com.tnl.logistics.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Response payload returned after registering a shipment.
 */
public class ShipmentResponse {

    private String shipmentId;
    private String clientId;
    private String recipientName;
    private BigDecimal totalAmount;
    private Boolean paidAtRegistration;
    private List<String> trackingIds;

    public ShipmentResponse() {}

    public ShipmentResponse(String shipmentId, String clientId, String recipientName, BigDecimal totalAmount, Boolean paidAtRegistration, List<String> trackingIds) {
        this.shipmentId = shipmentId;
        this.clientId = clientId;
        this.recipientName = recipientName;
        this.totalAmount = totalAmount;
        this.paidAtRegistration = paidAtRegistration;
        this.trackingIds = trackingIds;
    }

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public Boolean getPaidAtRegistration() { return paidAtRegistration; }
    public void setPaidAtRegistration(Boolean paidAtRegistration) { this.paidAtRegistration = paidAtRegistration; }

    public List<String> getTrackingIds() { return trackingIds; }
    public void setTrackingIds(List<String> trackingIds) { this.trackingIds = trackingIds; }
}
