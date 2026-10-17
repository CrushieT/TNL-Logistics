package com.tnl.logistics.repository;

import java.math.BigDecimal;

/**
 * Spring Data projection interface for consolidating cycle shipment counts,
 * parcel quantities, and total billed charges in a single SQL scan.
 */
public interface CycleShipmentSummary {
    Long getShipmentCount();
    Long getParcelCount();
    BigDecimal getTotalCharges();
}
