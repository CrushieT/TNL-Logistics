package com.tnl.logistics.dto;

import com.tnl.logistics.model.WaybillStatus;
import java.time.LocalDateTime;

public record WaybillOptionResponse(
        String waybillId,
        String shipmentId,
        long parcelCount,
        WaybillStatus status,
        String statusLabel,
        LocalDateTime generatedAt) {
}
