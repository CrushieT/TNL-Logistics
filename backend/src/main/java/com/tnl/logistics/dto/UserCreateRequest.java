package com.tnl.logistics.dto;

import com.tnl.logistics.model.StaffType;
import com.tnl.logistics.model.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * DTO for creating a new staff account.
 */
public class UserCreateRequest {

    @NotBlank(message = "Full name is required")
    @Size(min = 2, max = 150, message = "Full name must be between 2 and 150 characters")
    private String fullName;

    @NotBlank(message = "Username is required")
    @Pattern(regexp = "^\\s*[a-zA-Z0-9][a-zA-Z0-9._-]{2,49}\\s*$", message = "Username must be 3 to 50 characters and use only letters, numbers, periods, underscores, or hyphens")
    private String username;

    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;

    @NotNull(message = "Role is required")
    private UserRole role;

    // Temporary compatibility data; authorization is always derived from role.
    private StaffType staffType;

    // Optional 4-digit numeric PIN for mobile login
    @Pattern(regexp = "^\\d{4}$", message = "PIN must be exactly 4 digits")
    private String pin;

    public UserCreateRequest() {}

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public UserRole getRole() { return role; }
    public void setRole(UserRole role) { this.role = role; }

    public StaffType getStaffType() { return staffType; }
    public void setStaffType(StaffType staffType) { this.staffType = staffType; }

    public String getPin() { return pin; }
    public void setPin(String pin) { this.pin = pin; }
}
