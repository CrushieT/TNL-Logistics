package com.tnl.logistics.repository;

import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.TrackingEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Spring Data Repository for TrackingEvent entity.
 */
@Repository
public interface TrackingEventRepository extends JpaRepository<TrackingEvent, Long> {

    List<TrackingEvent> findByParcelUnit_TrackingIdOrderByEventTimestampAsc(String trackingId);

    long countByVehicle_VehicleId(String vehicleId);

    @Query("SELECT e FROM TrackingEvent e " +
           "JOIN FETCH e.parcelUnit pu " +
           "JOIN FETCH pu.shipment s " +
           "LEFT JOIN FETCH e.staff u " +
           "ORDER BY e.eventTimestamp DESC")
    List<TrackingEvent> findRecentEvents(Pageable pageable);

    @Query(value = "SELECT e FROM TrackingEvent e " +
           "JOIN FETCH e.parcelUnit pu " +
           "JOIN FETCH pu.shipment s " +
           "LEFT JOIN FETCH e.staff u " +
           "LEFT JOIN FETCH e.vehicle v " +
           "WHERE (:search IS NULL OR LOWER(pu.trackingId) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "   OR LOWER(s.shipmentId) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "   OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "   OR LOWER(u.username) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "   OR (v IS NOT NULL AND (LOWER(v.vehicleId) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(v.plateNumber) LIKE LOWER(CONCAT('%', :search, '%'))))) " +
           "AND (:status IS NULL OR e.status = :status) " +
           "AND (:startDateTime IS NULL OR e.eventTimestamp >= :startDateTime) " +
           "AND (:endDateTime IS NULL OR e.eventTimestamp <= :endDateTime)",
           countQuery = "SELECT COUNT(e) FROM TrackingEvent e " +
           "JOIN e.parcelUnit pu " +
           "JOIN pu.shipment s " +
           "LEFT JOIN e.staff u " +
           "LEFT JOIN e.vehicle v " +
           "WHERE (:search IS NULL OR LOWER(pu.trackingId) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "   OR LOWER(s.shipmentId) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "   OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "   OR LOWER(u.username) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "   OR (v IS NOT NULL AND (LOWER(v.vehicleId) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(v.plateNumber) LIKE LOWER(CONCAT('%', :search, '%'))))) " +
           "AND (:status IS NULL OR e.status = :status) " +
           "AND (:startDateTime IS NULL OR e.eventTimestamp >= :startDateTime) " +
           "AND (:endDateTime IS NULL OR e.eventTimestamp <= :endDateTime)")
    Page<TrackingEvent> searchTrackingEvents(@Param("search") String search,
                                             @Param("status") ParcelStatus status,
                                             @Param("startDateTime") LocalDateTime startDateTime,
                                             @Param("endDateTime") LocalDateTime endDateTime,
                                             Pageable pageable);

    @Query("SELECT COUNT(e) FROM TrackingEvent e " +
           "WHERE e.status NOT IN (com.tnl.logistics.model.ParcelStatus.REGISTERED, com.tnl.logistics.model.ParcelStatus.QR_GENERATED) " +
           "AND e.eventTimestamp >= :startDateTime AND e.eventTimestamp <= :endDateTime")
    long countOperationalScansBetween(@Param("startDateTime") LocalDateTime startDateTime,
                                      @Param("endDateTime") LocalDateTime endDateTime);

    @Query("SELECT COUNT(DISTINCT e.staff.userId) FROM TrackingEvent e " +
           "WHERE e.staff.role = com.tnl.logistics.model.UserRole.FIELD_STAFF " +
           "AND e.eventTimestamp >= :startDateTime AND e.eventTimestamp <= :endDateTime")
    long countDistinctCouriersBetween(@Param("startDateTime") LocalDateTime startDateTime,
                                      @Param("endDateTime") LocalDateTime endDateTime);

    @Query("SELECT COUNT(e) FROM TrackingEvent e WHERE e.status = :status AND e.eventTimestamp >= :startDateTime AND e.eventTimestamp <= :endDateTime")
    long countStatusBetween(@Param("status") ParcelStatus status,
                            @Param("startDateTime") LocalDateTime startDateTime,
                            @Param("endDateTime") LocalDateTime endDateTime);
}
