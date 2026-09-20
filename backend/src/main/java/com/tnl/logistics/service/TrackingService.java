package com.tnl.logistics.service;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.ParcelStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;

public interface TrackingService {

    TrackingScanContextResponse getScanContext(String trackingId);

    TrackingScanResponse processStatusScan(TrackingScanRequest request, String actingStaffUserId);

    List<TrackingScanResponse> processBatchScan(BatchTrackingScanRequest request, String actingStaffUserId);

    Page<TrackingLogEntryResponse> getTrackingLogs(String search, ParcelStatus status,
                                                  LocalDate startDate, LocalDate endDate,
                                                  Pageable pageable);

    TrackingMetricsResponse getTodayTrackingMetrics();
}
