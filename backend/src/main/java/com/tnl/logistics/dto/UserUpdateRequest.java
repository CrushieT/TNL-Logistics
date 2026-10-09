package com.tnl.logistics.dto;

import com.tnl.logistics.model.UserRole;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * DTO for updating an existing staff account.
 * Password and PIN changes use dedicated endpoints.
 */
public class UserUpdateRequest {

    @NotBlank(message = "Full name is required")
    @Size(min = 2, max = 150, message = "Full name must be between 2 and 150 characters")
    private String fullName;

    @NotBlank(message = "Username is required")
    @Pattern(regexp = "^\\s*[a-zA-Z0-9][a-zA-Z0-9._-]{2,49}\\s*$", message = "Username must be 3 to 50 characters and use only letters, numbers, periods, underscores, or hyphens")
    private String username;

    @NotNull(message = "Role is required")
    private UserRole role;


    @NotNull(message = "Active status is required")
    private Boolean active;

    public UserUpdateRequest() {}

    @JsonAnySetter
    public void rejectRetiredIdentityField(String fieldName, Object value) {
        if ("staffType".equals(fieldName) || "staff_type".equals(fieldName)) {
            throw new IllegalArgumentException("Staff subtype input is no longer supported.");
        }
    }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public UserRole getRole() { return role; }
    public void setRole(UserRole role) { this.role = role; }


    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}
