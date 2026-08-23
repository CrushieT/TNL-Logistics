package com.tnl.logistics.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.Objects;

/**
 * Entity mapping to the parcel_unit database table.
 */
@Entity
@Table(name = "parcel_unit")
public class ParcelUnit {

    @Id
    @Column(name = "tracking_id", length = 30)
    private String trackingId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shipment_id", nullable = false)
    private Shipment shipment;

    @Column(name = "seq", nullable = false)
    private Integer seq;

    @Column(name = "weight_kg", precision = 8, scale = 2)
    private BigDecimal weightKg;

    @Column(name = "length_cm", precision = 8, scale = 2)
    private BigDecimal lengthCm;

    @Column(name = "height_cm", precision = 8, scale = 2)
    private BigDecimal heightCm;

    @Column(name = "width_cm", precision = 8, scale = 2)
    private BigDecimal widthCm;

    @Column(name = "volume_cbm", precision = 10, scale = 4)
    private BigDecimal volumeCbm;

    @Enumerated(EnumType.STRING)
    @Column(name = "current_status", nullable = false)
    private ParcelStatus currentStatus = ParcelStatus.REGISTERED;

    @Enumerated(EnumType.STRING)
    @Column(name = "label_status", nullable = false)
    private LabelStatus labelStatus = LabelStatus.NOT_PRINTED;

    @Column(name = "reprint_count", nullable = false)
    private Integer reprintCount = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_vehicle_id")
    private Vehicle currentVehicle;

    public ParcelUnit() {}

    public ParcelUnit(String trackingId, Shipment shipment, Integer seq, BigDecimal weightKg,
                      BigDecimal lengthCm, BigDecimal heightCm, BigDecimal widthCm, BigDecimal volumeCbm) {
        this.trackingId = trackingId;
        this.shipment = shipment;
        this.seq = seq;
        this.weightKg = weightKg;
        this.lengthCm = lengthCm;
        this.heightCm = heightCm;
        this.widthCm = widthCm;
        this.volumeCbm = volumeCbm;
    }

    // Getters and Setters
    public String getTrackingId() { return trackingId; }
    public void setTrackingId(String trackingId) { this.trackingId = trackingId; }

    public Shipment getShipment() { return shipment; }
    public void setShipment(Shipment shipment) { this.shipment = shipment; }

    public Integer getSeq() { return seq; }
    public void setSeq(Integer seq) { this.seq = seq; }

    public BigDecimal getWeightKg() { return weightKg; }
    public void setWeightKg(BigDecimal weightKg) { this.weightKg = weightKg; }

    public BigDecimal getLengthCm() { return lengthCm; }
    public void setLengthCm(BigDecimal lengthCm) { this.lengthCm = lengthCm; }

    public BigDecimal getHeightCm() { return heightCm; }
    public void setHeightCm(BigDecimal heightCm) { this.heightCm = heightCm; }

    public BigDecimal getWidthCm() { return widthCm; }
    public void setWidthCm(BigDecimal widthCm) { this.widthCm = widthCm; }

    public BigDecimal getVolumeCbm() { return volumeCbm; }
    public void setVolumeCbm(BigDecimal volumeCbm) { this.volumeCbm = volumeCbm; }

    public ParcelStatus getCurrentStatus() { return currentStatus; }
    public void setCurrentStatus(ParcelStatus currentStatus) { this.currentStatus = currentStatus; }

    public LabelStatus getLabelStatus() { return labelStatus; }
    public void setLabelStatus(LabelStatus labelStatus) { this.labelStatus = labelStatus; }

    public Integer getReprintCount() { return reprintCount; }
    public void setReprintCount(Integer reprintCount) { this.reprintCount = reprintCount; }

    public Vehicle getCurrentVehicle() { return currentVehicle; }
    public void setCurrentVehicle(Vehicle currentVehicle) { this.currentVehicle = currentVehicle; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ParcelUnit that = (ParcelUnit) o;
        return Objects.equals(trackingId, that.trackingId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(trackingId);
    }
}
