package com.tnl.logistics.dto;

import java.math.BigDecimal;

/**
 * Lightweight internal DTO for collections summary metrics.
 * Used by Dashboard and high-level rollups to avoid hydrating itemized client collections.
 */
public record CollectionTotals(
        BigDecimal totalDue,
        BigDecimal totalCollected,
        BigDecimal outstandingBalance,
        int activeClientsCount
) {}
