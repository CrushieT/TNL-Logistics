package com.tnl.logistics.dto;

import java.math.BigDecimal;
import java.util.List;

public class ParcelUnitDetailResponse {

    private boolean lost;
    private long revision;
    private String waybillId;
    private List<ParcelLossEventResponse> lossHistory;
    public boolean isLost() { return lost; }
    public void setLost(boolean lost) { this.lost = lost; }
    public long getRevision() { return revision; }
    public void setRevision(long revision) { this.revision = revision; }
    public String getWaybillId() { return waybillId; }
    public void setWaybillId(String waybillId) { this.waybillId = waybillId; }
    public List<ParcelLossEventResponse> getLossHistory() { return lossHistory; }
    public void setLossHistory(List<ParcelLossEventResponse> history) { this.lossHistory = history; }

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
    private List<PrintEventItemResponse> printEvents;

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

    public List<PrintEventItemResponse> getPrintEvents() { return printEvents; }
    public void setPrintEvents(List<PrintEventItemResponse> printEvents) { this.printEvents = printEvents; }
}
