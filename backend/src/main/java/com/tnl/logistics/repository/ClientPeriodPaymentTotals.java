package com.tnl.logistics.repository;

import java.math.BigDecimal;

public interface ClientPeriodPaymentTotals {
    String getClientId();
    String getClientName();
    BigDecimal getTotalPaid();
}
