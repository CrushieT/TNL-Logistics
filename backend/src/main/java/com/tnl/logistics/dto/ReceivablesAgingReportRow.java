package com.tnl.logistics.dto;

import java.math.BigDecimal;

/**
 * Accounts Receivable aging bucket breakdown per client.
 */
public class ReceivablesAgingReportRow {

    private String clientId;
    private String clientName;
    private String recipientContact;
    private long unpaidShipmentsCount;
    private BigDecimal currentDue;
    private BigDecimal pastDue;
    private BigDecimal overdue;
    private BigDecimal totalOutstanding;

    public ReceivablesAgingReportRow() {}

    public ReceivablesAgingReportRow(String clientId, String clientName, String recipientContact,
                                    long unpaidShipmentsCount, BigDecimal currentDue,
                                    BigDecimal pastDue, BigDecimal overdue,
                                    BigDecimal totalOutstanding) {
        this.clientId = clientId;
        this.clientName = clientName;
        this.recipientContact = recipientContact;
        this.unpaidShipmentsCount = unpaidShipmentsCount;
        this.currentDue = currentDue != null ? currentDue : BigDecimal.ZERO;
        this.pastDue = pastDue != null ? pastDue : BigDecimal.ZERO;
        this.overdue = overdue != null ? overdue : BigDecimal.ZERO;
        this.totalOutstanding = totalOutstanding != null ? totalOutstanding : BigDecimal.ZERO;
    }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }

    public String getRecipientContact() { return recipientContact; }
    public void setRecipientContact(String recipientContact) { this.recipientContact = recipientContact; }

    public long getUnpaidShipmentsCount() { return unpaidShipmentsCount; }
    public void setUnpaidShipmentsCount(long unpaidShipmentsCount) { this.unpaidShipmentsCount = unpaidShipmentsCount; }

    public BigDecimal getCurrentDue() { return currentDue; }
    public void setCurrentDue(BigDecimal currentDue) { this.currentDue = currentDue; }

    public BigDecimal getPastDue() { return pastDue; }
    public void setPastDue(BigDecimal pastDue) { this.pastDue = pastDue; }

    public BigDecimal getOverdue() { return overdue; }
    public void setOverdue(BigDecimal overdue) { this.overdue = overdue; }

    public BigDecimal getTotalOutstanding() { return totalOutstanding; }
    public void setTotalOutstanding(BigDecimal totalOutstanding) { this.totalOutstanding = totalOutstanding; }
}
