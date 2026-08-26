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
}
