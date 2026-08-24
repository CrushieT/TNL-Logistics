package com.tnl.logistics.repository;

import com.tnl.logistics.model.TrackingEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Spring Data Repository for TrackingEvent entity.
 */
@Repository
public interface TrackingEventRepository extends JpaRepository<TrackingEvent, Long> {
}
