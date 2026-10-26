package com.tnl.logistics.dto;

import jakarta.validation.constraints.*;

public record ParcelExceptionRequest(
        @NotBlank @Size(max = 255) String reason,
        @NotNull @PositiveOrZero Long expectedRevision,
        @NotBlank @Pattern(regexp = "[A-Za-z0-9-]{1,64}") String requestId) {
    public ParcelExceptionRequest {
        reason = reason == null ? null : reason.trim();
    }
}
