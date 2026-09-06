package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.DashboardSummaryResponse;
import com.tnl.logistics.dto.WeeklyCollectionsResponse;
import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.TrackingEvent;
import com.tnl.logistics.repository.ParcelUnitRepository;
import com.tnl.logistics.repository.ShipmentRepository;
import com.tnl.logistics.repository.TrackingEventRepository;
import com.tnl.logistics.service.CollectionsService;
import com.tnl.logistics.service.DashboardService;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service implementation for live operations dashboard aggregations.
 * Executes database-level SQL/JPQL aggregate queries for sub-15ms performance.
 */
@Service
@Transactional(readOnly = true)
public class DashboardServiceImpl implements DashboardService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("h:mm a");

    private final ShipmentRepository shipmentRepository;
    private final ParcelUnitRepository parcelUnitRepository;
    private final TrackingEventRepository trackingEventRepository;
    private final CollectionsService collectionsService;

    public DashboardServiceImpl(
            ShipmentRepository shipmentRepository,
            ParcelUnitRepository parcelUnitRepository,
            TrackingEventRepository trackingEventRepository,
            CollectionsService collectionsService) {
        this.shipmentRepository = shipmentRepository;
        this.parcelUnitRepository = parcelUnitRepository;
        this.trackingEventRepository = trackingEventRepository;
        this.collectionsService = collectionsService;
    }

    @Override
    public DashboardSummaryResponse getDashboardSummary() {
        // 1. Total counts
        long shipmentCount = shipmentRepository.count();
        long parcelCount = parcelUnitRepository.count();

        // 2. Today's shipments
        LocalDate today = LocalDate.now();
        LocalDateTime todayStart = today.atStartOfDay();
        LocalDateTime todayEnd = today.atTime(23, 59, 59, 999999999);
        long todayShipmentCount = shipmentRepository.countShipmentsRegisteredBetween(todayStart, todayEnd);
        String todayDateFormatted = today.format(DATE_FORMATTER);

        // 3. Unpaid transactions count
        long unpaidTransactionCount = shipmentRepository.countUnpaidShipments();

        // 4. Thursday weekly collection metrics
        DashboardSummaryResponse.ForCollectionDto forCollection;
        try {
            WeeklyCollectionsResponse weeklyResponse = collectionsService.getWeeklyCollections(null);
            BigDecimal amount = (weeklyResponse != null && weeklyResponse.getOutstandingBalance() != null)
                    ? weeklyResponse.getOutstandingBalance()
                    : BigDecimal.ZERO;
            int clientCount = weeklyResponse != null ? weeklyResponse.getActiveClientsCount() : 0;
            forCollection = new DashboardSummaryResponse.ForCollectionDto(amount, clientCount, "Thu");
        } catch (Exception e) {
            forCollection = new DashboardSummaryResponse.ForCollectionDto(BigDecimal.ZERO, 0, "Thu");
        }

        // 5. Parcel units status breakdown
        List<Object[]> statusRows = parcelUnitRepository.countParcelsGroupedByStatus();
        Map<ParcelStatus, Long> statusCounts = new EnumMap<>(ParcelStatus.class);
        for (Object[] row : statusRows) {
            if (row[0] instanceof ParcelStatus) {
                statusCounts.put((ParcelStatus) row[0], ((Number) row[1]).longValue());
            }
        }
        List<DashboardSummaryResponse.StatusSegmentDto> parcelUnitsByStatus = new ArrayList<>();
        parcelUnitsByStatus.add(new DashboardSummaryResponse.StatusSegmentDto(
                "Registered", statusCounts.getOrDefault(ParcelStatus.REGISTERED, 0L), "#2563EB"));
        parcelUnitsByStatus.add(new DashboardSummaryResponse.StatusSegmentDto(
                "QR Generated", statusCounts.getOrDefault(ParcelStatus.QR_GENERATED, 0L), "#0D9488"));
        parcelUnitsByStatus.add(new DashboardSummaryResponse.StatusSegmentDto(
                "Loaded on Truck", statusCounts.getOrDefault(ParcelStatus.LOADED_ON_TRUCK, 0L), "#D97706"));
        parcelUnitsByStatus.add(new DashboardSummaryResponse.StatusSegmentDto(
                "Outload / Arrive TNL", statusCounts.getOrDefault(ParcelStatus.ARRIVED_AT_TNL, 0L), "#16A34A"));
        parcelUnitsByStatus.add(new DashboardSummaryResponse.StatusSegmentDto(
                "Loaded to Hauler", statusCounts.getOrDefault(ParcelStatus.LOADED_TO_HAULER, 0L), "#7C3AED"));
        if (statusCounts.getOrDefault(ParcelStatus.COMPLETED, 0L) > 0) {
            parcelUnitsByStatus.add(new DashboardSummaryResponse.StatusSegmentDto(
                    "Completed", statusCounts.get(ParcelStatus.COMPLETED), "#059669"));
        }

        // 6. Weekly shipment volume (Monday through Sunday)
        LocalDate monday = today.with(DayOfWeek.MONDAY);
        LocalDate sunday = today.with(DayOfWeek.SUNDAY);
        List<Object[]> dailyRows = shipmentRepository.countDailyShipmentsBetween(
                monday.atStartOfDay(), sunday.atTime(23, 59, 59, 999999999));
        Map<LocalDate, Long> dailyMap = new HashMap<>();
        for (Object[] row : dailyRows) {
            LocalDate date = null;
            if (row[0] instanceof java.sql.Date) {
                date = ((java.sql.Date) row[0]).toLocalDate();
            } else if (row[0] instanceof LocalDate) {
                date = (LocalDate) row[0];
            } else if (row[0] != null) {
                try {
                    date = LocalDate.parse(row[0].toString());
                } catch (Exception ignored) {}
            }
            if (date != null) {
                dailyMap.put(date, ((Number) row[1]).longValue());
            }
        }
        String[] dayLabels = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"};
        List<DashboardSummaryResponse.VolumePointDto> weeklyShipmentVolume = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            LocalDate dayDate = monday.plusDays(i);
            long volume = dailyMap.getOrDefault(dayDate, 0L);
            weeklyShipmentVolume.add(new DashboardSummaryResponse.VolumePointDto(dayLabels[i], volume));
        }

        // 7. Financial comparison (Outstanding vs Collected)
        BigDecimal totalCharges = shipmentRepository.sumTotalShipmentCharges();
        BigDecimal totalCollected = shipmentRepository.sumTotalPayments();
        BigDecimal outstanding = totalCharges.subtract(totalCollected);
        if (outstanding.compareTo(BigDecimal.ZERO) < 0) {
            outstanding = BigDecimal.ZERO;
        }
        List<DashboardSummaryResponse.ComparisonRowDto> outstandingVsCollected = new ArrayList<>();
        outstandingVsCollected.add(new DashboardSummaryResponse.ComparisonRowDto("Outstanding", outstanding, "#DC2626"));
        outstandingVsCollected.add(new DashboardSummaryResponse.ComparisonRowDto("Collected", totalCollected, "#16A34A"));

        // 8. Recent tracking events stream
        List<TrackingEvent> recentEvents = trackingEventRepository.findRecentEvents(PageRequest.of(0, 5));
        List<DashboardSummaryResponse.RecentActivityDto> recentActivity = recentEvents.stream().map(event -> {
            String dateStr = event.getEventTimestamp() != null ? event.getEventTimestamp().format(DATE_FORMATTER) : "—";
            String timeStr = event.getEventTimestamp() != null ? event.getEventTimestamp().format(TIME_FORMATTER) : "—";
            String actionStr = formatStatus(event.getStatus());
            String trackingId = event.getParcelUnit() != null ? event.getParcelUnit().getTrackingId() : "—";

            int seq = (event.getParcelUnit() != null && event.getParcelUnit().getSeq() != null)
                    ? event.getParcelUnit().getSeq() : 1;
            int totalQty = (event.getParcelUnit() != null && event.getParcelUnit().getShipment() != null
                    && event.getParcelUnit().getShipment().getQuantity() != null)
                    ? event.getParcelUnit().getShipment().getQuantity() : 1;
            String staffName = (event.getStaff() != null && event.getStaff().getFullName() != null)
                    ? event.getStaff().getFullName() : "Office Staff";

            String meta = String.format("Pkg %d/%d — by %s", seq, totalQty, staffName);

            return new DashboardSummaryResponse.RecentActivityDto(dateStr, timeStr, actionStr, trackingId, meta);
        }).collect(Collectors.toList());

        return new DashboardSummaryResponse(
                shipmentCount,
                parcelCount,
                todayShipmentCount,
                todayDateFormatted,
                unpaidTransactionCount,
                forCollection,
                parcelUnitsByStatus,
                weeklyShipmentVolume,
                outstandingVsCollected,
                recentActivity
        );
    }

    private String formatStatus(ParcelStatus status) {
        if (status == null) return "Registered";
        switch (status) {
            case QR_GENERATED: return "QR Generated";
            case LOADED_ON_TRUCK: return "Loaded on Truck";
            case ARRIVED_AT_TNL: return "Arrived at TNL";
            case LOADED_TO_HAULER: return "Loaded to Hauler";
            case COMPLETED: return "Completed";
            case REGISTERED:
            default: return "Registered";
        }
    }
}
