package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.PaymentRecordRequest;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.SseService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceImplTest {
    @Mock private PaymentRepository payments;
    @Mock private ShipmentRepository shipments;
    @Mock private AppUserRepository users;
    @Mock private SoaRepository statements;
    @Mock private WeeklyCollectionRepository collections;
    @Mock private SseService events;
    @Mock private jakarta.persistence.EntityManager entityManager;
    private PaymentServiceImpl service;
    private Shipment shipment;
    private Soa statement;

    @BeforeEach
    void setUp() {
        service = new PaymentServiceImpl(payments, shipments, users, statements, collections, events);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "entityManager", entityManager);
        shipment = new Shipment("SHP-PAY-TEST", null, "Recipient", "Address", "09170000000", 1,
                ChargeModel.FLAT, new BigDecimal("500.00"), BigDecimal.ZERO, new BigDecimal("500.00"),
                false, RegisteredVia.DESKTOP_OFFICE);
        shipment.setStatementId("SOA-PAY-TEST");
        statement = new Soa("SOA-PAY-TEST", null, null, null, BigDecimal.ZERO, new BigDecimal("500.00"),
                new BigDecimal("300.00"), "Approved adjustment", BigDecimal.ZERO, new BigDecimal("200.00"),
                "Collector", LocalDate.now(), null);
    }

    @Test
    void deductionCapsPaymentBeforeInsertingLedgerEntry() {
        when(shipments.findByIdForUpdate(shipment.getShipmentId())).thenReturn(Optional.of(shipment));
        when(statements.findByIdForUpdate(statement.getSoaNo())).thenReturn(Optional.of(statement));

        assertThrows(IllegalArgumentException.class, () -> service.recordPayment(request("500.00"), null));
        verify(payments, never()).save(any());
        assertEquals(new BigDecimal("200.00"), statement.getOutstandingBalance());
    }

    @Test
    void partialPaymentsSettleStatementWithoutFabricatingCashPayments() {
        when(shipments.findByIdForUpdate(shipment.getShipmentId())).thenReturn(Optional.of(shipment));
        when(statements.findByIdForUpdate(statement.getSoaNo())).thenReturn(Optional.of(statement));
        when(payments.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(payments.findByShipmentIdsForUpdate(List.of(shipment.getShipmentId())))
                .thenReturn(List.of()).thenReturn(List.of(new Payment(shipment, new BigDecimal("100.00"), PaymentMethod.CASH, LocalDate.now())));

        service.recordPayment(request("100.00"), null);
        assertEquals(new BigDecimal("100.00"), statement.getOutstandingBalance());
        var response = service.recordPayment(request("100.00"), null);
        assertEquals(new BigDecimal("0.00"), statement.getOutstandingBalance());
        assertEquals(new BigDecimal("200.00"), statement.getTotalPaid());
        assertEquals("Partial", response.getShipmentPaymentStatus());
        verify(payments, times(2)).save(any(Payment.class));
    }

    @Test
    void missingLinkedStatementRejectsBeforeWriting() {
        when(shipments.findByIdForUpdate(shipment.getShipmentId())).thenReturn(Optional.of(shipment));
        var failure = assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.recordPayment(request("1.00"), null));
        assertEquals(409, failure.getStatusCode().value());
        verifyNoInteractions(payments);
    }

    @Test
    void oneCentAboveStatementBalanceIsRejected() {
        when(shipments.findByIdForUpdate(shipment.getShipmentId())).thenReturn(Optional.of(shipment));
        when(statements.findByIdForUpdate(statement.getSoaNo())).thenReturn(Optional.of(statement));
        assertThrows(IllegalArgumentException.class, () -> service.recordPayment(request("200.01"), null));
        verify(payments, never()).save(any());
    }

    @Test
    void settledStatementRejectsFurtherCollection() {
        when(shipments.findByIdForUpdate(shipment.getShipmentId())).thenReturn(Optional.of(shipment));
        when(statements.findByIdForUpdate(statement.getSoaNo())).thenReturn(Optional.of(statement));
        statement.setOutstandingBalance(BigDecimal.ZERO);
        var failure = assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.recordPayment(request("0.01"), null));
        assertEquals(409, failure.getStatusCode().value());
        verify(payments, never()).save(any());
    }

    @Test
    void unlinkedShipmentAcceptsItsFullCashBalance() {
        shipment.setStatementId(null);
        when(shipments.findByIdForUpdate(shipment.getShipmentId())).thenReturn(Optional.of(shipment));
        when(payments.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var response = service.recordPayment(request("500.00"), null);
        assertEquals("Paid", response.getShipmentPaymentStatus());
        assertEquals(new BigDecimal("0.00"), response.getShipmentBalance());
        verifyNoInteractions(statements, collections);
    }

    @Test
    void statementBalanceDoesNotAllowExceedingShipmentBalance() {
        when(shipments.findByIdForUpdate(shipment.getShipmentId())).thenReturn(Optional.of(shipment));
        when(statements.findByIdForUpdate(statement.getSoaNo())).thenReturn(Optional.of(statement));
        statement.setOutstandingBalance(new BigDecimal("1000.00"));
        assertThrows(IllegalArgumentException.class, () -> service.recordPayment(request("500.01"), null));
        verify(payments, never()).save(any());
    }

    @Test
    void exactCollectionUpdatesTheLockedWeeklyCollection() {
        var collection = new WeeklyCollection("COL-PAY-TEST", null, LocalDate.now(), LocalDate.now(),
                new BigDecimal("500.00"), BigDecimal.ZERO, new BigDecimal("200.00"), "FOR_COLLECTION");
        statement.setCollection(collection);
        when(shipments.findByIdForUpdate(shipment.getShipmentId())).thenReturn(Optional.of(shipment));
        when(statements.findByIdForUpdate(statement.getSoaNo())).thenReturn(Optional.of(statement));
        when(collections.findByIdForUpdate(collection.getCollectionId())).thenReturn(Optional.of(collection));
        when(payments.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        service.recordPayment(request("200.00"), null);
        assertEquals(new BigDecimal("200.00"), collection.getTotalPaid());
        assertEquals(new BigDecimal("0.00"), collection.getBalance());
        assertEquals("PAID", collection.getStatus());
        verify(entityManager).refresh(collection, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
    }

    @Test
    void paymentSummaryCapsCollectibleWithoutChangingCashBalance() {
        when(shipments.findById(shipment.getShipmentId())).thenReturn(Optional.of(shipment));
        when(statements.findById(statement.getSoaNo())).thenReturn(Optional.of(statement));
        when(payments.findByShipment_ShipmentIdOrderByRecordedAtDesc(shipment.getShipmentId())).thenReturn(List.of());

        var summary = service.getPaymentsByShipmentId(shipment.getShipmentId());
        assertEquals(new BigDecimal("200.00"), summary.getCollectibleBalance());
        assertEquals(new BigDecimal("500.00"), summary.getBalance());
        assertEquals("Unpaid", summary.getPaymentStatus());
    }

    private PaymentRecordRequest request(String amount) {
        return new PaymentRecordRequest(shipment.getShipmentId(), new BigDecimal(amount), PaymentMethod.CASH,
                null, LocalDate.now(), null);
    }
}
