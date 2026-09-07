package com.tnl.logistics.dto;

import java.math.BigDecimal;

/**
 * DTO representing top 5 summary KPI metrics across a reporting date range.
 */
public class ReportKpiResponse {

    private BigDecimal totalBilledRevenue;
    private BigDecimal totalCollectedRevenue;
    private BigDecimal outstandingReceivables;
    private long totalShipments;
    private long totalParcels;
    private double deliveryCompletionRate;

    public ReportKpiResponse() {}

    public ReportKpiResponse(BigDecimal totalBilledRevenue, BigDecimal totalCollectedRevenue,
                             BigDecimal outstandingReceivables, long totalShipments,
                             long totalParcels, double deliveryCompletionRate) {
        this.totalBilledRevenue = totalBilledRevenue;
        this.totalCollectedRevenue = totalCollectedRevenue;
        this.outstandingReceivables = outstandingReceivables;
        this.totalShipments = totalShipments;
        this.totalParcels = totalParcels;
        this.deliveryCompletionRate = deliveryCompletionRate;
    }

    public BigDecimal getTotalBilledRevenue() { return totalBilledRevenue; }
    public void setTotalBilledRevenue(BigDecimal totalBilledRevenue) { this.totalBilledRevenue = totalBilledRevenue; }

    public BigDecimal getTotalCollectedRevenue() { return totalCollectedRevenue; }
    public void setTotalCollectedRevenue(BigDecimal totalCollectedRevenue) { this.totalCollectedRevenue = totalCollectedRevenue; }

    public BigDecimal getOutstandingReceivables() { return outstandingReceivables; }
    public void setOutstandingReceivables(BigDecimal outstandingReceivables) { this.outstandingReceivables = outstandingReceivables; }

    public long getTotalShipments() { return totalShipments; }
    public void setTotalShipments(long totalShipments) { this.totalShipments = totalShipments; }

    public long getTotalParcels() { return totalParcels; }
    public void setTotalParcels(long totalParcels) { this.totalParcels = totalParcels; }

    public double getDeliveryCompletionRate() { return deliveryCompletionRate; }
    public void setDeliveryCompletionRate(double deliveryCompletionRate) { this.deliveryCompletionRate = deliveryCompletionRate; }
}
