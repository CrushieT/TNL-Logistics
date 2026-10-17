package com.tnl.logistics.repository;

import java.math.BigDecimal;

public interface DailyParcelTotals {
    Object getRegDate();
    long getParcelsCount();
    BigDecimal getTotalWeightKg();
    BigDecimal getTotalVolumeCbm();
    long getCompletedDeliveries();
}
