package com.tnl.logistics.repository;

import java.math.BigDecimal;

public interface ClientAgingProjection {
    String getClientId();
    String getClientName();
    String getClientContact();
    long getUnpaidShipmentsCount();
    BigDecimal getCurrentDue();
    BigDecimal getPastDue();
    BigDecimal getOverdue();
    BigDecimal getTotalOutstanding();
    BigDecimal getOpenPaid();
}
