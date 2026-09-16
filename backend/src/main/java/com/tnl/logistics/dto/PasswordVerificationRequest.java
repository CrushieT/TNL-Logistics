package com.tnl.logistics.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Request payload for verifying an authenticated user's current password.
 */
public class PasswordVerificationRequest {

    @NotBlank(message = "Password is required")
    private String password;

    public PasswordVerificationRequest() {}

    public PasswordVerificationRequest(String password) {
        this.password = password;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
