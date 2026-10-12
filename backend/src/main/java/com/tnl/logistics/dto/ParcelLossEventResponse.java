package com.tnl.logistics.dto;
import com.tnl.logistics.model.ParcelLossEvent;
import java.time.LocalDateTime;
public record ParcelLossEventResponse(Long eventId, String action, String reason, String actorId,
        String actorName, LocalDateTime occurredAt, String previousStatus, String previousVehicleId) {
    public static ParcelLossEventResponse from(ParcelLossEvent event) {
        return from(event, null, event.getPreviousStatus());
    }

    public static ParcelLossEventResponse from(ParcelLossEvent event, String actorName, String previousStatus) {
        return new ParcelLossEventResponse(event.getEventId(), event.getAction(), event.getReason(),
                event.getActorId(), actorName != null && !actorName.isBlank() ? actorName : event.getActorId(),
                event.getOccurredAt(), previousStatus, event.getPreviousVehicleId());
    }
}
