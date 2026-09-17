package com.tnl.logistics.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * DTO for mobile numeric PIN login requests.
 */
public class MobilePinLoginRequest {

    @NotBlank(message = "PIN is required")
    @Pattern(regexp = "^[0-9]{4,6}$", message = "PIN must be between 4 and 6 digits")
    private String pin;

    public MobilePinLoginRequest() {}

    public MobilePinLoginRequest(String pin) {
        this.pin = pin;
    }

    public String getPin() {
        return pin;
    }

    public void setPin(String pin) {
        this.pin = pin;
    }
}
