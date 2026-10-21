package com.tnl.logistics.repository;

import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.TrackingEvent;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.domain.SliceImpl;

import java.util.List;

public class PersonalTrackingEventRepositoryImpl implements PersonalTrackingEventRepository {
    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public Page<TrackingEvent> findPersonalEvents(String staffId, String search, ParcelStatus status, Pageable pageable) {
        String filters = buildFilters(search, status);
        List<?> eventIds = findEventIds(staffId, search, status, pageable, filters, pageable.getPageSize());
        Query countQuery = entityManager.createNativeQuery("SELECT COUNT(*)" + filters);
        bindFilters(countQuery, staffId, search, status);
        long total = ((Number) countQuery.getSingleResult()).longValue();
        return new PageImpl<>(hydrateEvents(staffId, eventIds), pageable, total);
    }

    @Override
    public Slice<TrackingEvent> findPersonalEventSlice(String staffId, String search, ParcelStatus status, Pageable pageable) {
        List<?> eventIds = findEventIds(staffId, search, status, pageable,
                buildFilters(search, status), pageable.getPageSize() + 1);
        boolean hasNext = eventIds.size() > pageable.getPageSize();
        List<?> pageIds = hasNext ? eventIds.subList(0, pageable.getPageSize()) : eventIds;
        return new SliceImpl<>(hydrateEvents(staffId, pageIds), pageable, hasNext);
    }

    private String buildFilters(String search, ParcelStatus status) {
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
        return from + predicate;
    }

    private List<?> findEventIds(String staffId, String search, ParcelStatus status, Pageable pageable,
                                String filters, int limit) {
        String idFilters = (search == null && status == null)
                ? " FROM tracking_event e FORCE INDEX (idx_tracking_event_staff_timestamp_event)"
                        + " WHERE e.staff_id = :staffId"
                : filters;
        Query idsQuery = entityManager.createNativeQuery("SELECT e.event_id" + idFilters
                + " ORDER BY e.event_timestamp DESC, e.event_id DESC");
        bindFilters(idsQuery, staffId, search, status);
        idsQuery.setFirstResult(Math.toIntExact(pageable.getOffset()));
        idsQuery.setMaxResults(limit);
        return idsQuery.getResultList();
    }

    private List<TrackingEvent> hydrateEvents(String staffId, List<?> eventIds) {
        if (eventIds.isEmpty()) {
            return List.of();
        }

        return entityManager.createQuery("""
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
