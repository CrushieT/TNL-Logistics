package com.tnl.logistics.repository;

import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.TrackingEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;

/**
 * Custom repository interface declaring ID-first company-wide admin tracking event search.
 */
public interface AdminTrackingEventRepository {

    Page<TrackingEvent> findAdminTrackingEvents(String search,
                                               ParcelStatus status,
                                               LocalDateTime startDateTime,
                                               LocalDateTime endDateTime,
                                               Pageable pageable);
}
