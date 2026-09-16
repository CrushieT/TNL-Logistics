package com.tnl.logistics.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Objects;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.data.domain.Persistable;

/**
 * Entity mapping to waybill database table representing formal hauler custody handover and legal POD.
 */
@Entity
@Table(name = "waybill")
public class Waybill implements Persistable<String> {

    @Id
    @Column(name = "waybill_id", length = 20)
    private String waybillId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shipment_id", nullable = false, unique = true)
    private Shipment shipment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "generated_by", nullable = false)
    private AppUser generatedBy;

    @Column(name = "hauler_name", length = 100, nullable = false)
    private String haulerName;

    @Column(name = "driver_name", length = 100)
    private String driverName;

    @Column(name = "driver_contact", length = 50)
    private String driverContact;

    @Column(name = "vehicle_plate", length = 50)
    private String vehiclePlate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private WaybillStatus status = WaybillStatus.GENERATED;

    @Column(name = "pdf_path", length = 255)
    private String pdfPath;

    @Column(name = "dispatched_at")
    private LocalDateTime dispatchedAt;

    @Column(name = "signed_by", length = 150)
    private String signedBy;

    @Column(name = "signed_at")
    private LocalDateTime signedAt;

    @Column(name = "remarks", length = 255)
    private String remarks;

    @CreationTimestamp
    @Column(name = "generated_at", nullable = false, updatable = false)
    private LocalDateTime generatedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Transient
    private boolean isNew = true;

    @Override
    public String getId() {
        return waybillId;
    }

    @Override
    public boolean isNew() {
        return isNew || generatedAt == null;
    }

    @PostLoad
    @PostPersist
    void markNotNew() {
        this.isNew = false;
    }

    public Waybill() {}

    public Waybill(String waybillId, Shipment shipment, AppUser generatedBy, String haulerName) {
        this.waybillId = waybillId;
        this.shipment = shipment;
        this.generatedBy = generatedBy;
        this.haulerName = haulerName;
        this.status = WaybillStatus.GENERATED;
    }

    // Getters and Setters
    public String getWaybillId() { return waybillId; }
    public void setWaybillId(String waybillId) { this.waybillId = waybillId; }

    public Shipment getShipment() { return shipment; }
    public void setShipment(Shipment shipment) { this.shipment = shipment; }

    public AppUser getGeneratedBy() { return generatedBy; }
    public void setGeneratedBy(AppUser generatedBy) { this.generatedBy = generatedBy; }

    public String getHaulerName() { return haulerName; }
    public void setHaulerName(String haulerName) { this.haulerName = haulerName; }

    public String getDriverName() { return driverName; }
    public void setDriverName(String driverName) { this.driverName = driverName; }

    public String getDriverContact() { return driverContact; }
    public void setDriverContact(String driverContact) { this.driverContact = driverContact; }

    public String getVehiclePlate() { return vehiclePlate; }
    public void setVehiclePlate(String vehiclePlate) { this.vehiclePlate = vehiclePlate; }

    public WaybillStatus getStatus() { return status; }
    public void setStatus(WaybillStatus status) { this.status = status; }

    public String getPdfPath() { return pdfPath; }
    public void setPdfPath(String pdfPath) { this.pdfPath = pdfPath; }

    public LocalDateTime getDispatchedAt() { return dispatchedAt; }
    public void setDispatchedAt(LocalDateTime dispatchedAt) { this.dispatchedAt = dispatchedAt; }

    public String getSignedBy() { return signedBy; }
    public void setSignedBy(String signedBy) { this.signedBy = signedBy; }

    public LocalDateTime getSignedAt() { return signedAt; }
    public void setSignedAt(LocalDateTime signedAt) { this.signedAt = signedAt; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Waybill waybill = (Waybill) o;
        return Objects.equals(waybillId, waybill.waybillId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(waybillId);
    }
}
