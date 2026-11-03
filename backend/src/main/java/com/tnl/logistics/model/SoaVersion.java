package com.tnl.logistics.model;

import jakarta.persistence.*;
import java.time.Instant;

@org.hibernate.annotations.Immutable
@Entity
@Table(name = "soa_version")
@IdClass(SoaVersionId.class)
public class SoaVersion {

    @Id
    @Column(name = "soa_no", length = 30, nullable = false, updatable = false)
    private String soaNo;

    @Id
    @Column(name = "version_number", nullable = false, updatable = false)
    private int versionNumber;

    @Column(name = "request_id", length = 64, nullable = false, updatable = false, unique = true)
    private String requestId;

    @Column(name = "request_fingerprint", length = 128, nullable = false, updatable = false)
    private String requestFingerprint;

    @Column(name = "capture_time", nullable = false, updatable = false)
    private Instant captureTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "captured_by_user_id", nullable = false, updatable = false)
    private AppUser capturedBy;

    @Column(name = "captured_by_name", length = 150, nullable = false, updatable = false)
    private String capturedByName;

    @Column(name = "financial_revision", nullable = false, updatable = false)
    private int financialRevision;

    @Column(name = "logo_hash", length = 64, columnDefinition = "CHAR(64)", nullable = false, updatable = false)
    private String logoHash;

    @Column(name = "printable_data", nullable = false, updatable = false, columnDefinition = "JSON")
    private String printableData;

    public SoaVersion() {}

    public SoaVersion(String soaNo, int versionNumber, String requestId, String requestFingerprint,
                      Instant captureTime, AppUser capturedBy, String capturedByName,
                      int financialRevision, String logoHash, String printableData) {
        this.soaNo = soaNo;
        this.versionNumber = versionNumber;
        this.requestId = requestId;
        this.requestFingerprint = requestFingerprint;
        this.captureTime = captureTime;
        this.capturedBy = capturedBy;
        this.capturedByName = capturedByName;
        this.financialRevision = financialRevision;
        this.logoHash = logoHash;
        this.printableData = printableData;
    }

    public String getSoaNo() { return soaNo; }

    public int getVersionNumber() { return versionNumber; }

    public String getRequestId() { return requestId; }

    public String getRequestFingerprint() { return requestFingerprint; }

    public Instant getCaptureTime() { return captureTime; }

    public AppUser getCapturedBy() { return capturedBy; }

    public String getCapturedByName() { return capturedByName; }

    public int getFinancialRevision() { return financialRevision; }

    public String getLogoHash() { return logoHash; }

    public String getPrintableData() { return printableData; }
}
