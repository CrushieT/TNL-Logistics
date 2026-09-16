package com.tnl.logistics.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Top-level response DTO for the weekly collections dashboard.
 */
public class WeeklyCollectionsResponse {

    private LocalDate collectionDate;
    private BigDecimal totalDue;
    private BigDecimal totalCollected;
    private BigDecimal outstandingBalance;
    private Integer activeClientsCount;
    private List<WeeklyClientCollectionItem> items = new ArrayList<>();

    public WeeklyCollectionsResponse() {}

    public WeeklyCollectionsResponse(LocalDate collectionDate, BigDecimal totalDue, BigDecimal totalCollected,
                                   BigDecimal outstandingBalance, Integer activeClientsCount,
                                   List<WeeklyClientCollectionItem> items) {
        this.collectionDate = collectionDate;
        this.totalDue = totalDue != null ? totalDue : BigDecimal.ZERO;
        this.totalCollected = totalCollected != null ? totalCollected : BigDecimal.ZERO;
        this.outstandingBalance = outstandingBalance != null ? outstandingBalance : BigDecimal.ZERO;
        this.activeClientsCount = activeClientsCount != null ? activeClientsCount : 0;
        this.items = items != null ? items : new ArrayList<>();
    }

    public LocalDate getCollectionDate() { return collectionDate; }
    public void setCollectionDate(LocalDate collectionDate) { this.collectionDate = collectionDate; }

    public BigDecimal getTotalDue() { return totalDue; }
    public void setTotalDue(BigDecimal totalDue) { this.totalDue = totalDue; }

    public BigDecimal getTotalCollected() { return totalCollected; }
    public void setTotalCollected(BigDecimal totalCollected) { this.totalCollected = totalCollected; }

    public BigDecimal getOutstandingBalance() { return outstandingBalance; }
    public void setOutstandingBalance(BigDecimal outstandingBalance) { this.outstandingBalance = outstandingBalance; }

    public Integer getActiveClientsCount() { return activeClientsCount; }
    public void setActiveClientsCount(Integer activeClientsCount) { this.activeClientsCount = activeClientsCount; }

    public List<WeeklyClientCollectionItem> getItems() { return items; }
    public void setItems(List<WeeklyClientCollectionItem> items) { this.items = items; }
}
