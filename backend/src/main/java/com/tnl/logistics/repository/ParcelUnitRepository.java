package com.tnl.logistics.repository;

import com.tnl.logistics.model.ParcelUnit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data Repository for ParcelUnit entity.
 */
@Repository
public interface ParcelUnitRepository extends JpaRepository<ParcelUnit, String> {

    @Query("SELECT MAX(p.trackingId) FROM ParcelUnit p WHERE p.trackingId LIKE :prefix")
    Optional<String> findMaxTrackingIdWithPrefix(@Param("prefix") String prefix);

    List<ParcelUnit> findByShipment_ShipmentIdOrderBySeqAsc(String shipmentId);

    @Query("SELECT p FROM ParcelUnit p WHERE p.shipment.shipmentId IN :shipmentIds ORDER BY p.seq ASC")
    List<ParcelUnit> findByShipment_ShipmentIdInOrderBySeqAsc(@Param("shipmentIds") Collection<String> shipmentIds);

    long countByCurrentVehicle_VehicleIdAndCurrentStatus(String vehicleId, com.tnl.logistics.model.ParcelStatus currentStatus);

    long countByCurrentVehicle_VehicleId(String vehicleId);

    @Query("SELECT p.currentVehicle.vehicleId, COUNT(p) FROM ParcelUnit p " +
           "WHERE p.currentStatus = :status AND p.currentVehicle IS NOT NULL " +
           "GROUP BY p.currentVehicle.vehicleId")
    List<Object[]> countLoadedParcelsGroupedByVehicle(@Param("status") com.tnl.logistics.model.ParcelStatus status);
}
