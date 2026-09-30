package com.tnl.logistics.dto;

import com.tnl.logistics.model.ChargeModel;
import com.tnl.logistics.model.RegisteredVia;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
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
    @Size(max = 150, message = "Recipient name cannot exceed 150 characters")
    private String recipientName;

    @NotBlank(message = "Recipient address is required")
    @Size(max = 255, message = "Recipient address cannot exceed 255 characters")
    private String recipientAddress;

    @NotBlank(message = "Recipient contact is required")
    @Size(max = 11, message = "Recipient contact cannot exceed 11 characters")
    @Pattern(regexp = "^[0-9]+$", message = "Recipient contact must contain digits only")
    private String recipientContact;

    @Size(max = 255, message = "Description cannot exceed 255 characters")
    private String description;

    @NotNull(message = "Quantity is required")
    @Positive(message = "Quantity must be greater than zero")
    @Max(value = 1000, message = "Quantity cannot exceed 1000")
    private Integer quantity;

    @NotNull(message = "Charge model is required")
    private ChargeModel chargeModel;

    @NotNull(message = "Shipping fee is required")
    @PositiveOrZero(message = "Shipping fee must be zero or positive")
    @Digits(integer = 10, fraction = 2, message = "Shipping fee must have up to 10 integer digits and 2 decimal places")
    private BigDecimal shippingFee;

    @PositiveOrZero(message = "Charges must be zero or positive")
    @Digits(integer = 10, fraction = 2, message = "Charges must have up to 10 integer digits and 2 decimal places")
    private BigDecimal otherCharges = BigDecimal.ZERO;

    private Boolean paidAtRegistration = false;

    @Size(max = 150, message = "Route cannot exceed 150 characters")
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
