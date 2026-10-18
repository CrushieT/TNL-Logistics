package com.tnl.logistics.repository;

import java.math.BigDecimal;

public interface PaymentMethodTotals {
    String getMethod();
    long getCount();
    BigDecimal getTotalAmount();
}
