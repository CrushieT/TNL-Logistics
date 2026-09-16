package com.tnl.logistics.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * DTO for admin-initiated password reset.
 * Forces mustChangePassword = true on the target account.
 */
public class AdminPasswordResetRequest {

    @NotBlank(message = "New password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    private String newPassword;

    public AdminPasswordResetRequest() {}

    public String getNewPassword() { return newPassword; }
    public void setNewPassword(String newPassword) { this.newPassword = newPassword; }
}
