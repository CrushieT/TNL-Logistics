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

    @NotBlank(message = "Username is required")
    private String username;

    public MobilePinLoginRequest() {}

    public MobilePinLoginRequest(String pin) {
        this(pin, null);
    }

    public MobilePinLoginRequest(String pin, String username) {
        this.pin = pin;
        this.username = username;
    }

    public String getPin() {
        return pin;
    }

    public void setPin(String pin) {
        this.pin = pin;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }
}
