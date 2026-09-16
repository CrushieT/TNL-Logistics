package com.tnl.logistics.service;

import com.tnl.logistics.dto.ReportSummaryResponse;

import java.time.LocalDate;

/**
 * Service providing consolidated operational and financial reports aggregation.
 */
public interface ReportService {

    /**
     * Aggregates reporting metrics across a designated date range.
     *
     * @param startDate inclusive start boundary (defaults to first day of current month)
     * @param endDate   inclusive end boundary (defaults to current date)
     * @return consolidated report summary response
     */
    ReportSummaryResponse getReportSummary(LocalDate startDate, LocalDate endDate);
}
