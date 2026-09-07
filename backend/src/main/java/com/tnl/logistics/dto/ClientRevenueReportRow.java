package com.tnl.logistics.dto;

import java.math.BigDecimal;

/**
 * Individual client row in the financial and revenue breakdown report.
 */
public class ClientRevenueReportRow {

    private String clientId;
    private String clientName;
    private long totalShipments;
    private BigDecimal totalBilled;
    private BigDecimal totalPaid;
    private BigDecimal balance;
    private String paymentStatus;

    public ClientRevenueReportRow() {}

    public ClientRevenueReportRow(String clientId, String clientName, long totalShipments,
                                 BigDecimal totalBilled, BigDecimal totalPaid,
                                 BigDecimal balance, String paymentStatus) {
        this.clientId = clientId;
        this.clientName = clientName;
        this.totalShipments = totalShipments;
        this.totalBilled = totalBilled != null ? totalBilled : BigDecimal.ZERO;
        this.totalPaid = totalPaid != null ? totalPaid : BigDecimal.ZERO;
        this.balance = balance != null ? balance : BigDecimal.ZERO;
        this.paymentStatus = paymentStatus;
    }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }

    public long getTotalShipments() { return totalShipments; }
    public void setTotalShipments(long totalShipments) { this.totalShipments = totalShipments; }

    public BigDecimal getTotalBilled() { return totalBilled; }
    public void setTotalBilled(BigDecimal totalBilled) { this.totalBilled = totalBilled; }

    public BigDecimal getTotalPaid() { return totalPaid; }
    public void setTotalPaid(BigDecimal totalPaid) { this.totalPaid = totalPaid; }

    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) { this.balance = balance; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }
}
