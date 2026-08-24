package com.tnl.logistics.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Objects;
import org.hibernate.annotations.CreationTimestamp;

/**
 * Entity mapping to the tracking_event database table.
 * Append-only audit history of parcel status scans.
 */
@Entity
@Table(name = "tracking_event")
public class TrackingEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "event_id")
    private Long eventId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tracking_id", nullable = false)
    private ParcelUnit parcelUnit;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ParcelStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_id")
    private Vehicle vehicle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id", nullable = false)
    private AppUser staff;

    @Column(name = "remarks", length = 255)
    private String remarks;

    @CreationTimestamp
    @Column(name = "event_timestamp", nullable = false, updatable = false)
    private LocalDateTime eventTimestamp;

    public TrackingEvent() {}

    public TrackingEvent(ParcelUnit parcelUnit, ParcelStatus status, AppUser staff, String remarks) {
        this.parcelUnit = parcelUnit;
        this.status = status;
        this.staff = staff;
        this.remarks = remarks;
    }

    public TrackingEvent(ParcelUnit parcelUnit, ParcelStatus status, Vehicle vehicle, AppUser staff, String remarks) {
        this.parcelUnit = parcelUnit;
        this.status = status;
        this.vehicle = vehicle;
        this.staff = staff;
        this.remarks = remarks;
    }

    // Getters and Setters
    public Long getEventId() { return eventId; }
    public void setEventId(Long eventId) { this.eventId = eventId; }

    public ParcelUnit getParcelUnit() { return parcelUnit; }
    public void setParcelUnit(ParcelUnit parcelUnit) { this.parcelUnit = parcelUnit; }

    public ParcelStatus getStatus() { return status; }
    public void setStatus(ParcelStatus status) { this.status = status; }

    public Vehicle getVehicle() { return vehicle; }
    public void setVehicle(Vehicle vehicle) { this.vehicle = vehicle; }

    public AppUser getStaff() { return staff; }
    public void setStaff(AppUser staff) { this.staff = staff; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public LocalDateTime getEventTimestamp() { return eventTimestamp; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        TrackingEvent that = (TrackingEvent) o;
        return Objects.equals(eventId, that.eventId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(eventId);
    }
}
