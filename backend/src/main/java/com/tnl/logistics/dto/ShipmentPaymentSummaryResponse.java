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
    private List<PaymentResponse> payments;

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

    public List<PaymentResponse> getPayments() { return payments; }
    public void setPayments(List<PaymentResponse> payments) { this.payments = payments; }
}
