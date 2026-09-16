package com.tnl.logistics.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Top-level response for previewing and rendering an A4 Statement of Account.
 */
public class StatementPreviewResponse {

    private String clientId;
    private String clientName;
    private String clientAddress;
    private String clientContact;
    private String clientEmail;

    private LocalDate cycleThursday;
    private String cycleRangeLabel;
    private Integer weekNumber;
    private Integer shipmentsCount;

    private String soaNo;
    private LocalDate statementDate;
    private LocalDate collectionDate;

    private BigDecimal deductionAmount;
    private String deductionNote;
    private String collectedBy;
    private Boolean isSaved;

    private BigDecimal totalCharges;
    private BigDecimal totalPaid;
    private BigDecimal amountDue;

    private List<StatementShipmentItem> items = new ArrayList<>();

    public StatementPreviewResponse() {}

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }

    public String getClientAddress() { return clientAddress; }
    public void setClientAddress(String clientAddress) { this.clientAddress = clientAddress; }

    public String getClientContact() { return clientContact; }
    public void setClientContact(String clientContact) { this.clientContact = clientContact; }

    public String getClientEmail() { return clientEmail; }
    public void setClientEmail(String clientEmail) { this.clientEmail = clientEmail; }

    public LocalDate getCycleThursday() { return cycleThursday; }
    public void setCycleThursday(LocalDate cycleThursday) { this.cycleThursday = cycleThursday; }

    public String getCycleRangeLabel() { return cycleRangeLabel; }
    public void setCycleRangeLabel(String cycleRangeLabel) { this.cycleRangeLabel = cycleRangeLabel; }

    public Integer getWeekNumber() { return weekNumber; }
    public void setWeekNumber(Integer weekNumber) { this.weekNumber = weekNumber; }

    public Integer getShipmentsCount() { return shipmentsCount; }
    public void setShipmentsCount(Integer shipmentsCount) { this.shipmentsCount = shipmentsCount; }

    public String getSoaNo() { return soaNo; }
    public void setSoaNo(String soaNo) { this.soaNo = soaNo; }

    public LocalDate getStatementDate() { return statementDate; }
    public void setStatementDate(LocalDate statementDate) { this.statementDate = statementDate; }

    public LocalDate getCollectionDate() { return collectionDate; }
    public void setCollectionDate(LocalDate collectionDate) { this.collectionDate = collectionDate; }

    public BigDecimal getDeductionAmount() { return deductionAmount; }
    public void setDeductionAmount(BigDecimal deductionAmount) { this.deductionAmount = deductionAmount; }

    public String getDeductionNote() { return deductionNote; }
    public void setDeductionNote(String deductionNote) { this.deductionNote = deductionNote; }

    public String getCollectedBy() { return collectedBy; }
    public void setCollectedBy(String collectedBy) { this.collectedBy = collectedBy; }

    public Boolean getIsSaved() { return isSaved; }
    public void setIsSaved(Boolean isSaved) { this.isSaved = isSaved; }

    public BigDecimal getTotalCharges() { return totalCharges; }
    public void setTotalCharges(BigDecimal totalCharges) { this.totalCharges = totalCharges; }

    public BigDecimal getTotalPaid() { return totalPaid; }
    public void setTotalPaid(BigDecimal totalPaid) { this.totalPaid = totalPaid; }

    public BigDecimal getAmountDue() { return amountDue; }
    public void setAmountDue(BigDecimal amountDue) { this.amountDue = amountDue; }

    public List<StatementShipmentItem> getItems() { return items; }
    public void setItems(List<StatementShipmentItem> items) { this.items = items; }
}
