package com.tnl.logistics.dto;

import java.time.DayOfWeek;

/**
 * Lightweight DTO providing branding and calculation parameters across authenticated staff portals.
 */
public class CompanyBrandingDto {

    private String companyName;
    private String companyAddress;
    private String companyContact;
    private String billingEmail;
    private DayOfWeek collectionDay;
    private Integer volumetricDivisor;

    public CompanyBrandingDto() {}

    public CompanyBrandingDto(String companyName, String companyAddress, String companyContact,
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
