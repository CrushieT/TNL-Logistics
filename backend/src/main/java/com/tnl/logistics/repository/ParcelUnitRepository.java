package com.tnl.logistics.repository;

import com.tnl.logistics.model.ParcelUnit;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
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

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM ParcelUnit p WHERE p.trackingId = :trackingId")
    Optional<ParcelUnit> findByIdWithPessimisticLock(@Param("trackingId") String trackingId);

    List<ParcelUnit> findByShipment_ShipmentIdOrderBySeqAsc(String shipmentId);

    List<ParcelUnit> findByWaybill_WaybillIdOrderBySeqAsc(String waybillId);

    List<ParcelUnit> findByShipment_ShipmentIdAndTrackingIdIn(String shipmentId, Collection<String> trackingIds);

    @Query("SELECT p FROM ParcelUnit p LEFT JOIN FETCH p.currentVehicle WHERE p.shipment.shipmentId IN :shipmentIds ORDER BY p.seq ASC")
    List<ParcelUnit> findByShipment_ShipmentIdInOrderBySeqAsc(@Param("shipmentIds") Collection<String> shipmentIds);

    @Query("SELECT p.waybill.waybillId, COUNT(p) FROM ParcelUnit p " +
           "WHERE p.waybill.waybillId IN :waybillIds GROUP BY p.waybill.waybillId")
    List<Object[]> countByWaybillIds(@Param("waybillIds") Collection<String> waybillIds);

    @Query("select count(p) from ParcelUnit p where p.currentVehicle.vehicleId = :vehicleId and p.currentStatus = :currentStatus and p.lost = false")
    long countByCurrentVehicle_VehicleIdAndCurrentStatus(@Param("vehicleId") String vehicleId, @Param("currentStatus") com.tnl.logistics.model.ParcelStatus currentStatus);

    long countByCurrentVehicle_VehicleId(String vehicleId);

    @Query("SELECT p.currentVehicle.vehicleId, COUNT(p) FROM ParcelUnit p " +
           "WHERE p.lost = false AND p.currentStatus = :status AND p.currentVehicle IS NOT NULL " +
           "GROUP BY p.currentVehicle.vehicleId")
    List<Object[]> countLoadedParcelsGroupedByVehicle(@Param("status") com.tnl.logistics.model.ParcelStatus status);

    @Query("SELECT p.currentStatus, COUNT(p) FROM ParcelUnit p WHERE p.lost = false GROUP BY p.currentStatus")
    List<Object[]> countParcelsGroupedByStatus();

    @Query("SELECT p.currentStatus, COUNT(p) FROM ParcelUnit p " +
           "WHERE p.lost = false AND p.shipment.dateRegistered >= :cycleStart AND p.shipment.dateRegistered <= :cycleEnd " +
           "GROUP BY p.currentStatus")
    List<Object[]> countParcelsGroupedByStatusBetween(@Param("cycleStart") java.time.LocalDateTime cycleStart, @Param("cycleEnd") java.time.LocalDateTime cycleEnd);

    @Query("SELECT p.lost, p.currentStatus, COUNT(p) FROM ParcelUnit p " +
           "WHERE p.shipment.dateRegistered >= :cycleStart AND p.shipment.dateRegistered <= :cycleEnd " +
           "GROUP BY p.lost, p.currentStatus")
    List<Object[]> countParcelsGroupedByLossAndStatusBetween(@Param("cycleStart") java.time.LocalDateTime cycleStart,
                                                          @Param("cycleEnd") java.time.LocalDateTime cycleEnd);

    @Query("SELECT COUNT(p) FROM ParcelUnit p WHERE p.lost = true " +
           "AND p.shipment.dateRegistered >= :cycleStart AND p.shipment.dateRegistered <= :cycleEnd")
    long countLostParcelsBetween(@Param("cycleStart") java.time.LocalDateTime cycleStart,
                                 @Param("cycleEnd") java.time.LocalDateTime cycleEnd);

    @Query("SELECT COUNT(p) FROM ParcelUnit p WHERE p.currentStatus = com.tnl.logistics.model.ParcelStatus.COMPLETED " +
           "AND p.shipment.dateRegistered >= :cycleStart AND p.shipment.dateRegistered <= :cycleEnd")
    long countCompletedParcelsBetween(@Param("cycleStart") java.time.LocalDateTime cycleStart,
                                      @Param("cycleEnd") java.time.LocalDateTime cycleEnd);


    @Query(value = """
            SELECT DATE(s.date_registered) AS regDate,
                   CAST(pu.is_lost AS UNSIGNED) AS lostFlag,
                   pu.current_status AS currentStatus,
                   COUNT(pu.tracking_id) AS parcelsCount,
                   COALESCE(SUM(pu.weight_kg), 0) AS totalWeightKg,
                   COALESCE(SUM(pu.volume_cbm), 0) AS totalVolumeCbm
            FROM parcel_unit pu
            JOIN shipment s ON s.shipment_id = pu.shipment_id
            WHERE s.date_registered BETWEEN :start AND :end
            GROUP BY DATE(s.date_registered), pu.is_lost, pu.current_status
            """, nativeQuery = true)
    List<DailyParcelTotals> aggregateDailyParcels(
            @Param("start") java.time.LocalDateTime start,
            @Param("end") java.time.LocalDateTime end);
}
