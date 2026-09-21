package com.tnl.logistics.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * DTO for mobile PIN setup requests.
 */
public class MobilePinSetupRequest {

    @NotBlank(message = "PIN is required")
    @Pattern(regexp = "^[0-9]{4}$", message = "PIN must be exactly 4 digits")
    private String pin;

    @Size(max = 128, message = "Current password must not exceed 128 characters")
    private String currentPassword;

    public MobilePinSetupRequest() {}

    public MobilePinSetupRequest(String pin) {
        this(pin, null);
    }

    public MobilePinSetupRequest(String pin, String currentPassword) {
        this.pin = pin;
        this.currentPassword = currentPassword;
    }

    public String getPin() {
        return pin;
    }

    public void setPin(String pin) {
        this.pin = pin;
    }

    public String getCurrentPassword() {
        return currentPassword;
    }

    public void setCurrentPassword(String currentPassword) {
        this.currentPassword = currentPassword;
    }
}
