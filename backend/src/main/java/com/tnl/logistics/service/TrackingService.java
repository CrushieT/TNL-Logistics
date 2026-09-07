package com.tnl.logistics.service;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.ParcelStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;

public interface TrackingService {

    TrackingScanResponse processStatusScan(TrackingScanRequest request, String actingStaffUsername);

    List<TrackingScanResponse> processBatchScan(BatchTrackingScanRequest request, String actingStaffUsername);

    Page<TrackingLogEntryResponse> getTrackingLogs(String search, ParcelStatus status,
                                                  LocalDate startDate, LocalDate endDate,
                                                  Pageable pageable);

    TrackingMetricsResponse getTodayTrackingMetrics();
}
