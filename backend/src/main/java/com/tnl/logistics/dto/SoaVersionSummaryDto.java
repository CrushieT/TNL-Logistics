package com.tnl.logistics.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Summary DTO for listing immutable versions of an SOA.
 */
public class SoaVersionSummaryDto {

    private String soaNo;
    private int versionNumber;
    private Instant captureTime;
    private String captureTimeFormatted;
    private String capturedByName;
    private BigDecimal amountDue;
    private BigDecimal totalPaid;
    private BigDecimal deductionAmount;
    private String status;
    private int financialRevision;

    public SoaVersionSummaryDto() {}

    public SoaVersionSummaryDto(String soaNo, int versionNumber, Instant captureTime,
                                String captureTimeFormatted, String capturedByName,
                                BigDecimal amountDue, BigDecimal totalPaid,
                                BigDecimal deductionAmount, String status, int financialRevision) {
        this.soaNo = soaNo;
        this.versionNumber = versionNumber;
        this.captureTime = captureTime;
        this.captureTimeFormatted = captureTimeFormatted;
        this.capturedByName = capturedByName;
        this.amountDue = amountDue;
        this.totalPaid = totalPaid;
        this.deductionAmount = deductionAmount;
        this.status = status;
        this.financialRevision = financialRevision;
    }

    public String getSoaNo() { return soaNo; }
    public void setSoaNo(String soaNo) { this.soaNo = soaNo; }

    public int getVersionNumber() { return versionNumber; }
    public void setVersionNumber(int versionNumber) { this.versionNumber = versionNumber; }

    public Instant getCaptureTime() { return captureTime; }
    public void setCaptureTime(Instant captureTime) { this.captureTime = captureTime; }

    public String getCaptureTimeFormatted() { return captureTimeFormatted; }
    public void setCaptureTimeFormatted(String captureTimeFormatted) { this.captureTimeFormatted = captureTimeFormatted; }

    public String getCapturedByName() { return capturedByName; }
    public void setCapturedByName(String capturedByName) { this.capturedByName = capturedByName; }

    public BigDecimal getAmountDue() { return amountDue; }
    public void setAmountDue(BigDecimal amountDue) { this.amountDue = amountDue; }

    public BigDecimal getTotalPaid() { return totalPaid; }
    public void setTotalPaid(BigDecimal totalPaid) { this.totalPaid = totalPaid; }

    public BigDecimal getDeductionAmount() { return deductionAmount; }
    public void setDeductionAmount(BigDecimal deductionAmount) { this.deductionAmount = deductionAmount; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getFinancialRevision() { return financialRevision; }
    public void setFinancialRevision(int financialRevision) { this.financialRevision = financialRevision; }
}
