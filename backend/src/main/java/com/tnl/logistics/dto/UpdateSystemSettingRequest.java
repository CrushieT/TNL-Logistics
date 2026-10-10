package com.tnl.logistics.dto;

import jakarta.validation.constraints.*;
import java.time.DayOfWeek;

/**
 * Request DTO for updating system settings by administrators.
 */
public class UpdateSystemSettingRequest {

    @NotBlank(message = "Business name is required")
    @Size(max = 50, message = "Business name must not exceed 50 characters")
    private String companyName;

    @NotBlank(message = "Address is required")
    @Size(max = 100, message = "Address must not exceed 100 characters")
    private String companyAddress;

    @NotBlank(message = "Contact number is required")
    @Size(min = 7, max = 11, message = "Contact number must be between 7 and 11 characters")
    @Pattern(regexp = "^[0-9]+$", message = "Contact number must contain digits only")
    private String companyContact;

    @NotBlank(message = "Billing email is required")
    @Email(message = "Billing email must be a valid email address")
    @Size(max = 50, message = "Billing email must not exceed 50 characters")
    private String billingEmail;

    @NotNull(message = "Weekly collection day is required")
    private DayOfWeek collectionDay;

    @NotNull(message = "Volumetric divisor is required")
    @Min(value = 1000, message = "Volumetric divisor must be at least 1000")
    @Max(value = 10000, message = "Volumetric divisor must not exceed 10000")
    private Integer volumetricDivisor;

    @NotNull(message = "Rate per kilo is required")
    @DecimalMin(value = "0.01", message = "Rate per kilo must be at least 0.01")
    @Digits(integer = 10, fraction = 2, message = "Rate per kilo must have at most 10 integer digits and 2 decimal places")
    private java.math.BigDecimal ratePerKilo;

    @NotBlank(message = "SOA bank name is required")
    @Size(max = 100, message = "SOA bank name must not exceed 100 characters")
    @Pattern(regexp = "^[^\\p{Cntrl}]*$", message = "SOA bank name must be a single line without control characters")
    private String soaBankName;

    @NotBlank(message = "SOA account name is required")
    @Size(max = 150, message = "SOA account name must not exceed 150 characters")
    @Pattern(regexp = "^[^\\p{Cntrl}]*$", message = "SOA account name must be a single line without control characters")
    private String soaAccountName;

    @NotBlank(message = "SOA account number is required")
    @Pattern(regexp = "^[0-9]{6,20}$", message = "SOA account number must contain 6 to 20 digits")
    private String soaAccountNumber;

    public UpdateSystemSettingRequest() {}

    public UpdateSystemSettingRequest(String companyName, String companyAddress, String companyContact,
                                      String billingEmail, DayOfWeek collectionDay, Integer volumetricDivisor) {
        this(companyName, companyAddress, companyContact, billingEmail, collectionDay, volumetricDivisor, null);
    }

    public UpdateSystemSettingRequest(String companyName, String companyAddress, String companyContact,
                                      String billingEmail, DayOfWeek collectionDay, Integer volumetricDivisor,
                                      java.math.BigDecimal ratePerKilo) {
        this.companyName = companyName;
        this.companyAddress = companyAddress;
        this.companyContact = companyContact;
        this.billingEmail = billingEmail;
        this.collectionDay = collectionDay;
        this.volumetricDivisor = volumetricDivisor;
        this.ratePerKilo = ratePerKilo;
    }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public String getCompanyAddress() { return companyAddress; }
    public void setCompanyAddress(String companyAddress) { this.companyAddress = companyAddress; }

    public String getCompanyContact() { return companyContact; }
    public void setCompanyContact(String companyContact) { this.companyContact = companyContact; }

    public String getBillingEmail() { return billingEmail; }
    public void setBillingEmail(String billingEmail) { this.billingEmail = billingEmail; }

    public DayOfWeek getCollectionDay() { return collectionDay; }
    public void setCollectionDay(DayOfWeek collectionDay) { this.collectionDay = collectionDay; }

    public Integer getVolumetricDivisor() { return volumetricDivisor; }
    public void setVolumetricDivisor(Integer volumetricDivisor) { this.volumetricDivisor = volumetricDivisor; }

    public java.math.BigDecimal getRatePerKilo() { return ratePerKilo; }
    public void setRatePerKilo(java.math.BigDecimal ratePerKilo) { this.ratePerKilo = ratePerKilo; }

    public String getSoaBankName() { return soaBankName; }
    public void setSoaBankName(String soaBankName) { this.soaBankName = soaBankName; }

    public String getSoaAccountName() { return soaAccountName; }
    public void setSoaAccountName(String soaAccountName) { this.soaAccountName = soaAccountName; }

    public String getSoaAccountNumber() { return soaAccountNumber; }
    public void setSoaAccountNumber(String soaAccountNumber) { this.soaAccountNumber = soaAccountNumber; }
}
