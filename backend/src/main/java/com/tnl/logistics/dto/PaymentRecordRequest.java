package com.tnl.logistics.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.tnl.logistics.model.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Request payload for recording a payment against a shipment.
 */
public class PaymentRecordRequest {

    @NotBlank(message = "Shipment ID is required")
    private String shipmentId;

    @JsonProperty("amountPaid")
    @JsonAlias({"amount", "amount_paid"})
    @NotNull(message = "Amount paid is required")
    @DecimalMin(value = "0.01", message = "Amount paid must be greater than zero")
    private BigDecimal amountPaid;

    @NotNull(message = "Payment method is required")
    private PaymentMethod method;

    @JsonProperty("referenceNo")
    @JsonAlias({"referenceNumber", "reference_no", "reference_number"})
    private String referenceNo;

    private LocalDate paymentDate;

    private String remarks;

    public PaymentRecordRequest() {}

    public PaymentRecordRequest(String shipmentId, BigDecimal amountPaid, PaymentMethod method, String referenceNo, LocalDate paymentDate, String remarks) {
        this.shipmentId = shipmentId;
        this.amountPaid = amountPaid;
        this.method = method;
        this.referenceNo = referenceNo;
        this.paymentDate = paymentDate;
        this.remarks = remarks;
    }

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

    public BigDecimal getAmountPaid() { return amountPaid; }
    public void setAmountPaid(BigDecimal amountPaid) { this.amountPaid = amountPaid; }

    public PaymentMethod getMethod() { return method; }
    public void setMethod(PaymentMethod method) { this.method = method; }

    public String getReferenceNo() { return referenceNo; }
    public void setReferenceNo(String referenceNo) { this.referenceNo = referenceNo; }

    public LocalDate getPaymentDate() { return paymentDate; }
    public void setPaymentDate(LocalDate paymentDate) { this.paymentDate = paymentDate; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
}
