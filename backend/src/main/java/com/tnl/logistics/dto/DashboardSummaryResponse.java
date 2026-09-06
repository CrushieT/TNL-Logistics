package com.tnl.logistics.dto;

import com.fasterxml.jackson.annotation.JsonGetter;
import java.math.BigDecimal;
import java.util.List;

/**
 * Encapsulates the complete metrics, status distributions, weekly volume points,
 * financial totals, and recent tracking activity for Desktop Screen 02 (Dashboard).
 */
public class DashboardSummaryResponse {

    private long shipmentCount;
    private long parcelCount;
    private long todayShipmentCount;
    private String todayDateFormatted;
    private long unpaidTransactionCount;
    private ForCollectionDto forCollection;
    private List<StatusSegmentDto> parcelUnitsByStatus;
    private List<VolumePointDto> weeklyShipmentVolume;
    private List<ComparisonRowDto> outstandingVsCollected;
    private List<RecentActivityDto> recentActivity;

    public DashboardSummaryResponse() {}

    public DashboardSummaryResponse(
            long shipmentCount,
            long parcelCount,
            long todayShipmentCount,
            String todayDateFormatted,
            long unpaidTransactionCount,
            ForCollectionDto forCollection,
            List<StatusSegmentDto> parcelUnitsByStatus,
            List<VolumePointDto> weeklyShipmentVolume,
            List<ComparisonRowDto> outstandingVsCollected,
            List<RecentActivityDto> recentActivity) {
        this.shipmentCount = shipmentCount;
        this.parcelCount = parcelCount;
        this.todayShipmentCount = todayShipmentCount;
        this.todayDateFormatted = todayDateFormatted;
        this.unpaidTransactionCount = unpaidTransactionCount;
        this.forCollection = forCollection;
        this.parcelUnitsByStatus = parcelUnitsByStatus;
        this.weeklyShipmentVolume = weeklyShipmentVolume;
        this.outstandingVsCollected = outstandingVsCollected;
        this.recentActivity = recentActivity;
    }

    public long getShipmentCount() { return shipmentCount; }
    public void setShipmentCount(long shipmentCount) { this.shipmentCount = shipmentCount; }

    public long getParcelCount() { return parcelCount; }
    public void setParcelCount(long parcelCount) { this.parcelCount = parcelCount; }

    public long getTodayShipmentCount() { return todayShipmentCount; }
    public void setTodayShipmentCount(long todayShipmentCount) { this.todayShipmentCount = todayShipmentCount; }

    @JsonGetter("registeredToday")
    public long getRegisteredToday() { return todayShipmentCount; }

    public String getTodayDateFormatted() { return todayDateFormatted; }
    public void setTodayDateFormatted(String todayDateFormatted) { this.todayDateFormatted = todayDateFormatted; }

    @JsonGetter("registeredTodayDate")
    public String getRegisteredTodayDate() { return todayDateFormatted; }

    public long getUnpaidTransactionCount() { return unpaidTransactionCount; }
    public void setUnpaidTransactionCount(long unpaidTransactionCount) { this.unpaidTransactionCount = unpaidTransactionCount; }

    @JsonGetter("unpaidTransactions")
    public long getUnpaidTransactions() { return unpaidTransactionCount; }

    public ForCollectionDto getForCollection() { return forCollection; }
    public void setForCollection(ForCollectionDto forCollection) { this.forCollection = forCollection; }

    public List<StatusSegmentDto> getParcelUnitsByStatus() { return parcelUnitsByStatus; }
    public void setParcelUnitsByStatus(List<StatusSegmentDto> parcelUnitsByStatus) { this.parcelUnitsByStatus = parcelUnitsByStatus; }

    public List<VolumePointDto> getWeeklyShipmentVolume() { return weeklyShipmentVolume; }
    public void setWeeklyShipmentVolume(List<VolumePointDto> weeklyShipmentVolume) { this.weeklyShipmentVolume = weeklyShipmentVolume; }

    @JsonGetter("weeklyRegistrations")
    public List<VolumePointDto> getWeeklyRegistrations() { return weeklyShipmentVolume; }

    public List<ComparisonRowDto> getOutstandingVsCollected() { return outstandingVsCollected; }
    public void setOutstandingVsCollected(List<ComparisonRowDto> outstandingVsCollected) { this.outstandingVsCollected = outstandingVsCollected; }

    public List<RecentActivityDto> getRecentActivity() { return recentActivity; }
    public void setRecentActivity(List<RecentActivityDto> recentActivity) { this.recentActivity = recentActivity; }

    public static class ForCollectionDto {
        private BigDecimal amount;
        private int clientCount;
        private String day;

        public ForCollectionDto() {}

        public ForCollectionDto(BigDecimal amount, int clientCount, String day) {
            this.amount = amount;
            this.clientCount = clientCount;
            this.day = day;
        }

        public BigDecimal getAmount() { return amount; }
        public void setAmount(BigDecimal amount) { this.amount = amount; }

        public int getClientCount() { return clientCount; }
        public void setClientCount(int clientCount) { this.clientCount = clientCount; }

        public String getDay() { return day; }
        public void setDay(String day) { this.day = day; }
    }

    public static class StatusSegmentDto {
        private String label;
        private long value;
        private String color;

        public StatusSegmentDto() {}

        public StatusSegmentDto(String label, long value, String color) {
            this.label = label;
            this.value = value;
            this.color = color;
        }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }

        public long getValue() { return value; }
        public void setValue(long value) { this.value = value; }

        public String getColor() { return color; }
        public void setColor(String color) { this.color = color; }
    }

    public static class VolumePointDto {
        private String label;
        private long value;

        public VolumePointDto() {}

        public VolumePointDto(String label, long value) {
            this.label = label;
            this.value = value;
        }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }

        public long getValue() { return value; }
        public void setValue(long value) { this.value = value; }
    }

    public static class ComparisonRowDto {
        private String label;
        private BigDecimal value;
        private String color;

        public ComparisonRowDto() {}

        public ComparisonRowDto(String label, BigDecimal value, String color) {
            this.label = label;
            this.value = value;
            this.color = color;
        }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }

        public BigDecimal getValue() { return value; }
        public void setValue(BigDecimal value) { this.value = value; }

        public String getColor() { return color; }
        public void setColor(String color) { this.color = color; }
    }

    public static class RecentActivityDto {
        private String date;
        private String time;
        private String action;
        private String trackingId;
        private String meta;

        public RecentActivityDto() {}

        public RecentActivityDto(String date, String time, String action, String trackingId, String meta) {
            this.date = date;
            this.time = time;
            this.action = action;
            this.trackingId = trackingId;
            this.meta = meta;
        }

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }

        public String getTime() { return time; }
        public void setTime(String time) { this.time = time; }

        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }

        public String getTrackingId() { return trackingId; }
        public void setTrackingId(String trackingId) { this.trackingId = trackingId; }

        public String getMeta() { return meta; }
        public void setMeta(String meta) { this.meta = meta; }
    }
}
