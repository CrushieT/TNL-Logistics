package com.tnl.logistics.dto;

import java.time.Instant;

public record OfflineTrackingSyncItemResponse(
        String clientEventId,
        String trackingId,
        String outcome,
        String code,
        boolean retryable,
        boolean replayed,
        String serverStatus,
        String serverVehicleId,
        Instant serverTimestamp) {
}
