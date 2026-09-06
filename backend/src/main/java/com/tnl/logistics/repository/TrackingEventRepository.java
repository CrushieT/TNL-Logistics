package com.tnl.logistics.repository;

import com.tnl.logistics.model.TrackingEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Spring Data Repository for TrackingEvent entity.
 */
@Repository
public interface TrackingEventRepository extends JpaRepository<TrackingEvent, Long> {

    List<TrackingEvent> findByParcelUnit_TrackingIdOrderByEventTimestampAsc(String trackingId);

    long countByVehicle_VehicleId(String vehicleId);

    @org.springframework.data.jpa.repository.Query("SELECT e FROM TrackingEvent e " +
           "JOIN FETCH e.parcelUnit pu " +
           "JOIN FETCH pu.shipment s " +
           "LEFT JOIN FETCH e.staff u " +
           "ORDER BY e.eventTimestamp DESC")
    List<TrackingEvent> findRecentEvents(org.springframework.data.domain.Pageable pageable);
}
