package com.tnl.logistics.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Objects;
import org.hibernate.annotations.CreationTimestamp;

/**
 * Entity mapping to the shipment database table.
 */
@Entity
@Table(name = "shipment")
public class Shipment {

    @Id
    @Column(name = "shipment_id", length = 20)
    private String shipmentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @Column(name = "recipient_name", length = 150, nullable = false)
    private String recipientName;

    @Column(name = "recipient_address", length = 255, nullable = false)
    private String recipientAddress;

    @Column(name = "recipient_contact", length = 30, nullable = false)
    private String recipientContact;

    @Column(name = "description", length = 255)
    private String description;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    @Enumerated(EnumType.STRING)
    @Column(name = "charge_model", nullable = false)
    private ChargeModel chargeModel;

    @Column(name = "shipping_fee", precision = 12, scale = 2, nullable = false)
    private BigDecimal shippingFee;

    @Column(name = "other_charges", precision = 12, scale = 2, nullable = false)
    private BigDecimal otherCharges = BigDecimal.ZERO;

    @Column(name = "total_amount", precision = 12, scale = 2, nullable = false)
    private BigDecimal totalAmount;

    @Column(name = "paid_at_registration", nullable = false)
    private Boolean paidAtRegistration = false;

    @Column(name = "route", length = 150)
    private String route;

    @Enumerated(EnumType.STRING)
    @Column(name = "registered_via", nullable = false)
    private RegisteredVia registeredVia;

    @CreationTimestamp
    @Column(name = "date_registered", nullable = false, updatable = false)
    private LocalDateTime dateRegistered;

    @Column(name = "statement_id", length = 30)
    private String statementId;

    public Shipment() {}

    public Shipment(String shipmentId, Client client, String recipientName, String recipientAddress,
                    String recipientContact, Integer quantity, ChargeModel chargeModel, BigDecimal shippingFee,
                    BigDecimal otherCharges, BigDecimal totalAmount, Boolean paidAtRegistration,
                    RegisteredVia registeredVia) {
        this.shipmentId = shipmentId;
        this.client = client;
        this.recipientName = recipientName;
        this.recipientAddress = recipientAddress;
        this.recipientContact = recipientContact;
        this.quantity = quantity;
        this.chargeModel = chargeModel;
        this.shippingFee = shippingFee;
        this.otherCharges = otherCharges;
        this.totalAmount = totalAmount;
        this.paidAtRegistration = paidAtRegistration;
        this.registeredVia = registeredVia;
    }

    // Getters and Setters
    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

    public Client getClient() { return client; }
    public void setClient(Client client) { this.client = client; }

    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }

    public String getRecipientAddress() { return recipientAddress; }
    public void setRecipientAddress(String recipientAddress) { this.recipientAddress = recipientAddress; }

    public String getRecipientContact() { return recipientContact; }
    public void setRecipientContact(String recipientContact) { this.recipientContact = recipientContact; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }

    public ChargeModel getChargeModel() { return chargeModel; }
    public void setChargeModel(ChargeModel chargeModel) { this.chargeModel = chargeModel; }

    public BigDecimal getShippingFee() { return shippingFee; }
    public void setShippingFee(BigDecimal shippingFee) { this.shippingFee = shippingFee; }

    public BigDecimal getOtherCharges() { return otherCharges; }
    public void setOtherCharges(BigDecimal otherCharges) { this.otherCharges = otherCharges; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public Boolean getPaidAtRegistration() { return paidAtRegistration; }
    public void setPaidAtRegistration(Boolean paidAtRegistration) { this.paidAtRegistration = paidAtRegistration; }

    public String getRoute() { return route; }
    public void setRoute(String route) { this.route = route; }

    public RegisteredVia getRegisteredVia() { return registeredVia; }
    public void setRegisteredVia(RegisteredVia registeredVia) { this.registeredVia = registeredVia; }

    public LocalDateTime getDateRegistered() { return dateRegistered; }

    public String getStatementId() { return statementId; }
    public void setStatementId(String statementId) { this.statementId = statementId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Shipment shipment = (Shipment) o;
        return Objects.equals(shipmentId, shipment.shipmentId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(shipmentId);
    }
}
