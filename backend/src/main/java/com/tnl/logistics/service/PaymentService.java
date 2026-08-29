package com.tnl.logistics.service;

import com.tnl.logistics.dto.PaymentRecordRequest;
import com.tnl.logistics.dto.PaymentResponse;
import com.tnl.logistics.dto.ShipmentPaymentSummaryResponse;
import com.tnl.logistics.model.PaymentMethod;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;

/**
 * Service interface for recording payments, balance calculation, and financial directories.
 */
public interface PaymentService {

    /**
     * Record a new payment against a shipment.
     */
    PaymentResponse recordPayment(PaymentRecordRequest request, String actingStaffUsername);

    /**
     * Retrieve payment history and financial balance for a specific shipment.
     */
    ShipmentPaymentSummaryResponse getPaymentsByShipmentId(String shipmentId);

    /**
     * Paginated search for payments across the company.
     */
    Page<PaymentResponse> getPayments(String search, PaymentMethod method, String clientId,
                                      LocalDate startDate, LocalDate endDate, Pageable pageable);
}
