package com.tnl.logistics.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.springframework.data.domain.Persistable;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Entity mapping to the vehicle database table.
 * Implements Persistable to properly handle assigned IDs with Spring Data JPA.
 */
@Entity
@Table(name = "vehicle")
public class Vehicle implements Persistable<String> {

    @Id
    @Column(name = "vehicle_id", length = 20)
    private String vehicleId;

    @Column(name = "plate_number", length = 20, nullable = false, unique = true)
    private String plateNumber;

    @Column(name = "description", length = 100, nullable = false)
    private String description;

    @Column(name = "active", nullable = false)
    private Boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Transient
    private boolean isNew = true;

    public Vehicle() {}

    public Vehicle(String vehicleId, String plateNumber, String description) {
        this.vehicleId = vehicleId;
        this.plateNumber = plateNumber;
        this.description = description;
        this.active = true;
    }

    @Override
    public String getId() {
        return vehicleId;
    }

    @Override
    public boolean isNew() {
        return isNew || createdAt == null;
    }

    @PostLoad
    @PostPersist
    void markNotNew() {
        this.isNew = false;
    }

    // Getters and Setters
    public String getVehicleId() { return vehicleId; }
    public void setVehicleId(String vehicleId) { this.vehicleId = vehicleId; }

    public String getPlateNumber() { return plateNumber; }
    public void setPlateNumber(String plateNumber) { this.plateNumber = plateNumber; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Vehicle vehicle = (Vehicle) o;
        return Objects.equals(vehicleId, vehicle.vehicleId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(vehicleId);
    }
}
