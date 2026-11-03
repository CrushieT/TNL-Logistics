package com.tnl.logistics.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Request payload to ensure Version 1 snapshot exists before opening print view for a closed cycle.
 */
public class EnsureV1Request {

    @NotBlank(message = "Client ID is required")
    @Size(max = 20, message = "Client ID must not exceed 20 characters")
    private String clientId;

    @NotNull(message = "Target date is required")
    private LocalDate targetDate;

    @NotBlank(message = "Request ID is required for idempotency")
    @Size(max = 64, message = "Request ID must not exceed 64 characters")
    private String requestId;

    public EnsureV1Request() {}

    public EnsureV1Request(String clientId, LocalDate targetDate, String requestId) {
        this.clientId = clientId;
        this.targetDate = targetDate;
        this.requestId = requestId;
    }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public LocalDate getTargetDate() { return targetDate; }
    public void setTargetDate(LocalDate targetDate) { this.targetDate = targetDate; }

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
}
