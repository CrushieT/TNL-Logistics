package com.tnl.logistics.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "waybill_reconciliation_event")
public class WaybillReconciliationEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "event_id") private Long eventId;
    @Column(name = "waybill_id", length = 20, nullable = false, updatable = false) private String waybillId;
    @Column(nullable = false, updatable = false, length = 20) private String action;
    @Column(updatable = false, length = 20) private String outcome;
    @Column(name = "custody_state", nullable = false, updatable = false, length = 20) private String custodyState;
    @Column(updatable = false) private String reason;
    @Column(name = "actor_id", length = 20, nullable = false, updatable = false) private String actorId;
    @Column(name = "occurred_at", nullable = false, updatable = false) private LocalDateTime occurredAt;
    @Column(name = "signed_by", length = 150, updatable = false) private String signedBy;
    @Column(name = "signed_at", updatable = false) private LocalDateTime signedAt;
    @Column(name = "request_id", length = 64, updatable = false, unique = true) private String requestId;
    @Column(name = "expected_revision", updatable = false) private Long expectedRevision;
    protected WaybillReconciliationEvent() {}
    public WaybillReconciliationEvent(Waybill waybill, String action, String reason, String actorId, String requestId, Long revision) {
        this.waybillId = waybill.getWaybillId();
        this.action = action;
        this.outcome = waybill.getReconciliationOutcome();
        this.custodyState = waybill.getDispatchedAt() == null ? "GENERATED" : "SENT_TO_HAULER";
        this.reason = reason;
        this.actorId = actorId;
        this.requestId = requestId;
        this.expectedRevision = revision;
        this.occurredAt = LocalDateTime.now();
        this.signedBy = waybill.getSignedBy();
        this.signedAt = waybill.getSignedAt();
    }
    public Long getEventId() { return eventId; }
    public String getWaybillId() { return waybillId; }
    public String getAction() { return action; }
    public String getOutcome() { return outcome; }
    public String getCustodyState() { return custodyState; }
    public String getReason() { return reason; }
    public String getActorId() { return actorId; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public String getSignedBy() { return signedBy; }
    public LocalDateTime getSignedAt() { return signedAt; }
    public String getRequestId() { return requestId; }
    public Long getExpectedRevision() { return expectedRevision; }
}
