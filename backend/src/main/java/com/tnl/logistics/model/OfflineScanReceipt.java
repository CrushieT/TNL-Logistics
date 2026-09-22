package com.tnl.logistics.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "offline_scan_receipt")
public class OfflineScanReceipt {
    @Id
    @Column(name = "client_event_id", length = 36)
    private String clientEventId;
    @Column(name = "owner_user_id", nullable = false, length = 20)
    private String ownerUserId;
    @Column(name = "request_fingerprint", nullable = false, length = 64)
    private String requestFingerprint;
    @Column(name = "requested_tracking_id", nullable = false, length = 30)
    private String requestedTrackingId;
    @Column(name = "target_status", nullable = false, length = 32)
    private String targetStatus;
    @Column(name = "vehicle_id", length = 20)
    private String vehicleId;
    @Column(name = "client_captured_at", nullable = false)
    private LocalDateTime clientCapturedAt;
    @Column(name = "client_sequence", nullable = false)
    private Long clientSequence;
    @Column(name = "outcome", nullable = false, length = 32)
    private String outcome;
    @Column(name = "outcome_code", nullable = false, length = 64)
    private String outcomeCode;
    @Column(name = "tracking_event_id")
    private Long trackingEventId;
    @Column(name = "server_status", length = 32)
    private String serverStatus;
    @Column(name = "server_vehicle_id", length = 20)
    private String serverVehicleId;
    @Column(name = "processed_at", nullable = false)
    private LocalDateTime processedAt;

    public OfflineScanReceipt() { }

    public OfflineScanReceipt(String clientEventId, String ownerUserId, String requestFingerprint,
                              String requestedTrackingId, String targetStatus, String vehicleId,
                              LocalDateTime clientCapturedAt, Long clientSequence, LocalDateTime processedAt) {
        this.clientEventId = clientEventId;
        this.ownerUserId = ownerUserId;
        this.requestFingerprint = requestFingerprint;
        this.requestedTrackingId = requestedTrackingId;
        this.targetStatus = targetStatus;
        this.vehicleId = vehicleId;
        this.clientCapturedAt = clientCapturedAt;
        this.clientSequence = clientSequence;
        this.processedAt = processedAt;
        this.outcome = "RETRYABLE_ERROR";
        this.outcomeCode = "TEMPORARY_FAILURE";
    }

    public String getClientEventId() { return clientEventId; }
    public String getOwnerUserId() { return ownerUserId; }
    public String getRequestFingerprint() { return requestFingerprint; }
    public String getRequestedTrackingId() { return requestedTrackingId; }
    public String getTargetStatus() { return targetStatus; }
    public String getVehicleId() { return vehicleId; }
    public LocalDateTime getClientCapturedAt() { return clientCapturedAt; }
    public Long getClientSequence() { return clientSequence; }
    public String getOutcome() { return outcome; }
    public void setOutcome(String outcome) { this.outcome = outcome; }
    public String getOutcomeCode() { return outcomeCode; }
    public void setOutcomeCode(String outcomeCode) { this.outcomeCode = outcomeCode; }
    public Long getTrackingEventId() { return trackingEventId; }
    public void setTrackingEventId(Long trackingEventId) { this.trackingEventId = trackingEventId; }
    public String getServerStatus() { return serverStatus; }
    public void setServerStatus(String serverStatus) { this.serverStatus = serverStatus; }
    public String getServerVehicleId() { return serverVehicleId; }
    public void setServerVehicleId(String serverVehicleId) { this.serverVehicleId = serverVehicleId; }
    public LocalDateTime getProcessedAt() { return processedAt; }
}
