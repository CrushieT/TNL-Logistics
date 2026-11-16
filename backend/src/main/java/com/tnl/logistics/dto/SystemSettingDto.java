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
    private java.math.BigDecimal ratePerKilo;
    private String soaBankName;
    private String soaAccountName;
    private String soaAccountNumber;
    private String trackingPrefix;
    private String shipmentPrefix;
    private String trackingIdPrefixPreview;
    private String shipmentIdPrefixPreview;
    private Integer minMobileVersionCode;
    private Integer latestMobileVersionCode;
    private String latestMobileVersionName;
    private String mobileApkDownloadUrl;
    private Boolean mobileForceUpdate;
    private String mobileUpdateReleaseNotes;
    private LocalDateTime updatedAt;
    private String updatedBy;

    public SystemSettingDto() {}

    public SystemSettingDto(Integer settingId, String companyName, String companyAddress,
                            String companyContact, String billingEmail, DayOfWeek collectionDay,
                            Integer volumetricDivisor, String trackingPrefix, String shipmentPrefix,
                            LocalDateTime updatedAt, String updatedBy) {
        this(settingId, companyName, companyAddress, companyContact, billingEmail, collectionDay,
             volumetricDivisor, null, trackingPrefix, shipmentPrefix, updatedAt, updatedBy);
    }

    public SystemSettingDto(Integer settingId, String companyName, String companyAddress,
                            String companyContact, String billingEmail, DayOfWeek collectionDay,
                            Integer volumetricDivisor, java.math.BigDecimal ratePerKilo,
                            String trackingPrefix, String shipmentPrefix,
                            LocalDateTime updatedAt, String updatedBy) {
        this(settingId, companyName, companyAddress, companyContact, billingEmail, collectionDay,
             volumetricDivisor, ratePerKilo, null, null, null, trackingPrefix, shipmentPrefix,
             updatedAt, updatedBy);
    }

    public SystemSettingDto(Integer settingId, String companyName, String companyAddress,
                            String companyContact, String billingEmail, DayOfWeek collectionDay,
                            Integer volumetricDivisor, java.math.BigDecimal ratePerKilo,
                            String soaBankName, String soaAccountName, String soaAccountNumber,
                            String trackingPrefix, String shipmentPrefix,
                            LocalDateTime updatedAt, String updatedBy) {
        this(settingId, companyName, companyAddress, companyContact, billingEmail, collectionDay,
             volumetricDivisor, ratePerKilo, soaBankName, soaAccountName, soaAccountNumber,
             trackingPrefix, shipmentPrefix, 1, 1, "1.0.0", null, true, null,
             updatedAt, updatedBy);
    }

    public SystemSettingDto(Integer settingId, String companyName, String companyAddress,
                            String companyContact, String billingEmail, DayOfWeek collectionDay,
                            Integer volumetricDivisor, java.math.BigDecimal ratePerKilo,
                            String soaBankName, String soaAccountName, String soaAccountNumber,
                            String trackingPrefix, String shipmentPrefix,
                            Integer minMobileVersionCode, Integer latestMobileVersionCode,
                            String latestMobileVersionName, String mobileApkDownloadUrl,
                            Boolean mobileForceUpdate, String mobileUpdateReleaseNotes,
                            LocalDateTime updatedAt, String updatedBy) {
        this.settingId = settingId;
        this.companyName = companyName;
        this.companyAddress = companyAddress;
        this.companyContact = companyContact;
        this.billingEmail = billingEmail;
        this.collectionDay = collectionDay;
        this.volumetricDivisor = volumetricDivisor;
        this.ratePerKilo = ratePerKilo;
        this.soaBankName = soaBankName;
        this.soaAccountName = soaAccountName;
        this.soaAccountNumber = soaAccountNumber;
        this.trackingPrefix = trackingPrefix;
        this.shipmentPrefix = shipmentPrefix;
        this.minMobileVersionCode = minMobileVersionCode != null ? minMobileVersionCode : 1;
        this.latestMobileVersionCode = latestMobileVersionCode != null ? latestMobileVersionCode : 1;
        this.latestMobileVersionName = latestMobileVersionName != null ? latestMobileVersionName : "1.0.0";
        this.mobileApkDownloadUrl = mobileApkDownloadUrl;
        this.mobileForceUpdate = mobileForceUpdate != null ? mobileForceUpdate : true;
        this.mobileUpdateReleaseNotes = mobileUpdateReleaseNotes;
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

    public java.math.BigDecimal getRatePerKilo() { return ratePerKilo; }
    public void setRatePerKilo(java.math.BigDecimal ratePerKilo) { this.ratePerKilo = ratePerKilo; }

    public String getSoaBankName() { return soaBankName; }
    public void setSoaBankName(String soaBankName) { this.soaBankName = soaBankName; }

    public String getSoaAccountName() { return soaAccountName; }
    public void setSoaAccountName(String soaAccountName) { this.soaAccountName = soaAccountName; }

    public String getSoaAccountNumber() { return soaAccountNumber; }
    public void setSoaAccountNumber(String soaAccountNumber) { this.soaAccountNumber = soaAccountNumber; }

    public String getTrackingPrefix() { return trackingPrefix; }
    public void setTrackingPrefix(String trackingPrefix) { this.trackingPrefix = trackingPrefix; }

    public String getShipmentPrefix() { return shipmentPrefix; }
    public void setShipmentPrefix(String shipmentPrefix) { this.shipmentPrefix = shipmentPrefix; }

    public String getTrackingIdPrefixPreview() { return trackingIdPrefixPreview; }
    public void setTrackingIdPrefixPreview(String trackingIdPrefixPreview) { this.trackingIdPrefixPreview = trackingIdPrefixPreview; }

    public String getShipmentIdPrefixPreview() { return shipmentIdPrefixPreview; }
    public void setShipmentIdPrefixPreview(String shipmentIdPrefixPreview) { this.shipmentIdPrefixPreview = shipmentIdPrefixPreview; }

    public Integer getMinMobileVersionCode() { return minMobileVersionCode; }
    public void setMinMobileVersionCode(Integer minMobileVersionCode) { this.minMobileVersionCode = minMobileVersionCode; }

    public Integer getLatestMobileVersionCode() { return latestMobileVersionCode; }
    public void setLatestMobileVersionCode(Integer latestMobileVersionCode) { this.latestMobileVersionCode = latestMobileVersionCode; }

    public String getLatestMobileVersionName() { return latestMobileVersionName; }
    public void setLatestMobileVersionName(String latestMobileVersionName) { this.latestMobileVersionName = latestMobileVersionName; }

    public String getMobileApkDownloadUrl() { return mobileApkDownloadUrl; }
    public void setMobileApkDownloadUrl(String mobileApkDownloadUrl) { this.mobileApkDownloadUrl = mobileApkDownloadUrl; }

    public Boolean getMobileForceUpdate() { return mobileForceUpdate; }
    public void setMobileForceUpdate(Boolean mobileForceUpdate) { this.mobileForceUpdate = mobileForceUpdate; }

    public String getMobileUpdateReleaseNotes() { return mobileUpdateReleaseNotes; }
    public void setMobileUpdateReleaseNotes(String mobileUpdateReleaseNotes) { this.mobileUpdateReleaseNotes = mobileUpdateReleaseNotes; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
