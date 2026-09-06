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
     * Retrieve a distinct, sorted list of Thursday cycle dates that actually contain shipments.
     *
     * @return list of Thursday dates (newest first) with registered shipments
     */
    List<LocalDate> getActiveCycleThursdays();

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
}
