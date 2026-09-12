package com.tnl.logistics.dto;

/**
 * Response payload indicating whether the system requires first-boot administrator registration.
 *
 * @param isFirstBoot true if no administrator account exists and setup is required
 */
public record FirstBootStatusResponse(boolean isFirstBoot) {}
