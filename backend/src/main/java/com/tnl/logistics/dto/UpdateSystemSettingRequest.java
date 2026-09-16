package com.tnl.logistics.dto;

import jakarta.validation.constraints.*;
import java.time.DayOfWeek;

/**
 * Request DTO for updating system settings by administrators.
 */
public class UpdateSystemSettingRequest {

    @NotBlank(message = "Business name is required")
    @Size(max = 150, message = "Business name must not exceed 150 characters")
    private String companyName;

    @NotBlank(message = "Address is required")
    @Size(max = 255, message = "Address must not exceed 255 characters")
    private String companyAddress;

    @NotBlank(message = "Contact number is required")
    @Size(min = 7, max = 50, message = "Contact number must be between 7 and 50 characters")
    private String companyContact;

    @NotBlank(message = "Billing email is required")
    @Email(message = "Billing email must be a valid email address")
    @Size(max = 100, message = "Billing email must not exceed 100 characters")
    private String billingEmail;

    @NotNull(message = "Weekly collection day is required")
    private DayOfWeek collectionDay;

    @NotNull(message = "Volumetric divisor is required")
    @Min(value = 1000, message = "Volumetric divisor must be at least 1000")
    @Max(value = 10000, message = "Volumetric divisor must not exceed 10000")
    private Integer volumetricDivisor;

    public UpdateSystemSettingRequest() {}

    public UpdateSystemSettingRequest(String companyName, String companyAddress, String companyContact,
                                      String billingEmail, DayOfWeek collectionDay, Integer volumetricDivisor) {
        this.companyName = companyName;
        this.companyAddress = companyAddress;
        this.companyContact = companyContact;
        this.billingEmail = billingEmail;
        this.collectionDay = collectionDay;
        this.volumetricDivisor = volumetricDivisor;
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
}
