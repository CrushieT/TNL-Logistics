package com.tnl.logistics.dto;

import com.tnl.logistics.model.ChargeModel;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Summary DTO for Client table directory with live financial and shipment aggregations.
 */
public class ClientSummaryResponse {

    private String clientId;
    private String name;
    private String address;
    private String contactNumber;
    private String email;
    private ChargeModel defaultRateType;
    private Boolean active;
    private LocalDateTime dateRegistered;

    private Long totalShipments;
    private Long totalParcels;
    private BigDecimal totalCharges;
    private BigDecimal totalPaid;
    private BigDecimal outstandingBalance;

    public ClientSummaryResponse() {}

    public ClientSummaryResponse(String clientId, String name, String address, String contactNumber,
                                 String email, ChargeModel defaultRateType, Boolean active,
                                 LocalDateTime dateRegistered, Long totalShipments, Long totalParcels,
                                 BigDecimal totalCharges, BigDecimal totalPaid, BigDecimal outstandingBalance) {
        this.clientId = clientId;
        this.name = name;
        this.address = address;
        this.contactNumber = contactNumber;
        this.email = email;
        this.defaultRateType = defaultRateType;
        this.active = active;
        this.dateRegistered = dateRegistered;
        this.totalShipments = totalShipments != null ? totalShipments : 0L;
        this.totalParcels = totalParcels != null ? totalParcels : 0L;
        this.totalCharges = totalCharges != null ? totalCharges : BigDecimal.ZERO;
        this.totalPaid = totalPaid != null ? totalPaid : BigDecimal.ZERO;
        this.outstandingBalance = outstandingBalance != null ? outstandingBalance : BigDecimal.ZERO;
    }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getContactNumber() { return contactNumber; }
    public void setContactNumber(String contactNumber) { this.contactNumber = contactNumber; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public ChargeModel getDefaultRateType() { return defaultRateType; }
    public void setDefaultRateType(ChargeModel defaultRateType) { this.defaultRateType = defaultRateType; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public LocalDateTime getDateRegistered() { return dateRegistered; }
    public void setDateRegistered(LocalDateTime dateRegistered) { this.dateRegistered = dateRegistered; }

    public Long getTotalShipments() { return totalShipments; }
    public void setTotalShipments(Long totalShipments) { this.totalShipments = totalShipments; }

    public Long getTotalParcels() { return totalParcels; }
    public void setTotalParcels(Long totalParcels) { this.totalParcels = totalParcels; }

    public BigDecimal getTotalCharges() { return totalCharges; }
    public void setTotalCharges(BigDecimal totalCharges) { this.totalCharges = totalCharges; }

    public BigDecimal getTotalPaid() { return totalPaid; }
    public void setTotalPaid(BigDecimal totalPaid) { this.totalPaid = totalPaid; }

    public BigDecimal getOutstandingBalance() { return outstandingBalance; }
    public void setOutstandingBalance(BigDecimal outstandingBalance) { this.outstandingBalance = outstandingBalance; }
}
