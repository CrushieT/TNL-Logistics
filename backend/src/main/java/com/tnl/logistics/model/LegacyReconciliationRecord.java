package com.tnl.logistics.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Objects;
import org.hibernate.annotations.CreationTimestamp;

/**
 * Entity mapping to the legacy_reconciliation_record table.
 * Preserves lossless raw legacy data for operator inspection without inventing required operational fields.
 */
@Entity
@Table(name = "legacy_reconciliation_record", indexes = {
        @Index(name = "idx_reconciliation_source", columnList = "source_table, source_id"),
        @Index(name = "idx_reconciliation_status", columnList = "status")
})
public class LegacyReconciliationRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "record_id")
    private Long recordId;

    @Column(name = "source_table", length = 50, nullable = false)
    private String sourceTable;

    @Column(name = "source_id", length = 50, nullable = false)
    private String sourceId;

    @Column(name = "legacy_data_json", columnDefinition = "TEXT", nullable = false)
    private String legacyDataJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ReconciliationStatus status = ReconciliationStatus.PENDING_REVIEW;

    @Column(name = "reconciliation_notes", length = 500)
    private String reconciliationNotes;

    @Column(name = "reviewed_by", length = 50)
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public LegacyReconciliationRecord() {}

    public LegacyReconciliationRecord(String sourceTable, String sourceId, String legacyDataJson,
                                      ReconciliationStatus status, String reconciliationNotes) {
        this.sourceTable = sourceTable;
        this.sourceId = sourceId;
        this.legacyDataJson = legacyDataJson;
        this.status = status != null ? status : ReconciliationStatus.PENDING_REVIEW;
        this.reconciliationNotes = reconciliationNotes;
    }

    public Long getRecordId() { return recordId; }
    public void setRecordId(Long recordId) { this.recordId = recordId; }

    public String getSourceTable() { return sourceTable; }
    public void setSourceTable(String sourceTable) { this.sourceTable = sourceTable; }

    public String getSourceId() { return sourceId; }
    public void setSourceId(String sourceId) { this.sourceId = sourceId; }

    public String getLegacyDataJson() { return legacyDataJson; }
    public void setLegacyDataJson(String legacyDataJson) { this.legacyDataJson = legacyDataJson; }

    public ReconciliationStatus getStatus() { return status; }
    public void setStatus(ReconciliationStatus status) { this.status = status; }

    public String getReconciliationNotes() { return reconciliationNotes; }
    public void setReconciliationNotes(String reconciliationNotes) { this.reconciliationNotes = reconciliationNotes; }

    public String getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(String reviewedBy) { this.reviewedBy = reviewedBy; }

    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        LegacyReconciliationRecord that = (LegacyReconciliationRecord) o;
        return Objects.equals(recordId, that.recordId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(recordId);
    }
}
