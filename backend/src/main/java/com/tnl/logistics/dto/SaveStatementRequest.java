package com.tnl.logistics.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Request payload for persisting deduction notes, amounts, and collector metadata on an SOA.
 */
public class SaveStatementRequest {

    @NotBlank(message = "Client ID is required")
    private String clientId;

    @NotNull(message = "Target date is required")
    private LocalDate targetDate;

    @PositiveOrZero(message = "Deduction amount must be zero or positive")
    @Digits(integer = 10, fraction = 2, message = "Deduction amount must have at most 2 decimal places")
    private BigDecimal deductionAmount;

    @Size(max = 255, message = "Deduction note must not exceed 255 characters")
    private String deductionNote;

    @Size(max = 150, message = "Collected by must not exceed 150 characters")
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
