package com.tnl.logistics.service;

import com.tnl.logistics.dto.WeeklyCollectionsResponse;

import java.time.LocalDate;

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
}
