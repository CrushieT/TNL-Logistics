package com.tnl.logistics.service;

import com.tnl.logistics.dto.BatchTrackingScanRequest;
import com.tnl.logistics.dto.TrackingScanRequest;
import com.tnl.logistics.dto.TrackingScanResponse;

import java.util.List;

public interface TrackingService {

    TrackingScanResponse processStatusScan(TrackingScanRequest request, String actingStaffUsername);

    List<TrackingScanResponse> processBatchScan(BatchTrackingScanRequest request, String actingStaffUsername);
}
