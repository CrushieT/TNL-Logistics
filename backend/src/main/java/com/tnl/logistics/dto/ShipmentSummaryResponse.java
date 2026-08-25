package com.tnl.logistics.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Summary DTO for shipments data table and paginated search.
 */
public class ShipmentSummaryResponse {

    private String shipmentId;
    private String clientId;
    private String clientName;
    private String recipientName;
    private String recipientContact;
    private Integer quantity;
    private String status;
    private String statusRollup;
    private String payment;
    private BigDecimal totalAmount;
    private BigDecimal amountPaid;
    private BigDecimal balance;
    private String route;
    private LocalDateTime dateRegistered;
    private String dateLabel;

    public ShipmentSummaryResponse() {}

    public ShipmentSummaryResponse(String shipmentId, String clientId, String clientName, String recipientName,
                                   String recipientContact, Integer quantity, String status, String statusRollup,
                                   String payment, BigDecimal totalAmount, BigDecimal amountPaid, BigDecimal balance,
                                   String route, LocalDateTime dateRegistered, String dateLabel) {
        this.shipmentId = shipmentId;
        this.clientId = clientId;
        this.clientName = clientName;
        this.recipientName = recipientName;
        this.recipientContact = recipientContact;
        this.quantity = quantity;
        this.status = status;
        this.statusRollup = statusRollup;
        this.payment = payment;
        this.totalAmount = totalAmount;
        this.amountPaid = amountPaid;
        this.balance = balance;
        this.route = route;
        this.dateRegistered = dateRegistered;
        this.dateLabel = dateLabel;
    }

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }

    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }

    public String getRecipientContact() { return recipientContact; }
    public void setRecipientContact(String recipientContact) { this.recipientContact = recipientContact; }

    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getStatusRollup() { return statusRollup; }
    public void setStatusRollup(String statusRollup) { this.statusRollup = statusRollup; }

    public String getPayment() { return payment; }
    public void setPayment(String payment) { this.payment = payment; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public BigDecimal getAmountPaid() { return amountPaid; }
    public void setAmountPaid(BigDecimal amountPaid) { this.amountPaid = amountPaid; }

    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) { this.balance = balance; }

    public String getRoute() { return route; }
    public void setRoute(String route) { this.route = route; }

    public LocalDateTime getDateRegistered() { return dateRegistered; }
    public void setDateRegistered(LocalDateTime dateRegistered) { this.dateRegistered = dateRegistered; }

    public String getDateLabel() { return dateLabel; }
    public void setDateLabel(String dateLabel) { this.dateLabel = dateLabel; }
}
