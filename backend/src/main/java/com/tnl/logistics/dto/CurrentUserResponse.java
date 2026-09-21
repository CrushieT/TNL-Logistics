package com.tnl.logistics.dto;

public record CurrentUserResponse(
        String userId,
        String username,
        String fullName,
        String role,
        String staffType,
        boolean mustChangePassword,
        boolean hasPinSet,
        MobileDeviceBindingSummary deviceBinding) {
}
