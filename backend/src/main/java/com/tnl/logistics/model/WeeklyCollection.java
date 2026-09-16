package com.tnl.logistics.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "weekly_collection")
public class WeeklyCollection {

    @Id
    @Column(name = "collection_id", length = 30)
    private String collectionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @Column(name = "week_of", nullable = false)
    private LocalDate weekOf;

    @Column(name = "collection_date", nullable = false)
    private LocalDate collectionDate;

    @Column(name = "total_due", precision = 12, scale = 2, nullable = false)
    private BigDecimal totalDue;

    @Column(name = "total_paid", precision = 12, scale = 2, nullable = false)
    private BigDecimal totalPaid = BigDecimal.ZERO;

    @Column(name = "balance", precision = 12, scale = 2, nullable = false)
    private BigDecimal balance;

    @Column(name = "status", nullable = false)
    private String status = "FOR_COLLECTION";

    public WeeklyCollection() {}

    public WeeklyCollection(String collectionId, Client client, LocalDate weekOf, LocalDate collectionDate,
                            BigDecimal totalDue, BigDecimal totalPaid, BigDecimal balance, String status) {
        this.collectionId = collectionId;
        this.client = client;
        this.weekOf = weekOf;
        this.collectionDate = collectionDate;
        this.totalDue = totalDue;
        this.totalPaid = totalPaid != null ? totalPaid : BigDecimal.ZERO;
        this.balance = balance;
        this.status = status != null ? status : "FOR_COLLECTION";
    }

    public String getCollectionId() { return collectionId; }
    public void setCollectionId(String collectionId) { this.collectionId = collectionId; }

    public Client getClient() { return client; }
    public void setClient(Client client) { this.client = client; }

    public LocalDate getWeekOf() { return weekOf; }
    public void setWeekOf(LocalDate weekOf) { this.weekOf = weekOf; }

    public LocalDate getCollectionDate() { return collectionDate; }
    public void setCollectionDate(LocalDate collectionDate) { this.collectionDate = collectionDate; }

    public BigDecimal getTotalDue() { return totalDue; }
    public void setTotalDue(BigDecimal totalDue) { this.totalDue = totalDue; }

    public BigDecimal getTotalPaid() { return totalPaid; }
    public void setTotalPaid(BigDecimal totalPaid) { this.totalPaid = totalPaid; }

    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) { this.balance = balance; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
