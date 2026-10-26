package com.tnl.logistics.service;

import com.tnl.logistics.model.Soa;
import java.math.BigDecimal;

public final class PaymentCollectibility {
    private PaymentCollectibility() {}

    public static BigDecimal calculate(BigDecimal shipmentBalance, Soa statement) {
        BigDecimal balance = shipmentBalance.max(BigDecimal.ZERO);
        if (statement == null) return balance;
        BigDecimal statementBalance = statement.getOutstandingBalance();
        return balance.min(statementBalance == null ? BigDecimal.ZERO : statementBalance.max(BigDecimal.ZERO));
    }
}
