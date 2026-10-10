package com.tnl.logistics.dto;

import com.tnl.logistics.model.WaybillStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

public class WaybillStatusUpdateRequest {

    @NotBlank(message = "Waybill completion is not permitted.")
    @Size(max = 20, message = "Waybill completion is not permitted.")
    private String confirmedWaybillId;

    @Size(max = 150, message = "Signed by must not exceed 150 characters.")
    private String signedBy;

    @Size(max = 255, message = "Remarks must not exceed 255 characters.")
    private String remarks;

    public WaybillStatusUpdateRequest() {}

    public WaybillStatusUpdateRequest(WaybillStatus status, String signedBy, LocalDateTime signedAt, String remarks) {
        this.signedBy = signedBy;
        this.remarks = remarks;
    }

    public String getConfirmedWaybillId() { return confirmedWaybillId; }
    public void setConfirmedWaybillId(String confirmedWaybillId) { this.confirmedWaybillId = confirmedWaybillId; }

    public String getSignedBy() { return signedBy; }
    public void setSignedBy(String signedBy) { this.signedBy = signedBy; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
}
