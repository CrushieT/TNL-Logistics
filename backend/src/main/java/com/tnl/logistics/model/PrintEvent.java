package com.tnl.logistics.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import org.hibernate.annotations.CreationTimestamp;

/**
 * Entity mapping to the print_event database table.
 * Append-only audit history of label printing and reprinting operations.
 */
@Entity
@Table(name = "print_event")
public class PrintEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "print_id")
    private Long printId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tracking_id", nullable = false)
    private ParcelUnit parcelUnit;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false)
    private PrintKind kind;

    @Column(name = "labels_produced", nullable = false)
    private Integer labelsProduced = 1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id", nullable = false)
    private AppUser staff;

    @Column(name = "printer_id", length = 20)
    private String printerId;

    @CreationTimestamp
    @Column(name = "print_timestamp", nullable = false, updatable = false)
    private LocalDateTime printTimestamp;

    public PrintEvent() {}

    public PrintEvent(ParcelUnit parcelUnit, PrintKind kind, Integer labelsProduced, AppUser staff, String printerId) {
        this.parcelUnit = parcelUnit;
        this.kind = kind;
        this.labelsProduced = labelsProduced != null ? labelsProduced : 1;
        this.staff = staff;
        this.printerId = printerId;
    }

    public Long getPrintId() {
        return printId;
    }

    public void setPrintId(Long printId) {
        this.printId = printId;
    }

    public ParcelUnit getParcelUnit() {
        return parcelUnit;
    }

    public void setParcelUnit(ParcelUnit parcelUnit) {
        this.parcelUnit = parcelUnit;
    }

    public PrintKind getKind() {
        return kind;
    }

    public void setKind(PrintKind kind) {
        this.kind = kind;
    }

    public Integer getLabelsProduced() {
        return labelsProduced;
    }

    public void setLabelsProduced(Integer labelsProduced) {
        this.labelsProduced = labelsProduced;
    }

    public AppUser getStaff() {
        return staff;
    }

    public void setStaff(AppUser staff) {
        this.staff = staff;
    }

    public String getPrinterId() {
        return printerId;
    }

    public void setPrinterId(String printerId) {
        this.printerId = printerId;
    }

    public LocalDateTime getPrintTimestamp() {
        return printTimestamp;
    }

    public void setPrintTimestamp(LocalDateTime printTimestamp) {
        this.printTimestamp = printTimestamp;
    }
}
