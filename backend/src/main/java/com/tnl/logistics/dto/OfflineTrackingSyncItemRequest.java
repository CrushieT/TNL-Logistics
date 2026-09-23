package com.tnl.logistics.dto;

import com.tnl.logistics.model.ParcelStatus;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.Instant;

@JsonIgnoreProperties(ignoreUnknown = false)
public record OfflineTrackingSyncItemRequest(
        @NotBlank @Pattern(regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$") String clientEventId,
        @NotBlank @Pattern(regexp = "^TRK-\\d{4}-\\d{6}$") String trackingId,
        @NotNull ParcelStatus targetStatus,
        @Size(max = 20) @Pattern(regexp = "^VH-\\d{3,}$") String vehicleId,
        @NotNull Instant capturedAt,
        @NotNull @Positive Long clientSequence) {

    @AssertTrue(message = "Only operational tracking statuses may be synchronized")
    public boolean hasAllowedTargetStatus() {
        return targetStatus == ParcelStatus.LOADED_ON_TRUCK
                || targetStatus == ParcelStatus.ARRIVED_AT_TNL
                || targetStatus == ParcelStatus.LOADED_TO_HAULER;
    }

    @AssertTrue(message = "LOADED_ON_TRUCK requires a vehicle and other operations must not include one")
    public boolean hasValidVehicleCombination() {
        return targetStatus == ParcelStatus.LOADED_ON_TRUCK
                ? vehicleId != null && !vehicleId.isBlank()
                : vehicleId == null || vehicleId.isBlank();
    }

    @AssertTrue(message = "capturedAt must be between 2000-01-01 and 24 hours from now")
    public boolean hasValidCapturedAt() {
        return capturedAt != null
                && !capturedAt.isBefore(Instant.parse("2000-01-01T00:00:00Z"))
                && !capturedAt.isAfter(Instant.now().plusSeconds(86_400));
    }
}
