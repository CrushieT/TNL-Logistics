package com.tnl.logistics.dto;

import java.math.BigDecimal;
import java.util.List;

public class ParcelUnitDetailResponse {

    private String trackingId;
    private Integer packageIndex;
    private Integer packageCount;
    private String recipientName;
    private String shipmentId;
    private String status;
    private String labelStatus;
    private String client;
    private BigDecimal weight;
    private BigDecimal lengthCm;
    private BigDecimal widthCm;
    private BigDecimal heightCm;
    private BigDecimal volumeCbm;
    private String route;
    private List<TrackingEventResponse> history;
    private PrintInfoDto printing;

    public ParcelUnitDetailResponse() {}

    public String getTrackingId() { return trackingId; }
    public void setTrackingId(String trackingId) { this.trackingId = trackingId; }

    public Integer getPackageIndex() { return packageIndex; }
    public void setPackageIndex(Integer packageIndex) { this.packageIndex = packageIndex; }

    public Integer getPackageCount() { return packageCount; }
    public void setPackageCount(Integer packageCount) { this.packageCount = packageCount; }

    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getLabelStatus() { return labelStatus; }
    public void setLabelStatus(String labelStatus) { this.labelStatus = labelStatus; }

    public String getClient() { return client; }
    public void setClient(String client) { this.client = client; }

    public BigDecimal getWeight() { return weight; }
    public void setWeight(BigDecimal weight) { this.weight = weight; }

    public BigDecimal getLengthCm() { return lengthCm; }
    public void setLengthCm(BigDecimal lengthCm) { this.lengthCm = lengthCm; }

    public BigDecimal getWidthCm() { return widthCm; }
    public void setWidthCm(BigDecimal widthCm) { this.widthCm = widthCm; }

    public BigDecimal getHeightCm() { return heightCm; }
    public void setHeightCm(BigDecimal heightCm) { this.heightCm = heightCm; }

    public BigDecimal getVolumeCbm() { return volumeCbm; }
    public void setVolumeCbm(BigDecimal volumeCbm) { this.volumeCbm = volumeCbm; }

    public String getRoute() { return route; }
    public void setRoute(String route) { this.route = route; }

    public List<TrackingEventResponse> getHistory() { return history; }
    public void setHistory(List<TrackingEventResponse> history) { this.history = history; }

    public PrintInfoDto getPrinting() { return printing; }
    public void setPrinting(PrintInfoDto printing) { this.printing = printing; }
}
