package com.tnl.logistics.dto;

import com.tnl.logistics.model.PaymentMethod;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Response payload for an individual payment transaction.
 */
public class PaymentResponse {

    private Long paymentId;
    private String shipmentId;
    private String clientId;
    private String clientName;
    private String recipientName;
    private BigDecimal amountPaid;
    private PaymentMethod method;
    private String referenceNo;
    private LocalDate paymentDate;
    private String paymentDateFormatted;
    private String recordedByStaff;
    private String remarks;
    private LocalDateTime recordedAt;

    // Running totals of the associated shipment
    private BigDecimal shipmentTotalAmount;
    private BigDecimal shipmentTotalPaid;
    private BigDecimal shipmentBalance;
    private String shipmentPaymentStatus;

    public PaymentResponse() {}

    public PaymentResponse(Long paymentId, String shipmentId, String clientId, String clientName,
                           String recipientName, BigDecimal amountPaid, PaymentMethod method,
                           String referenceNo, LocalDate paymentDate, String paymentDateFormatted,
                           String recordedByStaff, String remarks, LocalDateTime recordedAt,
                           BigDecimal shipmentTotalAmount, BigDecimal shipmentTotalPaid,
                           BigDecimal shipmentBalance, String shipmentPaymentStatus) {
        this.paymentId = paymentId;
        this.shipmentId = shipmentId;
        this.clientId = clientId;
        this.clientName = clientName;
        this.recipientName = recipientName;
        this.amountPaid = amountPaid;
        this.method = method;
        this.referenceNo = referenceNo;
        this.paymentDate = paymentDate;
        this.paymentDateFormatted = paymentDateFormatted;
        this.recordedByStaff = recordedByStaff;
        this.remarks = remarks;
        this.recordedAt = recordedAt;
        this.shipmentTotalAmount = shipmentTotalAmount;
        this.shipmentTotalPaid = shipmentTotalPaid;
        this.shipmentBalance = shipmentBalance;
        this.shipmentPaymentStatus = shipmentPaymentStatus;
    }

    public Long getPaymentId() { return paymentId; }
    public void setPaymentId(Long paymentId) { this.paymentId = paymentId; }

    public String getShipmentId() { return shipmentId; }
    public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }

    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }

    public BigDecimal getAmountPaid() { return amountPaid; }
    public void setAmountPaid(BigDecimal amountPaid) { this.amountPaid = amountPaid; }

    public PaymentMethod getMethod() { return method; }
    public void setMethod(PaymentMethod method) { this.method = method; }

    public String getReferenceNo() { return referenceNo; }
    public void setReferenceNo(String referenceNo) { this.referenceNo = referenceNo; }

    public LocalDate getPaymentDate() { return paymentDate; }
    public void setPaymentDate(LocalDate paymentDate) { this.paymentDate = paymentDate; }

    public String getPaymentDateFormatted() { return paymentDateFormatted; }
    public void setPaymentDateFormatted(String paymentDateFormatted) { this.paymentDateFormatted = paymentDateFormatted; }

    public String getRecordedByStaff() { return recordedByStaff; }
    public void setRecordedByStaff(String recordedByStaff) { this.recordedByStaff = recordedByStaff; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public LocalDateTime getRecordedAt() { return recordedAt; }
    public void setRecordedAt(LocalDateTime recordedAt) { this.recordedAt = recordedAt; }

    public BigDecimal getShipmentTotalAmount() { return shipmentTotalAmount; }
    public void setShipmentTotalAmount(BigDecimal shipmentTotalAmount) { this.shipmentTotalAmount = shipmentTotalAmount; }

    public BigDecimal getShipmentTotalPaid() { return shipmentTotalPaid; }
    public void setShipmentTotalPaid(BigDecimal shipmentTotalPaid) { this.shipmentTotalPaid = shipmentTotalPaid; }

    public BigDecimal getShipmentBalance() { return shipmentBalance; }
    public void setShipmentBalance(BigDecimal shipmentBalance) { this.shipmentBalance = shipmentBalance; }

    public String getShipmentPaymentStatus() { return shipmentPaymentStatus; }
    public void setShipmentPaymentStatus(String shipmentPaymentStatus) { this.shipmentPaymentStatus = shipmentPaymentStatus; }
}
