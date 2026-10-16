package com.tnl.logistics.repository;

import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.TrackingEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface PersonalTrackingEventRepository {
    Page<TrackingEvent> findPersonalEvents(String staffId, String search, ParcelStatus status, Pageable pageable);
}
