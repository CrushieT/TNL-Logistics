package com.tnl.logistics.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Summary of a shipment's financial state and associated payments.
 */
public class ShipmentPaymentSummaryResponse {

    private String shipmentId;
    private String clientId;
    private String clientName;
    private String recipientName;
    private BigDecimal totalAmount;
    private BigDecimal totalPaid;
    private BigDecimal balance;
    private String paymentStatus;
    private String financialStatus;
    private BigDecimal collectibleBalance;
    private StatementAdjustmentSummary statementAdjustment;
    private List<PaymentResponse> payments;

    public static class StatementAdjustmentSummary {
        private String soaNo;
        private BigDecimal amount;
        private String reason;
        private java.time.LocalDate statementDate;
        private BigDecimal outstandingBalance;
        private String status;

        public StatementAdjustmentSummary() {}

        public StatementAdjustmentSummary(String soaNo, BigDecimal amount, String reason,
                                          java.time.LocalDate statementDate,
                                          BigDecimal outstandingBalance, String status) {
            this.soaNo = soaNo;
            this.amount = amount;
            this.reason = reason;
            this.statementDate = statementDate;
            this.outstandingBalance = outstandingBalance;
            this.status = status;
        }

        public String getSoaNo() { return soaNo; }
        public void setSoaNo(String soaNo) { this.soaNo = soaNo; }

        public BigDecimal getAmount() { return amount; }
        public void setAmount(BigDecimal amount) { this.amount = amount; }

        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }

        public java.time.LocalDate getStatementDate() { return statementDate; }
        public void setStatementDate(java.time.LocalDate statementDate) { this.statementDate = statementDate; }

        public BigDecimal getOutstandingBalance() { return outstandingBalance; }
        public void setOutstandingBalance(BigDecimal outstandingBalance) { this.outstandingBalance = outstandingBalance; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }

    public ShipmentPaymentSummaryResponse() {}

    public ShipmentPaymentSummaryResponse(String shipmentId, String clientId, String clientName,
                                          String recipientName, BigDecimal totalAmount,
                                          BigDecimal totalPaid, BigDecimal balance,
                                          String paymentStatus, List<PaymentResponse> payments) {
        this.shipmentId = shipmentId;
        this.clientId = clientId;
        this.clientName = clientName;
        this.recipientName = recipientName;
        this.totalAmount = totalAmount;
        this.totalPaid = totalPaid;
        this.balance = balance;
        this.paymentStatus = paymentStatus;
        this.payments = payments;
    }

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }

    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public BigDecimal getTotalPaid() { return totalPaid; }
    public void setTotalPaid(BigDecimal totalPaid) { this.totalPaid = totalPaid; }

    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) { this.balance = balance; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public String getFinancialStatus() { return financialStatus; }
    public void setFinancialStatus(String financialStatus) { this.financialStatus = financialStatus; }

    public BigDecimal getCollectibleBalance() { return collectibleBalance; }
    public void setCollectibleBalance(BigDecimal collectibleBalance) { this.collectibleBalance = collectibleBalance; }

    public StatementAdjustmentSummary getStatementAdjustment() { return statementAdjustment; }
    public void setStatementAdjustment(StatementAdjustmentSummary statementAdjustment) { this.statementAdjustment = statementAdjustment; }

    public List<PaymentResponse> getPayments() { return payments; }
    public void setPayments(List<PaymentResponse> payments) { this.payments = payments; }
}
