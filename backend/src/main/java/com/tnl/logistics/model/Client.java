package com.tnl.logistics.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Objects;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import org.springframework.data.domain.Persistable;

/**
 * Entity mapping to the client database table.
 * Implements Persistable to properly handle assigned IDs with Spring Data JPA.
 */
@Entity
@Table(name = "client")
public class Client implements Persistable<String> {

    @Id
    @Column(name = "client_id", length = 20)
    private String clientId;

    @Column(name = "name", length = 150, nullable = false)
    private String name;

    @Column(name = "address", length = 255, nullable = false)
    private String address;

    @Column(name = "contact_number", length = 30, nullable = false)
    private String contactNumber;

    @Column(name = "email", length = 150)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(name = "default_rate_type", nullable = false)
    private ChargeModel defaultRateType = ChargeModel.FLAT;

    @Column(name = "active", nullable = false)
    private Boolean active = true;

    @CreationTimestamp
    @Column(name = "date_registered", nullable = false, updatable = false)
    private LocalDateTime dateRegistered;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Transient
    private boolean isNew = true;

    @Override
    public String getId() {
        return clientId;
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

    // Default Constructor
    public Client() {}

    // Parametric Constructor
    public Client(String clientId, String name, String address, String contactNumber, String email) {
        this.clientId = clientId;
        this.name = name;
        this.address = address;
        this.contactNumber = contactNumber;
        this.email = email;
        this.defaultRateType = ChargeModel.FLAT;
        this.active = true;
    }

    public Client(String clientId, String name, String address, String contactNumber, String email, ChargeModel defaultRateType, Boolean active) {
        this.clientId = clientId;
        this.name = name;
        this.address = address;
        this.contactNumber = contactNumber;
        this.email = email;
        this.defaultRateType = defaultRateType != null ? defaultRateType : ChargeModel.FLAT;
        this.active = active != null ? active : true;
    }

    // Getters and Setters
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

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Client client = (Client) o;
        return Objects.equals(clientId, client.clientId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(clientId);
    }
}
