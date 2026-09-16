package com.tnl.logistics.dto;

import com.tnl.logistics.model.WaybillStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class WaybillManifestResponse {
    private String waybillId;
    private String shipmentId;
    private WaybillStatus status;
    private String statusLabel; // "Not Generated", "Sent to Hauler", "Signed / Completed"
    private String haulerName;
    private String driverName;
    private String driverContact;
    private String vehiclePlate;
    private String clientName;
    private String clientAddress;
    private String clientContact;
    private String recipientName;
    private String recipientAddress;
    private String recipientContact;
    private String destinationHub;
    private String route;
    private String description;
    private LocalDateTime generatedAt;
    private String generatedDate;
    private LocalDateTime dispatchedAt;
    private String dispatchedDate;
    private String signedBy;
    private LocalDateTime signedAt;
    private String signedDate;
    private Integer totalQuantity;
    private BigDecimal totalWeightKg;
    private BigDecimal totalVolumeCbm;
    private String releasedByAdminName;
    private List<ParcelUnitResponse> parcels;

    public WaybillManifestResponse() {}

    public String getReleasedByAdminName() { return releasedByAdminName; }
    public void setReleasedByAdminName(String releasedByAdminName) { this.releasedByAdminName = releasedByAdminName; }

    public String getWaybillId() { return waybillId; }
    public void setWaybillId(String waybillId) { this.waybillId = waybillId; }

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

    public WaybillStatus getStatus() { return status; }
    public void setStatus(WaybillStatus status) { this.status = status; }

    public String getStatusLabel() { return statusLabel; }
    public void setStatusLabel(String statusLabel) { this.statusLabel = statusLabel; }

    public String getHaulerName() { return haulerName; }
    public void setHaulerName(String haulerName) { this.haulerName = haulerName; }

    public String getDriverName() { return driverName; }
    public void setDriverName(String driverName) { this.driverName = driverName; }

    public String getDriverContact() { return driverContact; }
    public void setDriverContact(String driverContact) { this.driverContact = driverContact; }

    public String getVehiclePlate() { return vehiclePlate; }
    public void setVehiclePlate(String vehiclePlate) { this.vehiclePlate = vehiclePlate; }

    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }

    public String getClientAddress() { return clientAddress; }
    public void setClientAddress(String clientAddress) { this.clientAddress = clientAddress; }

    public String getClientContact() { return clientContact; }
    public void setClientContact(String clientContact) { this.clientContact = clientContact; }

    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }

    public String getRecipientAddress() { return recipientAddress; }
    public void setRecipientAddress(String recipientAddress) { this.recipientAddress = recipientAddress; }

    public String getRecipientContact() { return recipientContact; }
    public void setRecipientContact(String recipientContact) { this.recipientContact = recipientContact; }

    public String getDestinationHub() { return destinationHub; }
    public void setDestinationHub(String destinationHub) { this.destinationHub = destinationHub; }

    public String getRoute() { return route; }
    public void setRoute(String route) { this.route = route; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }

    public String getGeneratedDate() { return generatedDate; }
    public void setGeneratedDate(String generatedDate) { this.generatedDate = generatedDate; }

    public LocalDateTime getDispatchedAt() { return dispatchedAt; }
    public void setDispatchedAt(LocalDateTime dispatchedAt) { this.dispatchedAt = dispatchedAt; }

    public String getDispatchedDate() { return dispatchedDate; }
    public void setDispatchedDate(String dispatchedDate) { this.dispatchedDate = dispatchedDate; }

    public String getSignedBy() { return signedBy; }
    public void setSignedBy(String signedBy) { this.signedBy = signedBy; }

    public LocalDateTime getSignedAt() { return signedAt; }
    public void setSignedAt(LocalDateTime signedAt) { this.signedAt = signedAt; }

    public String getSignedDate() { return signedDate; }
    public void setSignedDate(String signedDate) { this.signedDate = signedDate; }

    public Integer getTotalQuantity() { return totalQuantity; }
    public void setTotalQuantity(Integer totalQuantity) { this.totalQuantity = totalQuantity; }

    public BigDecimal getTotalWeightKg() { return totalWeightKg; }
    public void setTotalWeightKg(BigDecimal totalWeightKg) { this.totalWeightKg = totalWeightKg; }

    public BigDecimal getTotalVolumeCbm() { return totalVolumeCbm; }
    public void setTotalVolumeCbm(BigDecimal totalVolumeCbm) { this.totalVolumeCbm = totalVolumeCbm; }

    public List<ParcelUnitResponse> getParcels() { return parcels; }
    public void setParcels(List<ParcelUnitResponse> parcels) { this.parcels = parcels; }
}
