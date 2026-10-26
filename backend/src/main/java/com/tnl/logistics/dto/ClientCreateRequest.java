package com.tnl.logistics.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Request payload for creating or updating a client.
 */
public class ClientCreateRequest {

    @NotBlank(message = "Client name is required")
    @Size(min = 2, max = 150, message = "Client name must be between 2 and 150 characters")
    private String name;

    @NotBlank(message = "Billing address is required")
    @Size(min = 2, max = 255, message = "Billing address must be between 2 and 255 characters")
    private String address;

    @NotBlank(message = "Contact number is required")
    @Size(min = 7, max = 11, message = "Contact number must be between 7 and 11 characters")
    @Pattern(regexp = "^[0-9]+$", message = "Contact number must contain digits only")
    private String contactNumber;

    @Email(message = "Email must be a valid email address")
    @Size(max = 150, message = "Email cannot exceed 150 characters")
    private String email;

    private String defaultRateType;

    @DecimalMin(value = "0.01", message = "Client rate per kilo must be greater than zero")
    @DecimalMax(value = "99999.99", message = "Client rate per kilo cannot exceed 99,999.99")
    @Digits(integer = 5, fraction = 2, message = "Client rate per kilo must have at most 2 decimal places")
    private BigDecimal ratePerKilo;

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

    public ClientCreateRequest(String name, String address, String contactNumber, String email, String defaultRateType, BigDecimal ratePerKilo, Boolean active) {
        this.name = name;
        this.address = address;
        this.contactNumber = contactNumber;
        this.email = email;
        this.defaultRateType = defaultRateType;
        this.ratePerKilo = ratePerKilo;
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

    public BigDecimal getRatePerKilo() { return ratePerKilo; }
    public void setRatePerKilo(BigDecimal ratePerKilo) { this.ratePerKilo = ratePerKilo; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}
