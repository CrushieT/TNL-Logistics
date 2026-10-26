package com.tnl.logistics.repository;

import java.math.BigDecimal;

public interface DeductionCategoryTotals {
    String getCategory();
    long getCount();
    BigDecimal getTotalAmount();
}
