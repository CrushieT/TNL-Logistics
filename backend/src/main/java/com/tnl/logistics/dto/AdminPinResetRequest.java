package com.tnl.logistics.dto;

import jakarta.validation.constraints.Pattern;

/**
 * DTO for admin setting or resetting a user's mobile PIN.
 */
public class AdminPinResetRequest {

    @Pattern(regexp = "^\\d{4}$", message = "PIN must be exactly 4 digits")
    private String pin;

    private Boolean clearPin = false;

    public AdminPinResetRequest() {}

    public AdminPinResetRequest(String pin) {
        this.pin = pin;
        this.clearPin = false;
    }

    public AdminPinResetRequest(Boolean clearPin) {
        this.clearPin = clearPin;
    }

    public String getPin() { return pin; }
    public void setPin(String pin) { this.pin = pin; }

    public Boolean getClearPin() { return clearPin; }
    public void setClearPin(Boolean clearPin) { this.clearPin = clearPin; }
}
