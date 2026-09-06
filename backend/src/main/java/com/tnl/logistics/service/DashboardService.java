package com.tnl.logistics.service;

import com.tnl.logistics.dto.DashboardSummaryResponse;

/**
 * Service interface for aggregating live operations metrics, status charts,
 * weekly shipment volumes, and recent activity for the main dashboard.
 */
public interface DashboardService {

    DashboardSummaryResponse getDashboardSummary();
}
