package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.WaybillGenerationRequest;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.IdentifierCounterService;
import com.tnl.logistics.service.ParcelCustodyLocks;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class WaybillNotificationTest {
    private final WaybillRepository waybills = mock(WaybillRepository.class);
    private final ParcelUnitRepository parcels = mock(ParcelUnitRepository.class);
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final ParcelCustodyLocks locks = mock(ParcelCustodyLocks.class);
    private final IdentifierCounterService counters = mock(IdentifierCounterService.class);
    private final SseServiceImpl events = new SseServiceImpl(users);
    private final WaybillServiceImpl service = new WaybillServiceImpl(waybills, mock(ShipmentRepository.class), parcels,
            mock(TrackingEventRepository.class), users, counters, locks, mock(WaybillReconciliationEventRepository.class), events);
    private final List<Object> sentData = new ArrayList<>();
    private org.mockito.MockedConstruction<SseEmitter> emitters;
    private Shipment shipment;
    private ParcelUnit parcel;
    private Waybill waybill;

    @BeforeEach
    void setUp() throws Exception {
        AppUser actor = new AppUser("USR-DISPATCH-TEST", "dispatch-test", "unused-hash", "Dispatch", UserRole.DISPATCH_STAFF);
        when(users.findById(actor.getUserId())).thenReturn(Optional.of(actor));
        shipment = new Shipment("SHP-NOTIFY-TEST", null, "Recipient", "Address", "09170000000", 1,
                ChargeModel.FLAT, BigDecimal.ONE, BigDecimal.ZERO, BigDecimal.ONE, false, RegisteredVia.DESKTOP_OFFICE);
        parcel = new ParcelUnit("TRK-NOTIFY-TEST", shipment, 1, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE);
        parcel.setCurrentStatus(ParcelStatus.LOADED_TO_HAULER);
        waybill = new Waybill("WYB-NOTIFY-TEST", shipment, actor, "Hauler");
        when(locks.lockParcels(List.of(parcel.getTrackingId()))).thenReturn(List.of(parcel));
        when(locks.lockManifest(waybill.getWaybillId())).thenReturn(waybill);
        when(locks.lockManifestParcels(waybill.getWaybillId())).thenReturn(List.of(parcel));
        when(waybills.findById(waybill.getWaybillId())).thenReturn(Optional.of(waybill));
        when(parcels.findByShipment_ShipmentIdAndTrackingIdIn(shipment.getShipmentId(), List.of(parcel.getTrackingId())))
                .thenReturn(List.of(parcel));
        when(parcels.findByWaybill_WaybillIdOrderBySeqAsc(waybill.getWaybillId())).thenReturn(List.of(parcel));
        when(counters.next(IdentifierCounterService.IdentifierFamily.WAYBILL, LocalDate.now().getYear())).thenReturn(1L);
        var authorization = mock(AppUserRepository.SseAuthorizationState.class);
        when(authorization.getActive()).thenReturn(true);
        when(authorization.getRole()).thenReturn(UserRole.ADMIN);
        when(authorization.getTokenVersion()).thenReturn(1);
        when(users.findSseAuthorizationState("USR-ADMIN-TEST")).thenReturn(Optional.of(authorization));
        emitters = mockConstruction(SseEmitter.class, (createdEmitter, context) -> doAnswer(invocation -> {
            SseEmitter.SseEventBuilder event = invocation.getArgument(0);
            event.build().forEach(part -> sentData.add(part.getData()));
            return null;
        }).when(createdEmitter).send(any(SseEmitter.SseEventBuilder.class)));
        events.registerClient("USR-ADMIN-TEST", 1, System.currentTimeMillis() + 60000);
        sentData.clear();
        TransactionSynchronizationManager.initSynchronization();
    }

    @AfterEach
    void tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization();
        events.closeStreamsForUser("USR-ADMIN-TEST");
        if (emitters != null) emitters.close();
    }

    @ParameterizedTest
    @ValueSource(strings = {"generate", "send"})
    void realSseServiceDefersNotificationUntilCommit(String operation) {
        invoke(operation);
        assertTrue(sentData.isEmpty());
        completeSynchronization(true);
        assertTrue(sentData.stream().anyMatch(value -> value instanceof String text && text.contains("WAYBILL_UPDATE")));
        String expectedId = operation.equals("send") ? waybill.getWaybillId() : String.format("WYB-%d-%04d", LocalDate.now().getYear(), 1);
        assertEquals(1, sentData.stream().filter(Map.class::isInstance).count());
        assertTrue(sentData.contains(Map.of("shipmentId", shipment.getShipmentId(), "waybillId", expectedId)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"generate", "send"})
    void rollbackDiscardsTheScheduledNotification(String operation) {
        invoke(operation);
        assertEquals(1, TransactionSynchronizationManager.getSynchronizations().size());
        completeSynchronization(false);
        assertTrue(sentData.isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"generate", "send"})
    void idempotentReplayDoesNotScheduleAnotherNotification(String operation) {
        if (operation.equals("generate")) {
            when(waybills.findByGenerationKey("notification-test")).thenReturn(Optional.of(waybill));
        } else {
            waybill.setStatus(WaybillStatus.SENT_TO_HAULER);
        }
        invoke(operation);
        assertTrue(TransactionSynchronizationManager.getSynchronizations().isEmpty());
    }

    private void invoke(String operation) {
        if (operation.equals("send")) {
            service.sendToHauler(waybill.getWaybillId(), "USR-DISPATCH-TEST");
        } else {
            WaybillGenerationRequest request = new WaybillGenerationRequest();
            request.setShipmentId(shipment.getShipmentId());
            request.setTrackingIds(List.of(parcel.getTrackingId()));
            request.setIdempotencyKey("notification-test");
            service.generate(request, "USR-DISPATCH-TEST");
        }
    }

    private void completeSynchronization(boolean isCommitted) {
        var callbacks = TransactionSynchronizationManager.getSynchronizations();
        if (isCommitted) callbacks.forEach(TransactionSynchronization::afterCommit);
        callbacks.forEach(callback -> callback.afterCompletion(isCommitted
                ? TransactionSynchronization.STATUS_COMMITTED : TransactionSynchronization.STATUS_ROLLED_BACK));
        TransactionSynchronizationManager.clearSynchronization();
    }
}
