package com.tnl.logistics.dto;

import java.math.BigDecimal;

/**
 * Line item representing a shipment in the Statement of Account itemized table.
 */
public class StatementShipmentItem {

    private String dateRegistered;
    private String shipmentId;
    private String description;
    private Integer quantity;
    private BigDecimal charges;
    private BigDecimal otherCharges;
    private BigDecimal due;
    private BigDecimal paid;
    private BigDecimal balance;

    public StatementShipmentItem() {}

    public StatementShipmentItem(String dateRegistered, String shipmentId, String description,
                                 Integer quantity, BigDecimal charges, BigDecimal otherCharges,
                                 BigDecimal due, BigDecimal paid, BigDecimal balance) {
        this.dateRegistered = dateRegistered;
        this.shipmentId = shipmentId;
        this.description = description;
        this.quantity = quantity != null ? quantity : 0;
        this.charges = charges != null ? charges : BigDecimal.ZERO;
        this.otherCharges = otherCharges != null ? otherCharges : BigDecimal.ZERO;
        this.due = due != null ? due : BigDecimal.ZERO;
        this.paid = paid != null ? paid : BigDecimal.ZERO;
        this.balance = balance != null ? balance : BigDecimal.ZERO;
    }

    public String getDateRegistered() { return dateRegistered; }
    public void setDateRegistered(String dateRegistered) { this.dateRegistered = dateRegistered; }

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }

    public BigDecimal getCharges() { return charges; }
    public void setCharges(BigDecimal charges) { this.charges = charges; }

    public BigDecimal getOtherCharges() { return otherCharges; }
    public void setOtherCharges(BigDecimal otherCharges) { this.otherCharges = otherCharges; }

    public BigDecimal getDue() { return due; }
    public void setDue(BigDecimal due) { this.due = due; }

    public BigDecimal getPaid() { return paid; }
    public void setPaid(BigDecimal paid) { this.paid = paid; }

    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) { this.balance = balance; }
}
