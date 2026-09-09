package com.tnl.logistics.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * DTO for admin setting or resetting a user's mobile PIN.
 */
public class AdminPinResetRequest {

    @NotBlank(message = "PIN is required")
    @Pattern(regexp = "^\\d{4}$", message = "PIN must be exactly 4 digits")
    private String pin;

    public AdminPinResetRequest() {}

    public String getPin() { return pin; }
    public void setPin(String pin) { this.pin = pin; }
}
