package com.tnl.logistics.dto;
import com.tnl.logistics.model.WaybillReconciliationEvent;
import java.time.LocalDateTime;
public record WaybillReconciliationResponse(Long eventId, String action, String outcome, String custodyState, String reason,
        String actorId, LocalDateTime occurredAt, String signedBy, LocalDateTime signedAt) {
    public static WaybillReconciliationResponse from(WaybillReconciliationEvent event) {
        return new WaybillReconciliationResponse(event.getEventId(), event.getAction(), event.getOutcome(), event.getCustodyState(),
                event.getReason(), event.getActorId(), event.getOccurredAt(), event.getSignedBy(), event.getSignedAt());
    }
}
