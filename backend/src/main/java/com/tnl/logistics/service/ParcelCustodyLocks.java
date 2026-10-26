package com.tnl.logistics.service;

import com.tnl.logistics.model.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class ParcelCustodyLocks {
    private final EntityManager entityManager;
    public ParcelCustodyLocks(EntityManager entityManager) { this.entityManager = entityManager; }

    public Shipment lockShipment(String shipmentId) {
        Shipment shipment = entityManager.find(Shipment.class, shipmentId, LockModeType.PESSIMISTIC_WRITE);
        if (shipment == null) throw missing();
        entityManager.refresh(shipment, LockModeType.PESSIMISTIC_WRITE);
        return shipment;
    }

    private void lockWaybills(Collection<String> shipmentIds) {
        List<Waybill> waybills = entityManager.createQuery(
                "select w from Waybill w where w.shipment.shipmentId in :ids order by w.waybillId", Waybill.class)
                .setParameter("ids", shipmentIds).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        for (Waybill waybill : waybills) entityManager.refresh(waybill, LockModeType.PESSIMISTIC_WRITE);
    }

    public List<ParcelUnit> lockParcels(Collection<String> trackingIds) {
        if (trackingIds.isEmpty()) throw missing();
        entityManager.flush();
        List<String> shipmentIds = entityManager.createQuery(
                "select distinct p.shipment.shipmentId from ParcelUnit p where p.trackingId in :ids order by p.shipment.shipmentId", String.class)
                .setParameter("ids", trackingIds).getResultList();
        shipmentIds.forEach(this::lockShipment);
        if (shipmentIds.isEmpty()) throw missing();
        lockWaybills(shipmentIds);
        List<ParcelUnit> parcels = new ArrayList<>();
        for (String trackingId : trackingIds.stream().distinct().sorted().toList()) {
            ParcelUnit parcel = entityManager.find(ParcelUnit.class, trackingId);
            if (parcel == null) throw missing();
            entityManager.refresh(parcel, LockModeType.PESSIMISTIC_WRITE);
            parcels.add(parcel);
        }
        return parcels;
    }

    public Waybill lockManifest(String waybillId) {
        entityManager.flush();
        List<String> shipmentIds = entityManager.createQuery(
                "select w.shipment.shipmentId from Waybill w where w.waybillId = :id", String.class)
                .setParameter("id", waybillId).getResultList();
        if (shipmentIds.isEmpty()) throw missing();
        lockShipment(shipmentIds.get(0));
        lockWaybills(shipmentIds);
        Waybill waybill = entityManager.find(Waybill.class, waybillId, LockModeType.PESSIMISTIC_WRITE);
        if (waybill == null) throw missing();
        entityManager.refresh(waybill, LockModeType.PESSIMISTIC_WRITE);
        return waybill;
    }

    public List<ParcelUnit> lockManifestParcels(String waybillId) {
        List<ParcelUnit> parcels = entityManager.createQuery(
                "select p from ParcelUnit p where p.waybill.waybillId = :id order by p.trackingId", ParcelUnit.class)
                .setParameter("id", waybillId).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        for (ParcelUnit parcel : parcels) entityManager.refresh(parcel, LockModeType.PESSIMISTIC_WRITE);
        return parcels;
    }

    private ResponseStatusException missing() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Parcel, shipment, or waybill not found.");
    }
}
