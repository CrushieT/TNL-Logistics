package com.tnl.logistics.dto;

import java.math.BigDecimal;

/**
 * Breakdown of payments collected by payment method.
 */
public class PaymentMethodReportRow {

    private String method;
    private long count;
    private BigDecimal totalAmount;
    private double percentage;

    public PaymentMethodReportRow() {}

    public PaymentMethodReportRow(String method, long count, BigDecimal totalAmount, double percentage) {
        this.method = method;
        this.count = count;
        this.totalAmount = totalAmount != null ? totalAmount : BigDecimal.ZERO;
        this.percentage = percentage;
    }

    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }

    public long getCount() { return count; }
    public void setCount(long count) { this.count = count; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public double getPercentage() { return percentage; }
    public void setPercentage(double percentage) { this.percentage = percentage; }
}
