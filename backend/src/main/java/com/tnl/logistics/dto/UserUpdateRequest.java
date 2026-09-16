package com.tnl.logistics.dto;

import com.tnl.logistics.model.StaffType;
import com.tnl.logistics.model.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * DTO for updating an existing staff account.
 * Password and PIN changes use dedicated endpoints.
 */
public class UserUpdateRequest {

    @NotBlank(message = "Full name is required")
    private String fullName;

    @NotBlank(message = "Username is required")
    private String username;

    @NotNull(message = "Role is required")
    private UserRole role;

    private StaffType staffType;

    @NotNull(message = "Active status is required")
    private Boolean active;

    public UserUpdateRequest() {}

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
}
