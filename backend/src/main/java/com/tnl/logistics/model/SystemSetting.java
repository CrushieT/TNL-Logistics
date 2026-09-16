package com.tnl.logistics.model;

import jakarta.persistence.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Entity mapping to the system_setting database table.
 * Stores singleton configuration for company branding, collection cycle closing day,
 * and dimensional calculation divisor.
 */
@Entity
@Table(name = "system_setting")
public class SystemSetting {

    public static final Integer DEFAULT_SETTING_ID = 1;

    @Id
    @Column(name = "setting_id")
    private Integer settingId = DEFAULT_SETTING_ID;

    @Column(name = "company_name", length = 150, nullable = false)
    private String companyName = "TNL Logistics";

    @Column(name = "company_address", length = 255, nullable = false)
    private String companyAddress = "Manila Central Hub";

    @Column(name = "company_contact", length = 50, nullable = false)
    private String companyContact = "0917-555-0000";

    @Column(name = "billing_email", length = 100, nullable = false)
    private String billingEmail = "billing@tnllogistics.ph";

    @Enumerated(EnumType.STRING)
    @Column(name = "collection_day", length = 20, nullable = false)
    private DayOfWeek collectionDay = DayOfWeek.THURSDAY;

    @Column(name = "volumetric_divisor", nullable = false)
    private Integer volumetricDivisor = 5000;

    @Column(name = "tracking_prefix", length = 20, nullable = false)
    private String trackingPrefix = "TRK";

    @Column(name = "shipment_prefix", length = 20, nullable = false)
    private String shipmentPrefix = "SHP";

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "updated_by", length = 50)
    private String updatedBy;

    public SystemSetting() {}

    public SystemSetting(Integer settingId, String companyName, String companyAddress,
                         String companyContact, String billingEmail, DayOfWeek collectionDay,
                         Integer volumetricDivisor, String trackingPrefix, String shipmentPrefix) {
        this.settingId = settingId;
        this.companyName = companyName;
        this.companyAddress = companyAddress;
        this.companyContact = companyContact;
        this.billingEmail = billingEmail;
        this.collectionDay = collectionDay;
        this.volumetricDivisor = volumetricDivisor;
        this.trackingPrefix = trackingPrefix;
        this.shipmentPrefix = shipmentPrefix;
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

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SystemSetting that = (SystemSetting) o;
        return Objects.equals(settingId, that.settingId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(settingId);
    }
}
