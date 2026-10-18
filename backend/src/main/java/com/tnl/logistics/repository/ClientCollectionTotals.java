package com.tnl.logistics.repository;

import java.math.BigDecimal;

public interface ClientCollectionTotals {
    String getClientId();
    String getClientName();
    String getContactNumber();
    int getShipmentsCount();
    int getUnbilledCount();
    BigDecimal getCurrentCharges();
    BigDecimal getPaid();
}
