package com.tnl.logistics.dto;

import java.math.BigDecimal;

/**
 * DTO representing an individual parcel unit inside a shipment.
 */
public class ParcelUnitResponse {

    private String trackingId;
    private Integer packageIndex;
    private Integer packageCount;
    private String status;
    private String labelStatus;
    private Integer reprintCount;
    private BigDecimal weightKg;
    private BigDecimal lengthCm;
    private BigDecimal widthCm;
    private BigDecimal heightCm;
    private BigDecimal volumeCbm;

    public ParcelUnitResponse() {}

    public ParcelUnitResponse(String trackingId, Integer packageIndex, Integer packageCount, String status,
                              String labelStatus, Integer reprintCount, BigDecimal weightKg, BigDecimal lengthCm,
                              BigDecimal widthCm, BigDecimal heightCm, BigDecimal volumeCbm) {
        this.trackingId = trackingId;
        this.packageIndex = packageIndex;
        this.packageCount = packageCount;
        this.status = status;
        this.labelStatus = labelStatus;
        this.reprintCount = reprintCount;
        this.weightKg = weightKg;
        this.lengthCm = lengthCm;
        this.widthCm = widthCm;
        this.heightCm = heightCm;
        this.volumeCbm = volumeCbm;
    }

    public String getTrackingId() { return trackingId; }
    public void setTrackingId(String trackingId) { this.trackingId = trackingId; }

    public Integer getPackageIndex() { return packageIndex; }
    public void setPackageIndex(Integer packageIndex) { this.packageIndex = packageIndex; }

    public Integer getPackageCount() { return packageCount; }
    public void setPackageCount(Integer packageCount) { this.packageCount = packageCount; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getLabelStatus() { return labelStatus; }
    public void setLabelStatus(String labelStatus) { this.labelStatus = labelStatus; }

    public Integer getReprintCount() { return reprintCount; }
    public void setReprintCount(Integer reprintCount) { this.reprintCount = reprintCount; }

    public BigDecimal getWeightKg() { return weightKg; }
    public void setWeightKg(BigDecimal weightKg) { this.weightKg = weightKg; }

    public BigDecimal getLengthCm() { return lengthCm; }
    public void setLengthCm(BigDecimal lengthCm) { this.lengthCm = lengthCm; }

    public BigDecimal getWidthCm() { return widthCm; }
    public void setWidthCm(BigDecimal widthCm) { this.widthCm = widthCm; }

    public BigDecimal getHeightCm() { return heightCm; }
    public void setHeightCm(BigDecimal heightCm) { this.heightCm = heightCm; }

    public BigDecimal getVolumeCbm() { return volumeCbm; }
    public void setVolumeCbm(BigDecimal volumeCbm) { this.volumeCbm = volumeCbm; }
}
