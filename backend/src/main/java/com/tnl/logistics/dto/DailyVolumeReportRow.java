package com.tnl.logistics.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Daily operational volume and handling metrics row.
 */
public class DailyVolumeReportRow {

    private LocalDate date;
    private String dateLabel;
    private long shipmentsCount;
    private long parcelsCount;
    private BigDecimal totalWeightKg;
    private BigDecimal totalVolumeCbm;
    private long completedDeliveries;

    public DailyVolumeReportRow() {}

    public DailyVolumeReportRow(LocalDate date, String dateLabel, long shipmentsCount,
                               long parcelsCount, BigDecimal totalWeightKg,
                               BigDecimal totalVolumeCbm, long completedDeliveries) {
        this.date = date;
        this.dateLabel = dateLabel;
        this.shipmentsCount = shipmentsCount;
        this.parcelsCount = parcelsCount;
        this.totalWeightKg = totalWeightKg != null ? totalWeightKg : BigDecimal.ZERO;
        this.totalVolumeCbm = totalVolumeCbm != null ? totalVolumeCbm : BigDecimal.ZERO;
        this.completedDeliveries = completedDeliveries;
    }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public String getDateLabel() { return dateLabel; }
    public void setDateLabel(String dateLabel) { this.dateLabel = dateLabel; }

    public long getShipmentsCount() { return shipmentsCount; }
    public void setShipmentsCount(long shipmentsCount) { this.shipmentsCount = shipmentsCount; }

    public long getParcelsCount() { return parcelsCount; }
    public void setParcelsCount(long parcelsCount) { this.parcelsCount = parcelsCount; }

    public BigDecimal getTotalWeightKg() { return totalWeightKg; }
    public void setTotalWeightKg(BigDecimal totalWeightKg) { this.totalWeightKg = totalWeightKg; }

    public BigDecimal getTotalVolumeCbm() { return totalVolumeCbm; }
    public void setTotalVolumeCbm(BigDecimal totalVolumeCbm) { this.totalVolumeCbm = totalVolumeCbm; }

    public long getCompletedDeliveries() { return completedDeliveries; }
    public void setCompletedDeliveries(long completedDeliveries) { this.completedDeliveries = completedDeliveries; }
}
