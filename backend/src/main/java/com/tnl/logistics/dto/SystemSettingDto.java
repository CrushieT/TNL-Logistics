package com.tnl.logistics.dto;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Data Transfer Object representing system configuration for administrative views.
 */
public class SystemSettingDto {

    private Integer settingId;
    private String companyName;
    private String companyAddress;
    private String companyContact;
    private String billingEmail;
    private DayOfWeek collectionDay;
    private Integer volumetricDivisor;
    private String trackingPrefix;
    private String shipmentPrefix;
    private String trackingIdPrefixPreview;
    private String shipmentIdPrefixPreview;
    private LocalDateTime updatedAt;
    private String updatedBy;

    public SystemSettingDto() {}

    public SystemSettingDto(Integer settingId, String companyName, String companyAddress,
                            String companyContact, String billingEmail, DayOfWeek collectionDay,
                            Integer volumetricDivisor, String trackingPrefix, String shipmentPrefix,
                            LocalDateTime updatedAt, String updatedBy) {
        this.settingId = settingId;
        this.companyName = companyName;
        this.companyAddress = companyAddress;
        this.companyContact = companyContact;
        this.billingEmail = billingEmail;
        this.collectionDay = collectionDay;
        this.volumetricDivisor = volumetricDivisor;
        this.trackingPrefix = trackingPrefix;
        this.shipmentPrefix = shipmentPrefix;
        int currentYear = LocalDate.now().getYear();
        this.trackingIdPrefixPreview = (trackingPrefix != null ? trackingPrefix : "TRK") + "-" + currentYear + "-";
        this.shipmentIdPrefixPreview = (shipmentPrefix != null ? shipmentPrefix : "SHP") + "-" + currentYear + "-";
        this.updatedAt = updatedAt;
        this.updatedBy = updatedBy;
    }

    public Integer getSettingId() { return settingId; }
    public void setSettingId(Integer settingId) { this.settingId = settingId; }

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

    public String getTrackingPrefix() { return trackingPrefix; }
    public void setTrackingPrefix(String trackingPrefix) { this.trackingPrefix = trackingPrefix; }

    public String getShipmentPrefix() { return shipmentPrefix; }
    public void setShipmentPrefix(String shipmentPrefix) { this.shipmentPrefix = shipmentPrefix; }

    public String getTrackingIdPrefixPreview() { return trackingIdPrefixPreview; }
    public void setTrackingIdPrefixPreview(String trackingIdPrefixPreview) { this.trackingIdPrefixPreview = trackingIdPrefixPreview; }

    public String getShipmentIdPrefixPreview() { return shipmentIdPrefixPreview; }
    public void setShipmentIdPrefixPreview(String shipmentIdPrefixPreview) { this.shipmentIdPrefixPreview = shipmentIdPrefixPreview; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
