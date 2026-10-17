package com.tnl.logistics.repository;

import java.math.BigDecimal;

public interface ClientPeriodShipmentTotals {
    String getClientId();
    String getClientName();
    long getTotalShipments();
    BigDecimal getTotalBilled();
}
