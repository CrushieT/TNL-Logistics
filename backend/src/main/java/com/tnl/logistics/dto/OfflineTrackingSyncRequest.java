package com.tnl.logistics.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = false)
public record OfflineTrackingSyncRequest(
        @NotEmpty @Size(max = 100) List<@Valid OfflineTrackingSyncItemRequest> items) {
}
