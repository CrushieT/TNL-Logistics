package com.tnl.logistics.repository;

import java.math.BigDecimal;

public interface PeriodShipmentTotals {
    long getTotalShipments();
    BigDecimal getTotalBilled();
}
