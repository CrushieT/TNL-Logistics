package com.tnl.logistics.dto;

/**
 * DTO for the 4-card operational tracking overview summary.
 */
public class TrackingMetricsResponse {

    private long todayTotalScans;
    private long activeCouriersCount;
    private long loadedOnTruckToday;
    private long handedToHaulerToday;

    public TrackingMetricsResponse() {}

    public TrackingMetricsResponse(long todayTotalScans, long activeCouriersCount,
                                   long loadedOnTruckToday, long handedToHaulerToday) {
        this.todayTotalScans = todayTotalScans;
        this.activeCouriersCount = activeCouriersCount;
        this.loadedOnTruckToday = loadedOnTruckToday;
        this.handedToHaulerToday = handedToHaulerToday;
    }

    public long getTodayTotalScans() { return todayTotalScans; }
    public void setTodayTotalScans(long todayTotalScans) { this.todayTotalScans = todayTotalScans; }

    public long getActiveCouriersCount() { return activeCouriersCount; }
    public void setActiveCouriersCount(long activeCouriersCount) { this.activeCouriersCount = activeCouriersCount; }

    public long getLoadedOnTruckToday() { return loadedOnTruckToday; }
    public void setLoadedOnTruckToday(long loadedOnTruckToday) { this.loadedOnTruckToday = loadedOnTruckToday; }

    public long getHandedToHaulerToday() { return handedToHaulerToday; }
    public void setHandedToHaulerToday(long handedToHaulerToday) { this.handedToHaulerToday = handedToHaulerToday; }
}
