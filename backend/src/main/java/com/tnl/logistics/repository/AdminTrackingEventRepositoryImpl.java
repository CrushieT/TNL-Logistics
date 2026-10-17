package com.tnl.logistics.repository;

import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.TrackingEvent;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Custom repository implementation for company-wide admin tracking event search.
 * Implements ID-first pagination, join elimination for unfiltered/date/status queries,
 * and bounded eager relationship hydration.
 */
public class AdminTrackingEventRepositoryImpl implements AdminTrackingEventRepository {

    private static final int MAX_PAGE_SIZE = 500;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public Page<TrackingEvent> findAdminTrackingEvents(String search,
                                                       ParcelStatus status,
                                                       LocalDateTime startDateTime,
                                                       LocalDateTime endDateTime,
                                                       Pageable pageable) {
        int pageNumber = (pageable != null) ? Math.max(0, pageable.getPageNumber()) : 0;
        int pageSize = (pageable != null) ? Math.min(MAX_PAGE_SIZE, Math.max(1, pageable.getPageSize())) : 25;
        Pageable clampedPageable = PageRequest.of(pageNumber, pageSize,
                Sort.by(Sort.Order.desc("eventTimestamp"), Sort.Order.desc("eventId")));

        String cleanSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;

        StringBuilder fromBuilder = new StringBuilder();
        List<String> predicates = new ArrayList<>();
        Map<String, Object> parameters = new HashMap<>();

        if (cleanSearch == null) {
            fromBuilder.append(" FROM tracking_event e");
        } else {
            fromBuilder.append(" FROM tracking_event e")
                    .append(" JOIN parcel_unit pu ON pu.tracking_id = e.tracking_id")
                    .append(" LEFT JOIN app_user u ON u.user_id = e.staff_id")
                    .append(" LEFT JOIN vehicle v ON v.vehicle_id = e.vehicle_id");

            predicates.add("""
                (LOWER(pu.tracking_id) LIKE LOWER(CONCAT('%', :search, '%'))
                 OR LOWER(pu.shipment_id) LIKE LOWER(CONCAT('%', :search, '%'))
                 OR (u.full_name IS NOT NULL AND LOWER(u.full_name) LIKE LOWER(CONCAT('%', :search, '%')))
                 OR (u.username IS NOT NULL AND LOWER(u.username) LIKE LOWER(CONCAT('%', :search, '%')))
                 OR (v.vehicle_id IS NOT NULL AND LOWER(v.vehicle_id) LIKE LOWER(CONCAT('%', :search, '%')))
                 OR (v.plate_number IS NOT NULL AND LOWER(v.plate_number) LIKE LOWER(CONCAT('%', :search, '%'))))
            """);
            parameters.put("search", cleanSearch);
        }

        if (status != null) {
            predicates.add("e.status = :status");
            parameters.put("status", status.name());
        }
        if (startDateTime != null) {
            predicates.add("e.event_timestamp >= :startDateTime");
            parameters.put("startDateTime", startDateTime);
        }
        if (endDateTime != null) {
            predicates.add("e.event_timestamp <= :endDateTime");
            parameters.put("endDateTime", endDateTime);
        }

        String whereClause = predicates.isEmpty() ? "" : " WHERE " + String.join(" AND ", predicates);
        String fromAndWhere = fromBuilder.toString() + whereClause;

        Query countQuery = entityManager.createNativeQuery("SELECT COUNT(*)" + fromAndWhere);
        parameters.forEach(countQuery::setParameter);
        long total = ((Number) countQuery.getSingleResult()).longValue();

        if (total == 0L) {
            return new PageImpl<>(List.of(), clampedPageable, 0L);
        }

        long offset = (long) pageNumber * pageSize;
        if (offset >= total) {
            return new PageImpl<>(List.of(), clampedPageable, total);
        }

        Query idsQuery = entityManager.createNativeQuery("SELECT e.event_id" + fromAndWhere
                + " ORDER BY e.event_timestamp DESC, e.event_id DESC");
        parameters.forEach(idsQuery::setParameter);
        idsQuery.setFirstResult(Math.toIntExact(offset));
        idsQuery.setMaxResults(pageSize);

        List<?> rawIds = idsQuery.getResultList();
        if (rawIds.isEmpty()) {
            return new PageImpl<>(List.of(), clampedPageable, total);
        }

        List<Long> eventIds = rawIds.stream()
                .map(id -> ((Number) id).longValue())
                .toList();

        List<TrackingEvent> events = entityManager.createQuery("""
                SELECT e FROM TrackingEvent e
                JOIN FETCH e.parcelUnit pu
                JOIN FETCH pu.shipment s
                LEFT JOIN FETCH e.staff u
                LEFT JOIN FETCH e.vehicle v
                WHERE e.eventId IN :eventIds
                ORDER BY e.eventTimestamp DESC, e.eventId DESC
                """, TrackingEvent.class)
                .setParameter("eventIds", eventIds)
                .getResultList();

        Map<Long, TrackingEvent> eventMap = events.stream()
                .collect(Collectors.toMap(TrackingEvent::getEventId, Function.identity()));
        List<TrackingEvent> orderedEvents = eventIds.stream()
                .map(eventMap::get)
                .filter(Objects::nonNull)
                .toList();

        return new PageImpl<>(orderedEvents, clampedPageable, total);
    }
}
