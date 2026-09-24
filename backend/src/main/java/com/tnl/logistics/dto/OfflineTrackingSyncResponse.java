package com.tnl.logistics.dto;

import java.util.List;

public record OfflineTrackingSyncResponse(
        int requested,
        int applied,
        int alreadyApplied,
        int terminal,
        int retryable,
        List<OfflineTrackingSyncItemResponse> results) {
}
