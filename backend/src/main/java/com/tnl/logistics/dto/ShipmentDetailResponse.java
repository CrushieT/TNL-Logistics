package com.tnl.logistics.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Detailed response for shipment details page.
 */
public class ShipmentDetailResponse {

    private String shipmentId;
    private String origin;
    private String clientId;
    private String client;
    private String route;
    private String recipient;
    private RecipientDetailsDto recipientDetails;
    private String registeredOn;
    private String description;
    private Integer quantity;
    private String status;
    private String statusRollup;
    private String payment;
    private String chargeModel;
    private BigDecimal shippingFee;
    private BigDecimal otherCharges;
    private BigDecimal totalAmount;
    private BigDecimal amountPaid;
    private BigDecimal balance;
    private Boolean paidAtRegistration;
    private List<ParcelUnitResponse> units;

    public ShipmentDetailResponse() {}

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

    public String getOrigin() { return origin; }
    public void setOrigin(String origin) { this.origin = origin; }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getClient() { return client; }
    public void setClient(String client) { this.client = client; }

    public String getRoute() { return route; }
    public void setRoute(String route) { this.route = route; }

    public String getRecipient() { return recipient; }
    public void setRecipient(String recipient) { this.recipient = recipient; }

    public RecipientDetailsDto getRecipientDetails() { return recipientDetails; }
    public void setRecipientDetails(RecipientDetailsDto recipientDetails) { this.recipientDetails = recipientDetails; }

    public String getRegisteredOn() { return registeredOn; }
    public void setRegisteredOn(String registeredOn) { this.registeredOn = registeredOn; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getStatusRollup() { return statusRollup; }
    public void setStatusRollup(String statusRollup) { this.statusRollup = statusRollup; }

    public String getPayment() { return payment; }
    public void setPayment(String payment) { this.payment = payment; }

    public String getChargeModel() { return chargeModel; }
    public void setChargeModel(String chargeModel) { this.chargeModel = chargeModel; }

    public BigDecimal getShippingFee() { return shippingFee; }
    public void setShippingFee(BigDecimal shippingFee) { this.shippingFee = shippingFee; }

    public BigDecimal getOtherCharges() { return otherCharges; }
    public void setOtherCharges(BigDecimal otherCharges) { this.otherCharges = otherCharges; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public BigDecimal getAmountPaid() { return amountPaid; }
    public void setAmountPaid(BigDecimal amountPaid) { this.amountPaid = amountPaid; }

    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) { this.balance = balance; }

    public Boolean getPaidAtRegistration() { return paidAtRegistration; }
    public void setPaidAtRegistration(Boolean paidAtRegistration) { this.paidAtRegistration = paidAtRegistration; }

    public List<ParcelUnitResponse> getUnits() { return units; }
    public void setUnits(List<ParcelUnitResponse> units) { this.units = units; }
}
