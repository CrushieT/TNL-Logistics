package com.tnl.logistics.dto;

import com.tnl.logistics.model.WaybillStatus;
import java.time.LocalDateTime;

public class WaybillStatusUpdateRequest {

    private WaybillStatus status;
    private String signedBy;
    private LocalDateTime signedAt;
    private String remarks;

    public WaybillStatusUpdateRequest() {}

    public WaybillStatusUpdateRequest(WaybillStatus status, String signedBy, LocalDateTime signedAt, String remarks) {
        this.status = status;
        this.signedBy = signedBy;
        this.signedAt = signedAt;
        this.remarks = remarks;
    }

    public WaybillStatus getStatus() { return status; }
    public void setStatus(WaybillStatus status) { this.status = status; }

    public String getSignedBy() { return signedBy; }
    public void setSignedBy(String signedBy) { this.signedBy = signedBy; }

    public LocalDateTime getSignedAt() { return signedAt; }
    public void setSignedAt(LocalDateTime signedAt) { this.signedAt = signedAt; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
}
