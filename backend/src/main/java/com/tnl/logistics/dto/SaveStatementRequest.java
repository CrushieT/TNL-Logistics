package com.tnl.logistics.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Request payload for persisting deduction notes, amounts, and collector metadata on an SOA.
 */
public class SaveStatementRequest {

    private String clientId;
    private LocalDate targetDate;
    private BigDecimal deductionAmount;
    private String deductionNote;
    private String collectedBy;

    public SaveStatementRequest() {}

    public SaveStatementRequest(String clientId, LocalDate targetDate, BigDecimal deductionAmount,
                                String deductionNote, String collectedBy) {
        this.clientId = clientId;
        this.targetDate = targetDate;
        this.deductionAmount = deductionAmount;
        this.deductionNote = deductionNote;
        this.collectedBy = collectedBy;
    }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public LocalDate getTargetDate() { return targetDate; }
    public void setTargetDate(LocalDate targetDate) { this.targetDate = targetDate; }

    public LocalDate getCycleThursday() { return targetDate; }
    public void setCycleThursday(LocalDate cycleThursday) {
        if (this.targetDate == null) {
            this.targetDate = cycleThursday;
        }
    }

    public BigDecimal getDeductionAmount() { return deductionAmount; }
    public void setDeductionAmount(BigDecimal deductionAmount) { this.deductionAmount = deductionAmount; }

    public String getDeductionNote() { return deductionNote; }
    public void setDeductionNote(String deductionNote) { this.deductionNote = deductionNote; }

    public String getCollectedBy() { return collectedBy; }
    public void setCollectedBy(String collectedBy) { this.collectedBy = collectedBy; }
}
