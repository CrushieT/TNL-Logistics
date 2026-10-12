package com.tnl.logistics.dto;
import com.tnl.logistics.model.ParcelLossEvent;
import java.time.LocalDateTime;
public record ParcelLossEventResponse(Long eventId, String action, String reason, String actorId,
        LocalDateTime occurredAt, String previousStatus, String previousVehicleId) {
    public static ParcelLossEventResponse from(ParcelLossEvent event) {
        return new ParcelLossEventResponse(event.getEventId(), event.getAction(), event.getReason(),
                event.getActorId(), event.getOccurredAt(), event.getPreviousStatus(), event.getPreviousVehicleId());
    }
}
