package com.tnl.logistics.dto;

import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.StaffType;
import com.tnl.logistics.model.UserRole;

import java.time.LocalDateTime;

/**
 * Read-only response DTO for staff account data.
 * Password hash and PIN hash are never included.
 */
public class UserResponse {

    private String userId;
    private String fullName;
    private String username;
    private UserRole role;
    private StaffType staffType;
    private Boolean active;
    private Boolean mustChangePassword;
    private Boolean hasPinSet;
    private LocalDateTime createdAt;

    public UserResponse() {}

    public static UserResponse from(AppUser user) {
        UserResponse dto = new UserResponse();
        dto.userId = user.getUserId();
        dto.fullName = user.getFullName();
        dto.username = user.getUsername();
        dto.role = user.getRole();
        dto.staffType = user.getStaffType();
        dto.active = user.getActive();
        dto.mustChangePassword = user.getMustChangePassword();
        dto.hasPinSet = user.getPinHash() != null && !user.getPinHash().isBlank();
        dto.createdAt = user.getCreatedAt();
        return dto;
    }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public UserRole getRole() { return role; }
    public void setRole(UserRole role) { this.role = role; }

    public StaffType getStaffType() { return staffType; }
    public void setStaffType(StaffType staffType) { this.staffType = staffType; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public Boolean getMustChangePassword() { return mustChangePassword; }
    public void setMustChangePassword(Boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }

    public Boolean getHasPinSet() { return hasPinSet; }
    public void setHasPinSet(Boolean hasPinSet) { this.hasPinSet = hasPinSet; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
