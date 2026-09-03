package com.tnl.logistics.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "soa_batch")
public class SoaBatch {

    @Id
    @Column(name = "batch_id", length = 30)
    private String batchId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collection_id", nullable = false)
    private WeeklyCollection collection;

    @Column(name = "scope", nullable = false)
    private String scope = "ALL";

    @Column(name = "soa_count", nullable = false)
    private Integer soaCount = 1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "generated_by", nullable = false)
    private AppUser generatedBy;

    @CreationTimestamp
    @Column(name = "generated_at", nullable = false, updatable = false)
    private LocalDateTime generatedAt;

    public SoaBatch() {}

    public SoaBatch(String batchId, WeeklyCollection collection, String scope, Integer soaCount, AppUser generatedBy) {
        this.batchId = batchId;
        this.collection = collection;
        this.scope = scope != null ? scope : "ALL";
        this.soaCount = soaCount != null ? soaCount : 1;
        this.generatedBy = generatedBy;
    }

    public String getBatchId() { return batchId; }
    public void setBatchId(String batchId) { this.batchId = batchId; }

    public WeeklyCollection getCollection() { return collection; }
    public void setCollection(WeeklyCollection collection) { this.collection = collection; }

    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }

    public Integer getSoaCount() { return soaCount; }
    public void setSoaCount(Integer soaCount) { this.soaCount = soaCount; }

    public AppUser getGeneratedBy() { return generatedBy; }
    public void setGeneratedBy(AppUser generatedBy) { this.generatedBy = generatedBy; }

    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
}
