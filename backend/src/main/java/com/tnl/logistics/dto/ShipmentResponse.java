package com.tnl.logistics.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Response payload returned after registering a shipment.
 */
public class ShipmentResponse {

    private String shipmentId;
    private String clientId;
    private String recipientName;
    private BigDecimal totalAmount;
    private Boolean paidAtRegistration;
    private List<String> trackingIds;

    private BigDecimal appliedRatePerKilo;
    private Integer appliedVolumetricDivisor;
    private BigDecimal totalActualWeight;
    private BigDecimal totalVolumetricWeight;
    private BigDecimal billableWeight;
    private BigDecimal shippingFee;
    private BigDecimal otherCharges;

    public ShipmentResponse() {}

    public ShipmentResponse(String shipmentId, String clientId, String recipientName, BigDecimal totalAmount, Boolean paidAtRegistration, List<String> trackingIds) {
        this(shipmentId, clientId, recipientName, totalAmount, paidAtRegistration, trackingIds,
             null, null, null, null, null, null, null);
    }

    public ShipmentResponse(String shipmentId, String clientId, String recipientName, BigDecimal totalAmount,
                            Boolean paidAtRegistration, List<String> trackingIds,
                            BigDecimal appliedRatePerKilo, Integer appliedVolumetricDivisor,
                            BigDecimal totalActualWeight, BigDecimal totalVolumetricWeight,
                            BigDecimal billableWeight, BigDecimal shippingFee, BigDecimal otherCharges) {
        this.shipmentId = shipmentId;
        this.clientId = clientId;
        this.recipientName = recipientName;
        this.totalAmount = totalAmount;
        this.paidAtRegistration = paidAtRegistration;
        this.trackingIds = trackingIds;
        this.appliedRatePerKilo = appliedRatePerKilo;
        this.appliedVolumetricDivisor = appliedVolumetricDivisor;
        this.totalActualWeight = totalActualWeight;
        this.totalVolumetricWeight = totalVolumetricWeight;
        this.billableWeight = billableWeight;
        this.shippingFee = shippingFee;
        this.otherCharges = otherCharges;
    }

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public Boolean getPaidAtRegistration() { return paidAtRegistration; }
    public void setPaidAtRegistration(Boolean paidAtRegistration) { this.paidAtRegistration = paidAtRegistration; }

    public List<String> getTrackingIds() { return trackingIds; }
    public void setTrackingIds(List<String> trackingIds) { this.trackingIds = trackingIds; }

    public BigDecimal getAppliedRatePerKilo() { return appliedRatePerKilo; }
    public void setAppliedRatePerKilo(BigDecimal appliedRatePerKilo) { this.appliedRatePerKilo = appliedRatePerKilo; }

    public Integer getAppliedVolumetricDivisor() { return appliedVolumetricDivisor; }
    public void setAppliedVolumetricDivisor(Integer appliedVolumetricDivisor) { this.appliedVolumetricDivisor = appliedVolumetricDivisor; }

    public BigDecimal getTotalActualWeight() { return totalActualWeight; }
    public void setTotalActualWeight(BigDecimal totalActualWeight) { this.totalActualWeight = totalActualWeight; }

    public BigDecimal getTotalVolumetricWeight() { return totalVolumetricWeight; }
    public void setTotalVolumetricWeight(BigDecimal totalVolumetricWeight) { this.totalVolumetricWeight = totalVolumetricWeight; }

    public BigDecimal getBillableWeight() { return billableWeight; }
    public void setBillableWeight(BigDecimal billableWeight) { this.billableWeight = billableWeight; }

    public BigDecimal getShippingFee() { return shippingFee; }
    public void setShippingFee(BigDecimal shippingFee) { this.shippingFee = shippingFee; }

    public BigDecimal getOtherCharges() { return otherCharges; }
    public void setOtherCharges(BigDecimal otherCharges) { this.otherCharges = otherCharges; }
}
