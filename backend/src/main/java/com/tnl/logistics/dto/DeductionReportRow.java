package com.tnl.logistics.dto;

import java.math.BigDecimal;

/**
 * Breakdown of applied invoice/statement deductions by category.
 */
public class DeductionReportRow {

    private String category;
    private long count;
    private BigDecimal totalAmount;

    public DeductionReportRow() {}

    public DeductionReportRow(String category, long count, BigDecimal totalAmount) {
        this.category = category;
        this.count = count;
        this.totalAmount = totalAmount != null ? totalAmount : BigDecimal.ZERO;
    }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public long getCount() { return count; }
    public void setCount(long count) { this.count = count; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
}
