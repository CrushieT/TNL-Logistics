package com.tnl.logistics.service;

import com.tnl.logistics.dto.WeeklyCollectionsResponse;

import java.time.LocalDate;
import java.util.List;

/**
 * Service interface for Thursday weekly collections consolidation and SOA financial rollups.
 */
public interface CollectionsService {

    /**
     * Retrieve weekly collections consolidation data for the given Thursday cycle date.
     * If targetDate is null, the current active Thursday cycle is used.
     *
     * @param targetDate target Thursday date (optional)
     * @return WeeklyCollectionsResponse containing company totals and itemized client metrics
     */
    WeeklyCollectionsResponse getWeeklyCollections(LocalDate targetDate);

    /**
     * Retrieve internal totals-only collection metrics for the given cycle date without constructing itemized client items.
     * Shares identical financial aggregation rules with {@link #getWeeklyCollections(LocalDate)}.
     *
     * @param targetDate target cycle closing date (optional)
     * @return CollectionTotals containing company totals and active client count
     */
    com.tnl.logistics.dto.CollectionTotals getCollectionTotals(LocalDate targetDate);

    /**
     * Retrieve internal totals-only collection metrics for the given cycle date using a pre-calculated cycle start date.
     * Reuses the caller's resolved cycle boundary to eliminate duplicate cycle discovery.
     *
     * @param targetDate target cycle closing date (optional)
     * @param cycleStartDate pre-calculated cycle start date
     * @return CollectionTotals containing company totals and active client count
     */
    com.tnl.logistics.dto.CollectionTotals getCollectionTotals(LocalDate targetDate, LocalDate cycleStartDate);

    /**
     * Retrieve a distinct, sorted list of active cycle closing dates that actually contain shipments or finalized SOAs.
     *
     * @return list of cycle closing dates (newest first)
     */
    List<LocalDate> getActiveCycleDates();

    /**
     * Legacy alias for {@link #getActiveCycleDates()}.
     *
     * @return list of cycle closing dates (newest first)
     * @deprecated Use {@link #getActiveCycleDates()} instead.
     */
    @Deprecated
    default List<LocalDate> getActiveCycleThursdays() {
        return getActiveCycleDates();
    }

    /**
     * Retrieve the configured weekly collection closing day of the week (default Thursday).
     *
     * @return DayOfWeek representing the weekly collection closing day
     */
    java.time.DayOfWeek getCollectionDayOfWeek();

    /**
     * Calculate the active weekly cycle closing date for the given base date.
     *
     * @param baseDate the reference date
     * @return LocalDate of the cycle closing day
     */
    LocalDate calculateActiveCycleDate(LocalDate baseDate);

    /**
     * Calculate the dynamic cycle start date for the given cycle closing date.
     * The start date is anchored to the day immediately following the preceding cycle,
     * or defaults to cycleEndDate minus 6 days if no preceding cycle exists.
     *
     * @param cycleEndDate the cycle closing date
     * @return LocalDate of the cycle start day
     */
    LocalDate calculateCycleStartDate(LocalDate cycleEndDate);
}
