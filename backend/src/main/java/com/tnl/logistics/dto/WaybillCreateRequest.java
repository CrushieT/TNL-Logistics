package com.tnl.logistics.dto;

import jakarta.validation.constraints.NotBlank;

public class WaybillCreateRequest {

    @NotBlank(message = "Shipment ID is required")
    private String shipmentId;

    @NotBlank(message = "Hauler name is required")
    private String haulerName;

    private String driverName;
    private String driverContact;
    private String vehiclePlate;
    private String remarks;

    public WaybillCreateRequest() {}

    public WaybillCreateRequest(String shipmentId, String haulerName, String driverName, String driverContact, String vehiclePlate, String remarks) {
        this.shipmentId = shipmentId;
        this.haulerName = haulerName;
        this.driverName = driverName;
        this.driverContact = driverContact;
        this.vehiclePlate = vehiclePlate;
        this.remarks = remarks;
    }

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

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
