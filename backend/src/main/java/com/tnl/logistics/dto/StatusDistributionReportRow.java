package com.tnl.logistics.dto;

/**
 * Operational parcel status distribution summary row.
 */
public class StatusDistributionReportRow {

    private String status;
    private String statusDisplay;
    private long count;
    private double percentage;

    public StatusDistributionReportRow() {}

    public StatusDistributionReportRow(String status, String statusDisplay, long count, double percentage) {
        this.status = status;
        this.statusDisplay = statusDisplay;
        this.count = count;
        this.percentage = percentage;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getStatusDisplay() { return statusDisplay; }
    public void setStatusDisplay(String statusDisplay) { this.statusDisplay = statusDisplay; }

    public long getCount() { return count; }
    public void setCount(long count) { this.count = count; }

    public double getPercentage() { return percentage; }
    public void setPercentage(double percentage) { this.percentage = percentage; }
}
