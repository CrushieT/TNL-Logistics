package com.tnl.logistics.repository;

import java.math.BigDecimal;

/**
 * Spring Data projection interface for consolidating cycle shipment counts,
 * parcel quantities, billed charges, unpaid counts, and lifetime payments.
 */
public interface CycleShipmentSummary {
    Long getShipmentCount();
    Long getParcelCount();
    BigDecimal getTotalCharges();
    Long getUnpaidShipmentCount();
    BigDecimal getCollectedPayments();
}
