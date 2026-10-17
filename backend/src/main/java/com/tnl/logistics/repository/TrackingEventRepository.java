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
import java.util.Collection;
import java.util.List;

/**
 * Spring Data Repository for TrackingEvent entity.
 */
@Repository
public interface TrackingEventRepository extends JpaRepository<TrackingEvent, Long>, PersonalTrackingEventRepository, AdminTrackingEventRepository {

    List<TrackingEvent> findByParcelUnit_TrackingIdOrderByEventTimestampAsc(String trackingId);

    @Query("SELECT e FROM TrackingEvent e LEFT JOIN FETCH e.vehicle WHERE e.parcelUnit.trackingId IN :trackingIds AND e.vehicle IS NOT NULL ORDER BY e.eventTimestamp ASC")
    List<TrackingEvent> findByParcelUnit_TrackingIdInAndVehicleNotNullOrderByEventTimestampAsc(@Param("trackingIds") Collection<String> trackingIds);

    long countByVehicle_VehicleId(String vehicleId);

    @Query("SELECT e FROM TrackingEvent e " +
           "JOIN FETCH e.parcelUnit pu " +
           "JOIN FETCH pu.shipment s " +
           "LEFT JOIN FETCH e.staff u " +
           "ORDER BY e.eventTimestamp DESC")
    List<TrackingEvent> findRecentEvents(Pageable pageable);

    @Query(value = """
            SELECT
                COALESCE(SUM(CASE WHEN e.status NOT IN ('REGISTERED', 'QR_GENERATED') THEN 1 ELSE 0 END), 0) AS todayTotalScans,
                COALESCE(COUNT(DISTINCT CASE WHEN u.role IN ('COURIER_STAFF', 'DISPATCH_STAFF') THEN e.staff_id ELSE NULL END), 0) AS activeCouriersCount,
                COALESCE(SUM(CASE WHEN e.status = 'LOADED_ON_TRUCK' THEN 1 ELSE 0 END), 0) AS loadedOnTruckToday,
                COALESCE(SUM(CASE WHEN e.status = 'LOADED_TO_HAULER' THEN 1 ELSE 0 END), 0) AS handedToHaulerToday
            FROM tracking_event e
            LEFT JOIN app_user u ON u.user_id = e.staff_id
            WHERE e.event_timestamp >= :startDateTime AND e.event_timestamp <= :endDateTime
            """, nativeQuery = true)
    TodayTrackingMetricsSummary getTodayTrackingMetricsSummary(
            @Param("startDateTime") LocalDateTime startDateTime,
            @Param("endDateTime") LocalDateTime endDateTime);

    @Query("SELECT COUNT(e) FROM TrackingEvent e " +
           "WHERE e.status NOT IN (com.tnl.logistics.model.ParcelStatus.REGISTERED, com.tnl.logistics.model.ParcelStatus.QR_GENERATED) " +
           "AND e.eventTimestamp >= :startDateTime AND e.eventTimestamp <= :endDateTime")
    long countOperationalScansBetween(@Param("startDateTime") LocalDateTime startDateTime,
                                      @Param("endDateTime") LocalDateTime endDateTime);

    @Query("SELECT COUNT(DISTINCT e.staff.userId) FROM TrackingEvent e " +
           "WHERE e.staff.role IN (com.tnl.logistics.model.UserRole.COURIER_STAFF, " +
           "com.tnl.logistics.model.UserRole.DISPATCH_STAFF) " +
           "AND e.eventTimestamp >= :startDateTime AND e.eventTimestamp <= :endDateTime")
    long countDistinctOperationalStaffBetween(@Param("startDateTime") LocalDateTime startDateTime,
                                              @Param("endDateTime") LocalDateTime endDateTime);

    @Query("SELECT COUNT(e) FROM TrackingEvent e WHERE e.status = :status AND e.eventTimestamp >= :startDateTime AND e.eventTimestamp <= :endDateTime")
    long countStatusBetween(@Param("status") ParcelStatus status,
                            @Param("startDateTime") LocalDateTime startDateTime,
                            @Param("endDateTime") LocalDateTime endDateTime);

    @Query("SELECT e.status, COUNT(e) FROM TrackingEvent e " +
           "WHERE e.staff.userId = :staffId " +
           "AND e.eventTimestamp >= :startDateTime AND e.eventTimestamp <= :endDateTime " +
           "GROUP BY e.status")
    List<Object[]> countPersonalEventsByStatusBetween(@Param("staffId") String staffId,
                                                     @Param("startDateTime") LocalDateTime startDateTime,
                                                     @Param("endDateTime") LocalDateTime endDateTime);

    @Query("SELECT CASE WHEN COUNT(e) > 0 THEN true ELSE false END FROM TrackingEvent e " +
           "WHERE e.parcelUnit.trackingId = :trackingId AND e.staff.userId = :staffId")
    boolean hasStaffScannedParcel(@Param("trackingId") String trackingId,
                                  @Param("staffId") String staffId);

    @Query("SELECT e FROM TrackingEvent e " +
           "JOIN FETCH e.parcelUnit pu " +
           "JOIN FETCH pu.shipment s " +
           "LEFT JOIN FETCH e.vehicle v " +
           "WHERE pu.trackingId = :trackingId AND e.staff.userId = :staffId " +
           "ORDER BY e.eventTimestamp ASC, e.eventId ASC")
    List<TrackingEvent> findPersonalEventsForParcel(@Param("trackingId") String trackingId,
                                                  @Param("staffId") String staffId);
}
