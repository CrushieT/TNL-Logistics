package com.tnl.logistics.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "parcel_loss_event")
public class ParcelLossEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "event_id") private Long eventId;
    @Column(name = "tracking_id", length = 30, nullable = false, updatable = false) private String trackingId;
    @Column(nullable = false, updatable = false, length = 10) private String action;
    @Column(nullable = false, updatable = false) private String reason;
    @Column(name = "actor_id", length = 20, nullable = false, updatable = false) private String actorId;
    @Column(name = "occurred_at", nullable = false, updatable = false) private LocalDateTime occurredAt;
    @Column(name = "previous_status", length = 30, nullable = false, updatable = false) private String previousStatus;
    @Column(name = "previous_vehicle_id", length = 20, updatable = false) private String previousVehicleId;
    @Column(name = "request_id", length = 64, nullable = false, updatable = false, unique = true) private String requestId;
    @Column(name = "expected_revision", nullable = false, updatable = false) private long expectedRevision;

    protected ParcelLossEvent() {}
    public ParcelLossEvent(ParcelUnit parcel, String action, String reason, String actorId, String requestId, long expectedRevision) {
        this.trackingId = parcel.getTrackingId();
        this.action = action;
        this.reason = reason;
        this.actorId = actorId;
        this.requestId = requestId;
        this.expectedRevision = expectedRevision;
        this.occurredAt = LocalDateTime.now();
        this.previousStatus = parcel.getCurrentStatus().name();
        this.previousVehicleId = parcel.getCurrentVehicle() == null ? null : parcel.getCurrentVehicle().getVehicleId();
    }
    public Long getEventId() { return eventId; }
    public String getTrackingId() { return trackingId; }
    public String getAction() { return action; }
    public String getReason() { return reason; }
    public String getActorId() { return actorId; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public String getPreviousStatus() { return previousStatus; }
    public String getPreviousVehicleId() { return previousVehicleId; }
    public String getRequestId() { return requestId; }
    public long getExpectedRevision() { return expectedRevision; }
}
