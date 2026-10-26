package com.tnl.logistics.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "waybill_return_scan", uniqueConstraints = @UniqueConstraint(columnNames = {"waybill_id", "tracking_id"}))
public class WaybillReturnScan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "waybill_id", nullable = false)
    private Waybill waybill;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tracking_id", nullable = false)
    private ParcelUnit parcel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scanned_by", nullable = false)
    private AppUser scannedBy;

    @CreationTimestamp
    @Column(name = "scanned_at", nullable = false, updatable = false)
    private LocalDateTime scannedAt;

    public WaybillReturnScan() {}

    public WaybillReturnScan(Waybill waybill, ParcelUnit parcel, AppUser scannedBy) {
        this.waybill = waybill;
        this.parcel = parcel;
        this.scannedBy = scannedBy;
    }

    public Long getId() { return id; }
    public Waybill getWaybill() { return waybill; }
    public ParcelUnit getParcel() { return parcel; }
    public AppUser getScannedBy() { return scannedBy; }
    public LocalDateTime getScannedAt() { return scannedAt; }
}
