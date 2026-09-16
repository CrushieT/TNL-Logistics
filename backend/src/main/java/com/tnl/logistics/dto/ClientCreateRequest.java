package com.tnl.logistics.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request payload for creating a new client.
 */
public class ClientCreateRequest {

    @NotBlank(message = "Client name is required")
    @Size(min = 2, max = 150, message = "Client name must be between 2 and 150 characters")
    private String name;

    @NotBlank(message = "Billing address is required")
    @Size(min = 2, max = 255, message = "Billing address must be between 2 and 255 characters")
    private String address;

    @NotBlank(message = "Contact number is required")
    @Size(min = 7, max = 30, message = "Contact number must be between 7 and 30 characters")
    private String contactNumber;

    @Email(message = "Email must be a valid email address")
    @Size(max = 150, message = "Email cannot exceed 150 characters")
    private String email;

    private String defaultRateType;

    private Boolean active;

    public ClientCreateRequest() {}

    public ClientCreateRequest(String name, String address, String contactNumber, String email) {
        this.name = name;
        this.address = address;
        this.contactNumber = contactNumber;
        this.email = email;
    }

    public ClientCreateRequest(String name, String address, String contactNumber, String email, String defaultRateType, Boolean active) {
        this.name = name;
        this.address = address;
        this.contactNumber = contactNumber;
        this.email = email;
        this.defaultRateType = defaultRateType;
        this.active = active;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getContactNumber() { return contactNumber; }
    public void setContactNumber(String contactNumber) { this.contactNumber = contactNumber; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getDefaultRateType() { return defaultRateType; }
    public void setDefaultRateType(String defaultRateType) { this.defaultRateType = defaultRateType; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}
