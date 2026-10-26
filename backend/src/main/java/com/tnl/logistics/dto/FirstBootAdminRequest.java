package com.tnl.logistics.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import java.math.BigDecimal;

/**
 * Request payload for registering the primary system administrator and configuring
 * initial company branding on first boot.
 */
public class FirstBootAdminRequest {

    @NotBlank(message = "Full name is required")
    private String fullName;

    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    private String username;

    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;

    @NotBlank(message = "Confirm password is required")
    private String confirmPassword;

    @NotBlank(message = "Business name is required")
    private String companyName;

    @NotBlank(message = "Company address is required")
    private String companyAddress;

    @NotBlank(message = "Company contact is required")
    private String companyContact;

    @NotBlank(message = "Billing email is required")
    @Email(message = "Invalid billing email format")
    private String billingEmail;

    @NotBlank(message = "SOA bank name is required")
    @Size(max = 100, message = "SOA bank name must not exceed 100 characters")
    @Pattern(regexp = "^[^\\p{Cc}\\p{Zl}\\p{Zp}]*$", message = "SOA bank name must be a single line without control characters")
    private String soaBankName;

    @NotBlank(message = "SOA account name is required")
    @Size(max = 150, message = "SOA account name must not exceed 150 characters")
    @Pattern(regexp = "^[^\\p{Cc}\\p{Zl}\\p{Zp}]*$", message = "SOA account name must be a single line without control characters")
    private String soaAccountName;

    @NotBlank(message = "SOA account number is required")
    @Pattern(regexp = "^[0-9]{6,20}$", message = "SOA account number must contain 6 to 20 digits")
    private String soaAccountNumber;

    @NotNull(message = "Rate per kilo is required")
    @DecimalMin(value = "0.01", message = "Rate per kilo must be at least 0.01")
    @Digits(integer = 10, fraction = 2, message = "Rate per kilo must have at most 10 integer digits and 2 decimal places")
    private BigDecimal ratePerKilo;

    public String getSoaBankName() { return soaBankName; }
    public void setSoaBankName(String soaBankName) { this.soaBankName = soaBankName == null ? null : soaBankName.trim(); }

    public String getSoaAccountName() { return soaAccountName; }
    public void setSoaAccountName(String soaAccountName) { this.soaAccountName = soaAccountName == null ? null : soaAccountName.trim(); }

    public String getSoaAccountNumber() { return soaAccountNumber; }
    public void setSoaAccountNumber(String soaAccountNumber) { this.soaAccountNumber = soaAccountNumber == null ? null : soaAccountNumber.trim(); }

    public BigDecimal getRatePerKilo() { return ratePerKilo; }
    public void setRatePerKilo(BigDecimal ratePerKilo) { this.ratePerKilo = ratePerKilo; }

    public FirstBootAdminRequest() {}

    public FirstBootAdminRequest(String fullName, String username, String password, String confirmPassword) {
        this(fullName, username, password, confirmPassword, "TC & CT Integrated Logistics", "Labo, Camarines Norte", "0917-555-0000", "billing@tnllogistics.ph");
    }

    public FirstBootAdminRequest(String fullName, String username, String password, String confirmPassword,
                                 String companyName, String companyAddress, String companyContact, String billingEmail) {
        this.fullName = fullName;
        this.username = username;
        this.password = password;
        this.confirmPassword = confirmPassword;
        this.companyName = companyName;
        this.companyAddress = companyAddress;
        this.companyContact = companyContact;
        this.billingEmail = billingEmail;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getConfirmPassword() {
        return confirmPassword;
    }

    public void setConfirmPassword(String confirmPassword) {
        this.confirmPassword = confirmPassword;
    }

    public String getCompanyName() {
        return companyName;
    }

    public void setCompanyName(String companyName) {
        this.companyName = companyName;
    }

    public String getCompanyAddress() {
        return companyAddress;
    }

    public void setCompanyAddress(String companyAddress) {
        this.companyAddress = companyAddress;
    }

    public String getCompanyContact() {
        return companyContact;
    }

    public void setCompanyContact(String companyContact) {
        this.companyContact = companyContact;
    }

    public String getBillingEmail() {
        return billingEmail;
    }

    public void setBillingEmail(String billingEmail) {
        this.billingEmail = billingEmail;
    }
}
