package com.tnl.logistics.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public class WaybillGenerationRequest {
    @NotBlank
    private String shipmentId;
    @NotEmpty
    private List<@NotBlank String> trackingIds;
    @NotBlank
    private String idempotencyKey;
    private String haulerName;
    private String driverName;
    private String driverContact;
    private String vehiclePlate;
    private String remarks;

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }
    public List<String> getTrackingIds() { return trackingIds; }
    public void setTrackingIds(List<String> trackingIds) { this.trackingIds = trackingIds; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public String getHaulerName() { return haulerName; }
    public void setHaulerName(String haulerName) { this.haulerName = haulerName; }
    public String getDriverName() { return driverName; }
    public void setDriverName(String driverName) { this.driverName = driverName; }
    public String getDriverContact() { return driverContact; }
    public void setDriverContact(String driverContact) { this.driverContact = driverContact; }
    public String getVehiclePlate() { return vehiclePlate; }
    public void setVehiclePlate(String vehiclePlate) { this.vehiclePlate = vehiclePlate; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
}
