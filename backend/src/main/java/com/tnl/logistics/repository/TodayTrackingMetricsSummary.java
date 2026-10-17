package com.tnl.logistics.repository;

/**
 * Spring Data projection interface for consolidating today's 4-card operational tracking metrics.
 */
public interface TodayTrackingMetricsSummary {
    Long getTodayTotalScans();
    Long getActiveCouriersCount();
    Long getLoadedOnTruckToday();
    Long getHandedToHaulerToday();
}
