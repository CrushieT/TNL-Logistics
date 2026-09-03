package com.tnl.logistics.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "soa")
public class Soa {

    @Id
    @Column(name = "soa_no", length = 30)
    private String soaNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private SoaBatch batch;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collection_id", nullable = false)
    private WeeklyCollection collection;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @Column(name = "previous_balance", precision = 12, scale = 2, nullable = false)
    private BigDecimal previousBalance = BigDecimal.ZERO;

    @Column(name = "current_charges", precision = 12, scale = 2, nullable = false)
    private BigDecimal currentCharges;

    @Column(name = "deductions", precision = 12, scale = 2, nullable = false)
    private BigDecimal deductions = BigDecimal.ZERO;

    @Column(name = "deduction_reason", length = 255)
    private String deductionReason;

    @Column(name = "total_paid", precision = 12, scale = 2, nullable = false)
    private BigDecimal totalPaid = BigDecimal.ZERO;

    @Column(name = "outstanding_balance", precision = 12, scale = 2, nullable = false)
    private BigDecimal outstandingBalance;

    @Column(name = "collected_by", length = 150)
    private String collectedBy;

    @Column(name = "statement_date", nullable = false)
    private LocalDate statementDate;

    @Column(name = "pdf_path", length = 255)
    private String pdfPath;

    public Soa() {}

    public Soa(String soaNo, SoaBatch batch, WeeklyCollection collection, Client client,
               BigDecimal previousBalance, BigDecimal currentCharges, BigDecimal deductions,
               String deductionReason, BigDecimal totalPaid, BigDecimal outstandingBalance,
               String collectedBy, LocalDate statementDate, String pdfPath) {
        this.soaNo = soaNo;
        this.batch = batch;
        this.collection = collection;
        this.client = client;
        this.previousBalance = previousBalance != null ? previousBalance : BigDecimal.ZERO;
        this.currentCharges = currentCharges;
        this.deductions = deductions != null ? deductions : BigDecimal.ZERO;
        this.deductionReason = deductionReason;
        this.totalPaid = totalPaid != null ? totalPaid : BigDecimal.ZERO;
        this.outstandingBalance = outstandingBalance;
        this.collectedBy = collectedBy;
        this.statementDate = statementDate;
        this.pdfPath = pdfPath;
    }

    public String getSoaNo() { return soaNo; }
    public void setSoaNo(String soaNo) { this.soaNo = soaNo; }

    public SoaBatch getBatch() { return batch; }
    public void setBatch(SoaBatch batch) { this.batch = batch; }

    public WeeklyCollection getCollection() { return collection; }
    public void setCollection(WeeklyCollection collection) { this.collection = collection; }

    public Client getClient() { return client; }
    public void setClient(Client client) { this.client = client; }

    public BigDecimal getPreviousBalance() { return previousBalance; }
    public void setPreviousBalance(BigDecimal previousBalance) { this.previousBalance = previousBalance; }

    public BigDecimal getCurrentCharges() { return currentCharges; }
    public void setCurrentCharges(BigDecimal currentCharges) { this.currentCharges = currentCharges; }

    public BigDecimal getDeductions() { return deductions; }
    public void setDeductions(BigDecimal deductions) { this.deductions = deductions; }

    public String getDeductionReason() { return deductionReason; }
    public void setDeductionReason(String deductionReason) { this.deductionReason = deductionReason; }

    public BigDecimal getTotalPaid() { return totalPaid; }
    public void setTotalPaid(BigDecimal totalPaid) { this.totalPaid = totalPaid; }

    public BigDecimal getOutstandingBalance() { return outstandingBalance; }
    public void setOutstandingBalance(BigDecimal outstandingBalance) { this.outstandingBalance = outstandingBalance; }

    public String getCollectedBy() { return collectedBy; }
    public void setCollectedBy(String collectedBy) { this.collectedBy = collectedBy; }

    public LocalDate getStatementDate() { return statementDate; }
    public void setStatementDate(LocalDate statementDate) { this.statementDate = statementDate; }

    public String getPdfPath() { return pdfPath; }
    public void setPdfPath(String pdfPath) { this.pdfPath = pdfPath; }
}
