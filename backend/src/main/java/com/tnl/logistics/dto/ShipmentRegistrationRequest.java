package com.tnl.logistics.dto;

import com.tnl.logistics.model.ChargeModel;
import com.tnl.logistics.model.RegisteredVia;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/**
 * Request payload for shipment registration.
 */
public class ShipmentRegistrationRequest {

    @NotBlank(message = "Client ID is required")
    private String clientId;

    @NotBlank(message = "Recipient name is required")
    private String recipientName;

    @NotBlank(message = "Recipient address is required")
    private String recipientAddress;

    @NotBlank(message = "Recipient contact is required")
    private String recipientContact;

    private String description;

    @NotNull(message = "Quantity is required")
    private Integer quantity;

    @NotNull(message = "Charge model is required")
    private ChargeModel chargeModel;

    @NotNull(message = "Shipping fee is required")
    private BigDecimal shippingFee;

    private BigDecimal otherCharges = BigDecimal.ZERO;

    private Boolean paidAtRegistration = false;

    private String route;

    @NotNull(message = "Registration source is required")
    private RegisteredVia registeredVia;

    @Size(min = 1, message = "At least one parcel unit must be specified")
    @Valid
    private List<ParcelUnitRequest> parcels;

    public ShipmentRegistrationRequest() {}

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

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

    public Boolean getPaidAtRegistration() { return paidAtRegistration; }
    public void setPaidAtRegistration(Boolean paidAtRegistration) { this.paidAtRegistration = paidAtRegistration; }

    public String getRoute() { return route; }
    public void setRoute(String route) { this.route = route; }

    public RegisteredVia getRegisteredVia() { return registeredVia; }
    public void setRegisteredVia(RegisteredVia registeredVia) { this.registeredVia = registeredVia; }

    public List<ParcelUnitRequest> getParcels() { return parcels; }
    public void setParcels(List<ParcelUnitRequest> parcels) { this.parcels = parcels; }
}
