package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.PaymentRecordRequest;
import com.tnl.logistics.dto.PaymentResponse;
import com.tnl.logistics.dto.ShipmentPaymentSummaryResponse;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.Payment;
import com.tnl.logistics.model.PaymentMethod;
import com.tnl.logistics.model.Shipment;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.PaymentRepository;
import com.tnl.logistics.repository.ShipmentRepository;
import com.tnl.logistics.service.PaymentService;
import com.tnl.logistics.service.SseService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Production service implementing payment processing, financial balance recalculation,
 * overpayment prevention, and SSE broadcasting.
 */
@Service
@Transactional
public class PaymentServiceImpl implements PaymentService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy");

    private final PaymentRepository paymentRepository;
    private final ShipmentRepository shipmentRepository;
    private final AppUserRepository appUserRepository;
    private final SseService sseService;

    public PaymentServiceImpl(PaymentRepository paymentRepository,
                              ShipmentRepository shipmentRepository,
                              AppUserRepository appUserRepository,
                              SseService sseService) {
        this.paymentRepository = paymentRepository;
        this.shipmentRepository = shipmentRepository;
        this.appUserRepository = appUserRepository;
        this.sseService = sseService;
    }

    @Override
    public PaymentResponse recordPayment(PaymentRecordRequest request, String actingStaffUsername) {
        Shipment shipment = shipmentRepository.findById(request.getShipmentId())
                .orElseThrow(() -> new IllegalArgumentException("Shipment not found: " + request.getShipmentId()));

        AppUser actingStaff = null;
        if (actingStaffUsername != null && !actingStaffUsername.isBlank()) {
            actingStaff = appUserRepository.findByUsername(actingStaffUsername).orElse(null);
        }

        List<Payment> existingPayments = paymentRepository.findByShipment_ShipmentId(shipment.getShipmentId());
        BigDecimal totalPaidBefore = existingPayments.stream()
                .map(Payment::getAmountPaid)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal remainingBalance = shipment.getTotalAmount().subtract(totalPaidBefore);
        if (remainingBalance.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException(String.format("Shipment %s is already fully paid.", shipment.getShipmentId()));
        }

        if (request.getAmountPaid().compareTo(remainingBalance) > 0) {
            throw new IllegalArgumentException(String.format(
                    "Payment amount ₱%s exceeds remaining balance ₱%s for shipment %s",
                    request.getAmountPaid(), remainingBalance, shipment.getShipmentId()));
        }

        LocalDate payDate = request.getPaymentDate() != null ? request.getPaymentDate() : LocalDate.now();
        String refNo = (request.getReferenceNo() != null && !request.getReferenceNo().isBlank())
                ? request.getReferenceNo().trim()
                : null;
        String remarks = (request.getRemarks() != null && !request.getRemarks().isBlank())
                ? request.getRemarks().trim()
                : null;

        if ((request.getMethod() == PaymentMethod.GCASH || request.getMethod() == PaymentMethod.BANK || request.getMethod() == PaymentMethod.CHEQUE)
                && (refNo == null || refNo.isBlank())) {
            throw new IllegalArgumentException(String.format("Reference number is required for %s payments.", request.getMethod().name()));
        }

        Payment payment = new Payment(
                shipment,
                request.getAmountPaid(),
                request.getMethod(),
                payDate,
                actingStaff,
                remarks
        );
        payment.setReferenceNo(refNo);

        Payment saved = paymentRepository.save(payment);

        BigDecimal totalPaidAfter = totalPaidBefore.add(saved.getAmountPaid());
        BigDecimal balanceAfter = shipment.getTotalAmount().subtract(totalPaidAfter);
        if (balanceAfter.compareTo(BigDecimal.ZERO) < 0) {
            balanceAfter = BigDecimal.ZERO;
        }

        String paymentStatus = totalPaidAfter.compareTo(shipment.getTotalAmount()) >= 0
                ? "Paid"
                : (totalPaidAfter.compareTo(BigDecimal.ZERO) > 0 ? "Partial" : "Unpaid");

        PaymentResponse response = mapToResponse(saved, shipment, totalPaidAfter, balanceAfter, paymentStatus);

        try {
            sseService.broadcastPaymentRecorded(response);
        } catch (Exception ignored) {}

        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public ShipmentPaymentSummaryResponse getPaymentsByShipmentId(String shipmentId) {
        Shipment shipment = shipmentRepository.findById(shipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Shipment not found: " + shipmentId));

        List<Payment> payments = paymentRepository.findByShipment_ShipmentIdOrderByRecordedAtDesc(shipmentId);

        BigDecimal totalPaid = payments.stream()
                .map(Payment::getAmountPaid)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal rawBalance = shipment.getTotalAmount().subtract(totalPaid);
        BigDecimal balance = rawBalance.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : rawBalance;

        String paymentStatus = totalPaid.compareTo(shipment.getTotalAmount()) >= 0
                ? "Paid"
                : (totalPaid.compareTo(BigDecimal.ZERO) > 0 ? "Partial" : "Unpaid");

        List<PaymentResponse> paymentResponses = payments.stream()
                .map(p -> mapToResponse(p, shipment, totalPaid, balance, paymentStatus))
                .collect(Collectors.toList());

        return new ShipmentPaymentSummaryResponse(
                shipment.getShipmentId(),
                shipment.getClient() != null ? shipment.getClient().getClientId() : null,
                shipment.getClient() != null ? shipment.getClient().getName() : "—",
                shipment.getRecipientName(),
                shipment.getTotalAmount(),
                totalPaid,
                balance,
                paymentStatus,
                paymentResponses
        );
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PaymentResponse> getPayments(String search, PaymentMethod method, String clientId,
                                            LocalDate startDate, LocalDate endDate, Pageable pageable) {
        String cleanSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;
        String cleanClientId = (clientId != null && !clientId.equalsIgnoreCase("ALL")) ? clientId.trim() : null;

        Page<Payment> paymentsPage = paymentRepository.searchPayments(cleanSearch, method, cleanClientId, startDate, endDate, pageable);

        List<PaymentResponse> responses = paymentsPage.getContent().stream().map(p -> {
            Shipment s = p.getShipment();
            List<Payment> allForShipment = paymentRepository.findByShipment_ShipmentId(s.getShipmentId());
            BigDecimal totalPaid = allForShipment.stream()
                    .map(Payment::getAmountPaid)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal balance = s.getTotalAmount().subtract(totalPaid);
            if (balance.compareTo(BigDecimal.ZERO) < 0) balance = BigDecimal.ZERO;

            String status = totalPaid.compareTo(s.getTotalAmount()) >= 0
                    ? "Paid"
                    : (totalPaid.compareTo(BigDecimal.ZERO) > 0 ? "Partial" : "Unpaid");

            return mapToResponse(p, s, totalPaid, balance, status);
        }).collect(Collectors.toList());

        return new PageImpl<>(responses, pageable, paymentsPage.getTotalElements());
    }

    private PaymentResponse mapToResponse(Payment p, Shipment s, BigDecimal totalPaid, BigDecimal balance, String status) {
        String staffName = p.getStaff() != null ? p.getStaff().getFullName() : "Office Staff";
        String dateFormatted = p.getPaymentDate() != null ? p.getPaymentDate().format(DATE_FORMATTER) : "—";

        return new PaymentResponse(
                p.getPaymentId(),
                s.getShipmentId(),
                s.getClient() != null ? s.getClient().getClientId() : null,
                s.getClient() != null ? s.getClient().getName() : "—",
                s.getRecipientName(),
                p.getAmountPaid(),
                p.getMethod(),
                p.getReferenceNo() != null ? p.getReferenceNo() : "—",
                p.getPaymentDate(),
                dateFormatted,
                staffName,
                p.getRemarks(),
                p.getRecordedAt(),
                s.getTotalAmount(),
                totalPaid,
                balance,
                status
        );
    }
}
