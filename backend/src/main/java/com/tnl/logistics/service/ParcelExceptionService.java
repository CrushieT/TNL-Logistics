package com.tnl.logistics.service;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.server.ResponseStatusException;

@Service
@Validated
@Transactional
public class ParcelExceptionService {
    private final ParcelCustodyLocks locks;
    private final ParcelUnitRepository parcels;
    private final AppUserRepository users;
    private final ParcelLossEventRepository lossEvents;
    private final WaybillReconciliationEventRepository reconciliations;
    private final ParcelExceptionCommandRepository commands;
    private final ShipmentService shipmentService;
    private final WaybillService waybillService;
    private final SseService sseService;

    public ParcelExceptionService(ParcelCustodyLocks locks, ParcelUnitRepository parcels, AppUserRepository users,
            ParcelLossEventRepository lossEvents, WaybillReconciliationEventRepository reconciliations,
            ParcelExceptionCommandRepository commands, ShipmentService shipmentService,
            WaybillService waybillService, SseService sseService) {
        this.locks = locks;
        this.parcels = parcels;
        this.users = users;
        this.lossEvents = lossEvents;
        this.reconciliations = reconciliations;
        this.commands = commands;
        this.shipmentService = shipmentService;
        this.waybillService = waybillService;
        this.sseService = sseService;
    }

    public ParcelUnitDetailResponse changeLoss(String trackingId, boolean isLost,
            @Valid ParcelExceptionRequest request, String actorId) {
        requireAdmin(actorId);
        ParcelUnit parcel = locks.lockParcels(List.of(trackingId)).get(0);
        String action = isLost ? "LOST" : "FOUND";
        if (isReplay(action, trackingId, request, actorId)) return shipmentService.getParcelUnitByTrackingId(trackingId);
        if (parcel.getRevision() != request.expectedRevision()) throw conflict("Parcel changed. Refresh and review again.");
        if (parcel.getCurrentStatus() == ParcelStatus.COMPLETED) throw conflict("Delivered parcels cannot be marked lost or found.");
        if (parcel.isLost() == isLost) throw conflict("Parcel loss state already changed. Refresh and review again.");
        reserveCommand(action, trackingId, request, actorId);
        lossEvents.save(new ParcelLossEvent(parcel, action, request.reason(), actorId, request.requestId(), request.expectedRevision()));
        parcel.setLost(isLost);
        Waybill waybill = parcel.getWaybill();
        if (waybill != null) {
            waybill.advanceManifestRevision();
            if (!isLost && waybill.getStatus() == WaybillStatus.SIGNED_COMPLETED) {
                reconciliations.save(new WaybillReconciliationEvent(waybill, "REOPENED", null, actorId, null, null));
                waybill.setStatus(waybill.getDispatchedAt() == null ? WaybillStatus.GENERATED : WaybillStatus.SENT_TO_HAULER);
                waybill.setReconciliationOutcome(null);
                waybill.setSignedBy(null);
                waybill.setSignedAt(null);
                waybill.setCompletedBy(null);
            }
        }
        parcels.flush();
        publishRefresh(parcel.getShipment().getShipmentId(), trackingId);
        return shipmentService.getParcelUnitByTrackingId(trackingId);
    }

    public WaybillManifestResponse closeAllLost(String waybillId, @Valid ParcelExceptionRequest request, String actorId) {
        requireAdmin(actorId);
        Waybill waybill = locks.lockManifest(waybillId);
        List<ParcelUnit> manifest = locks.lockManifestParcels(waybillId);
        if (isReplay("CLOSE_ALL_LOST", waybillId, request, actorId)) return waybillService.getManifestById(waybillId);
        if (waybill.getManifestRevision() != request.expectedRevision()) throw conflict("Manifest changed. Refresh and review again.");
        if (waybill.getStatus() == WaybillStatus.SIGNED_COMPLETED || manifest.isEmpty()
                || manifest.stream().anyMatch(parcel -> !parcel.isLost())) {
            throw conflict("Only an open waybill with every manifest parcel lost can be closed as all lost.");
        }
        reserveCommand("CLOSE_ALL_LOST", waybillId, request, actorId);
        waybill.setReconciliationOutcome("ALL_LOST");
        waybill.setStatus(WaybillStatus.SIGNED_COMPLETED);
        waybill.advanceManifestRevision();
        reconciliations.save(new WaybillReconciliationEvent(waybill, "CLOSED", request.reason(), actorId,
                request.requestId(), request.expectedRevision()));
        parcels.flush();
        publishRefresh(waybill.getShipment().getShipmentId(), "");
        return waybillService.getManifestById(waybillId);
    }

    private void requireAdmin(String actorId) {
        AppUser actor = users.findById(actorId).orElseThrow(() -> new AccessDeniedException("Admin required"));
        if (!Boolean.TRUE.equals(actor.getActive()) || actor.getRole() != UserRole.ADMIN) throw new AccessDeniedException("Admin required");
    }

    @Transactional(readOnly = true)
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'RECEIVING_STAFF')")
    public List<WaybillReconciliationResponse> getReconciliationHistory(String waybillId) {
        return reconciliations.findByWaybillIdOrderByEventIdAsc(waybillId).stream().map(WaybillReconciliationResponse::from).toList();
    }
    private boolean isReplay(String action, String target, ParcelExceptionRequest request, String actorId) {
        ParcelExceptionCommand existing = commands.findLocked(request.requestId()).orElse(null);
        if (existing == null) return false;
        if (!existing.matches(command(action, target, request, actorId))) throw conflict("Request ID was used for different command content.");
        return true;
    }
    private ParcelExceptionCommand command(String action, String target, ParcelExceptionRequest request, String actorId) {
        return new ParcelExceptionCommand(request.requestId(), action, target, actorId, request.reason(), request.expectedRevision());
    }
    private void reserveCommand(String action, String target, ParcelExceptionRequest request, String actorId) {
        commands.saveAndFlush(command(action, target, request, actorId));
    }
    private void publishRefresh(String shipmentId, String trackingId) {
        sseService.broadcastEvent("PARCEL_EXCEPTION", Map.of("shipmentId", shipmentId, "trackingId", trackingId));
    }
    private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
}
