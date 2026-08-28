package com.tnl.logistics.dto;

import com.tnl.logistics.model.WaybillStatus;
import java.time.LocalDateTime;

public class WaybillSummaryResponse {
    private String waybillId;
    private String shipmentId;
    private String clientName;
    private String recipientName;
    private String destination;
    private Integer quantity;
    private String haulerName;
    private WaybillStatus status;
    private String statusLabel;
    private LocalDateTime generatedAt;
    private String generatedDate;
    private String signedBy;
    private LocalDateTime signedAt;

    public WaybillSummaryResponse() {}

    public WaybillSummaryResponse(String waybillId, String shipmentId, String clientName, String recipientName, String destination, Integer quantity, String haulerName, WaybillStatus status, String statusLabel, LocalDateTime generatedAt, String generatedDate, String signedBy, LocalDateTime signedAt) {
        this.waybillId = waybillId;
        this.shipmentId = shipmentId;
        this.clientName = clientName;
        this.recipientName = recipientName;
        this.destination = destination;
        this.quantity = quantity;
        this.haulerName = haulerName;
        this.status = status;
        this.statusLabel = statusLabel;
        this.generatedAt = generatedAt;
        this.generatedDate = generatedDate;
        this.signedBy = signedBy;
        this.signedAt = signedAt;
    }

    public String getWaybillId() { return waybillId; }
    public void setWaybillId(String waybillId) { this.waybillId = waybillId; }

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

    public String getHaulerName() { return haulerName; }
    public void setHaulerName(String haulerName) { this.haulerName = haulerName; }

    public WaybillStatus getStatus() { return status; }
    public void setStatus(WaybillStatus status) { this.status = status; }

    public String getStatusLabel() { return statusLabel; }
    public void setStatusLabel(String statusLabel) { this.statusLabel = statusLabel; }

    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }

    public String getGeneratedDate() { return generatedDate; }
    public void setGeneratedDate(String generatedDate) { this.generatedDate = generatedDate; }

    public String getSignedBy() { return signedBy; }
    public void setSignedBy(String signedBy) { this.signedBy = signedBy; }

    public LocalDateTime getSignedAt() { return signedAt; }
    public void setSignedAt(LocalDateTime signedAt) { this.signedAt = signedAt; }
}
