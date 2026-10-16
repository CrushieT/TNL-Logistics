package com.tnl.logistics.repository;

import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.TrackingEvent;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;

public class PersonalTrackingEventRepositoryImpl implements PersonalTrackingEventRepository {
    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public Page<TrackingEvent> findPersonalEvents(String staffId, String search, ParcelStatus status, Pageable pageable) {
        String from = " FROM tracking_event e";
        if (search != null) {
            // DISTINCT keeps MySQL from merging this into an ordered scan of every event.
            from += """
                     JOIN (SELECT DISTINCT tracking_id FROM parcel_unit
                           WHERE LOWER(tracking_id) LIKE LOWER(CONCAT('%', :search, '%'))
                              OR LOWER(shipment_id) LIKE LOWER(CONCAT('%', :search, '%')))
                     matched ON matched.tracking_id = e.tracking_id
                    """;
        }
        String predicate = " WHERE e.staff_id = :staffId";
        if (status != null) {
            predicate += " AND e.status = :status";
        }
        Query idsQuery = entityManager.createNativeQuery("SELECT e.event_id" + from + predicate
                + " ORDER BY e.event_timestamp DESC, e.event_id DESC");
        bindFilters(idsQuery, staffId, search, status);
        idsQuery.setFirstResult(Math.toIntExact(pageable.getOffset()));
        idsQuery.setMaxResults(pageable.getPageSize());
        List<?> eventIds = idsQuery.getResultList();

        Query countQuery = entityManager.createNativeQuery("SELECT COUNT(*)" + from + predicate);
        bindFilters(countQuery, staffId, search, status);
        long total = ((Number) countQuery.getSingleResult()).longValue();
        if (eventIds.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, total);
        }

        List<TrackingEvent> events = entityManager.createQuery("""
                SELECT e FROM TrackingEvent e
                JOIN FETCH e.parcelUnit pu
                JOIN FETCH pu.shipment
                LEFT JOIN FETCH e.vehicle
                WHERE e.staff.userId = :staffId AND e.eventId IN :eventIds
                ORDER BY e.eventTimestamp DESC, e.eventId DESC
                """, TrackingEvent.class)
                .setParameter("staffId", staffId)
                .setParameter("eventIds", eventIds.stream().map(id -> ((Number) id).longValue()).toList())
                .getResultList();
        return new PageImpl<>(events, pageable, total);
    }

    private void bindFilters(Query query, String staffId, String search, ParcelStatus status) {
        query.setParameter("staffId", staffId);
        if (search != null) {
            query.setParameter("search", search);
        }
        if (status != null) {
            query.setParameter("status", status.name());
        }
    }
}
