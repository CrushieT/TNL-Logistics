package com.tnl.logistics.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Objects;
import org.hibernate.annotations.CreationTimestamp;

/**
 * Entity mapping to the app_user database table.
 */
@Entity
@Table(name = "app_user")
public class AppUser {

    @Id
    @Column(name = "user_id", length = 20)
    private String userId;

    @Column(name = "username", length = 50, nullable = false, unique = true)
    private String username;

    @Column(name = "password_hash", length = 255, nullable = false)
    private String passwordHash;

    @Column(name = "full_name", length = 150, nullable = false)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private UserRole role;

    @Column(name = "active", nullable = false)
    private Boolean active = true;

    @Column(name = "must_change_password", nullable = false)
    private Boolean mustChangePassword = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "staff_type")
    private StaffType staffType;

    @Column(name = "hauler_company", length = 100)
    private String haulerCompany;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public AppUser() {}

    public AppUser(String userId, String username, String passwordHash, String fullName, UserRole role) {
        this.userId = userId;
        this.username = username;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
        this.role = role;
    }

    public AppUser(String userId, String username, String passwordHash, String fullName, UserRole role, StaffType staffType, String haulerCompany) {
        this.userId = userId;
        this.username = username;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
        this.role = role;
        this.staffType = staffType;
        this.haulerCompany = haulerCompany;
    }

    // Getters and Setters
    public StaffType getStaffType() { return staffType; }
    public void setStaffType(StaffType staffType) { this.staffType = staffType; }

    public String getHaulerCompany() { return haulerCompany; }
    public void setHaulerCompany(String haulerCompany) { this.haulerCompany = haulerCompany; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public UserRole getRole() { return role; }
    public void setRole(UserRole role) { this.role = role; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public Boolean getMustChangePassword() { return mustChangePassword; }
    public void setMustChangePassword(Boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        AppUser appUser = (AppUser) o;
        return Objects.equals(userId, appUser.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId);
    }
}
