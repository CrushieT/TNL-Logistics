package com.tnl.logistics.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Request payload for capturing a new immutable version of a Statement of Account (V2+).
 */
public class SaveStatementVersionRequest {

    @NotBlank(message = "Client ID is required")
    @Size(max = 20, message = "Client ID must not exceed 20 characters")
    private String clientId;

    @NotNull(message = "Target date is required")
    private LocalDate targetDate;

    @DecimalMin(value = "0.0", inclusive = true, message = "Deduction amount must be zero or positive")
    @Digits(integer = 10, fraction = 2, message = "Deduction amount must have at most 2 decimal places")
    private BigDecimal deductionAmount = BigDecimal.ZERO;

    @Size(max = 255, message = "Deduction note must not exceed 255 characters")
    private String deductionNote;

    @Size(max = 150, message = "Collected by must not exceed 150 characters")
    private String collectedBy;

    @NotNull(message = "Expected financial revision is required for version capture")
    @jakarta.validation.constraints.Positive
    private Integer expectedFinancialRevision;

    @NotBlank(message = "Request ID is required for idempotency")
    @Size(max = 64, message = "Request ID must not exceed 64 characters")
    private String requestId;

    public SaveStatementVersionRequest() {}

    public SaveStatementVersionRequest(String clientId, LocalDate targetDate, BigDecimal deductionAmount,
                                       String deductionNote, String collectedBy, Integer expectedFinancialRevision,
                                       String requestId) {
        this.clientId = clientId;
        this.targetDate = targetDate;
        this.deductionAmount = deductionAmount;
        this.deductionNote = deductionNote;
        this.collectedBy = collectedBy;
        this.expectedFinancialRevision = expectedFinancialRevision;
        this.requestId = requestId;
    }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public LocalDate getTargetDate() { return targetDate; }
    public void setTargetDate(LocalDate targetDate) { this.targetDate = targetDate; }

    public BigDecimal getDeductionAmount() { return deductionAmount; }
    public void setDeductionAmount(BigDecimal deductionAmount) { this.deductionAmount = deductionAmount; }

    public String getDeductionNote() { return deductionNote; }
    public void setDeductionNote(String deductionNote) { this.deductionNote = deductionNote; }

    public String getCollectedBy() { return collectedBy; }
    public void setCollectedBy(String collectedBy) { this.collectedBy = collectedBy; }

    public Integer getExpectedFinancialRevision() { return expectedFinancialRevision; }
    public void setExpectedFinancialRevision(Integer expectedFinancialRevision) { this.expectedFinancialRevision = expectedFinancialRevision; }

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
}
