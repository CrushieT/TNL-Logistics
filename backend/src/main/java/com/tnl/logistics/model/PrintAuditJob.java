package com.tnl.logistics.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "print_audit_job")
public class PrintAuditJob {

    @Id
    @Column(name = "print_job_id", length = 36, columnDefinition = "CHAR(36)")
    private String printJobId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shipment_id", nullable = false)
    private Shipment shipment;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "staff_id", nullable = false)
    private AppUser staff;

    @Column(name = "printer_id", length = 20)
    private String printerId;

    @Column(name = "request_fingerprint", length = 64, nullable = false)
    private String requestFingerprint;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public PrintAuditJob() {}

    public PrintAuditJob(String printJobId, Shipment shipment, AppUser staff, String printerId, String requestFingerprint) {
        this.printJobId = printJobId;
        this.shipment = shipment;
        this.staff = staff;
        this.printerId = printerId;
        this.requestFingerprint = requestFingerprint;
    }

    public String getPrintJobId() { return printJobId; }
    public Shipment getShipment() { return shipment; }
    public AppUser getStaff() { return staff; }
    public String getPrinterId() { return printerId; }
    public String getRequestFingerprint() { return requestFingerprint; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
