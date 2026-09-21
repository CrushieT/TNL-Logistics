package com.tnl.logistics.dto;

import java.time.LocalDateTime;

public record MobileDeviceBindingSummary(
        String maskedDeviceId,
        boolean active,
        LocalDateTime lastAuthenticatedAt) {
}
