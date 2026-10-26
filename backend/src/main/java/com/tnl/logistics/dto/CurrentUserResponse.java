package com.tnl.logistics.dto;

public record CurrentUserResponse(
        String userId,
        String username,
        String fullName,
        String role,
        boolean mustChangePassword,
        boolean hasPinSet,
        MobileDeviceBindingSummary deviceBinding) {
}
