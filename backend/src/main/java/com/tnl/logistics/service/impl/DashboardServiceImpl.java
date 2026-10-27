package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.CollectionTotals;
import com.tnl.logistics.dto.DashboardSummaryResponse;
import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.TrackingEvent;
import com.tnl.logistics.repository.CycleShipmentSummary;
import com.tnl.logistics.repository.ParcelUnitRepository;
import com.tnl.logistics.repository.ShipmentRepository;
import com.tnl.logistics.repository.TrackingEventRepository;
import com.tnl.logistics.service.CollectionsService;
import com.tnl.logistics.service.DashboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service implementation for live operations dashboard aggregations.
 * Executes database-level SQL/JPQL aggregates for live totals.
 */
@Service
@Transactional(readOnly = true)
public class DashboardServiceImpl implements DashboardService {

    private static final ZoneId MANILA_ZONE = ZoneId.of("Asia/Manila");
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("h:mm a");

    private final ShipmentRepository shipmentRepository;
    private final ParcelUnitRepository parcelUnitRepository;
    private final TrackingEventRepository trackingEventRepository;
    private final CollectionsService collectionsService;
    private final Clock clock;

    public DashboardServiceImpl(
            ShipmentRepository shipmentRepository,
            ParcelUnitRepository parcelUnitRepository,
            TrackingEventRepository trackingEventRepository,
            CollectionsService collectionsService,
            @Autowired(required = false) Clock clock) {
        this.shipmentRepository = shipmentRepository;
        this.parcelUnitRepository = parcelUnitRepository;
        this.trackingEventRepository = trackingEventRepository;
        this.collectionsService = collectionsService;
        this.clock = (clock != null) ? clock : Clock.system(MANILA_ZONE);
    }

    @Override
    public DashboardSummaryResponse getDashboardSummary() {
        return getDashboardSummary(null);
    }

    @Override
    public DashboardSummaryResponse getDashboardSummary(LocalDate targetCycleDate) {
        try {
            LocalDate today = LocalDate.now(clock.withZone(MANILA_ZONE));
            LocalDate activeCycleEnd = (targetCycleDate != null)
                    ? targetCycleDate
                    : collectionsService.calculateActiveCycleDate(today);

            LocalDate cycleStartLocalDate = collectionsService.calculateCycleStartDate(activeCycleEnd);
            LocalDateTime cycleStart = cycleStartLocalDate.atStartOfDay();
            LocalDateTime cycleEnd = activeCycleEnd.atStartOfDay();

            // 1. Cycle-scoped counts and charges consolidated into single aggregate
            CycleShipmentSummary cycleSummary = shipmentRepository.getCycleShipmentSummary(
                    cycleStart, cycleEnd);
            long shipmentCount = (cycleSummary != null && cycleSummary.getShipmentCount() != null)
                    ? cycleSummary.getShipmentCount() : 0L;
            long parcelCount = (cycleSummary != null && cycleSummary.getParcelCount() != null)
                    ? cycleSummary.getParcelCount() : 0L;
            BigDecimal totalCharges = (cycleSummary != null && cycleSummary.getTotalCharges() != null)
                    ? cycleSummary.getTotalCharges() : BigDecimal.ZERO;

            // 2. Today's shipments
            LocalDateTime todayStart = today.atStartOfDay();
            LocalDateTime todayEnd = today.plusDays(1).atStartOfDay();
            long todayShipmentCount = shipmentRepository.countShipmentsRegisteredBetween(todayStart, todayEnd);
            String todayDateFormatted = today.format(DATE_FORMATTER);

            // 3. Cycle-scoped unpaid transactions count
            long unpaidTransactionCount = (cycleSummary != null && cycleSummary.getUnpaidShipmentCount() != null)
                    ? cycleSummary.getUnpaidShipmentCount() : 0L;

            // 4. Weekly collection metrics aligned to active billing cycle using internal totals read
            DayOfWeek collectionDay = collectionsService.getCollectionDayOfWeek();
            String collectionDayShort = collectionDay != null
                    ? collectionDay.getDisplayName(TextStyle.SHORT, Locale.ENGLISH)
                    : "Thu";
            CollectionTotals totals = collectionsService.getCollectionTotals(activeCycleEnd, cycleStartLocalDate);
            BigDecimal amount = (totals != null && totals.outstandingBalance() != null)
                    ? totals.outstandingBalance()
                    : BigDecimal.ZERO;
            int clientCount = totals != null ? totals.activeClientsCount() : 0;
            DashboardSummaryResponse.ForCollectionDto forCollection =
                    new DashboardSummaryResponse.ForCollectionDto(amount, clientCount, collectionDayShort);

            // 5. Parcel units status breakdown for this cycle
            List<Object[]> statusRows = parcelUnitRepository.countParcelsGroupedByLossAndStatusBetween(cycleStart, cycleEnd);
            Map<ParcelStatus, Long> statusCounts = new EnumMap<>(ParcelStatus.class);
            long lostCount = 0L;
            for (Object[] row : statusRows) {
                long count = ((Number) row[2]).longValue();
                if (Boolean.TRUE.equals(row[0])) {
                    lostCount += count;
                } else if (row[1] instanceof ParcelStatus parcelStatus) {
                    statusCounts.put(parcelStatus, count);
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
            if (lostCount > 0) {
                parcelUnitsByStatus.add(new DashboardSummaryResponse.StatusSegmentDto("Lost", lostCount, "#B91C1C"));
            }

            // 6. Weekly shipment volume aligned to active 7-day billing cycle
            List<Object[]> dailyRows = shipmentRepository.countDailyShipmentsBetween(cycleStart, cycleEnd);
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
            List<DashboardSummaryResponse.VolumePointDto> weeklyShipmentVolume = new ArrayList<>();
            for (int i = 0; i < 7; i++) {
                LocalDate dayDate = cycleStart.toLocalDate().plusDays(i);
                String dayLabel = dayDate.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
                long volume = dailyMap.getOrDefault(dayDate, 0L);
                weeklyShipmentVolume.add(new DashboardSummaryResponse.VolumePointDto(dayLabel, volume));
            }

            // 7. Financial comparison (Outstanding vs Collected) for this cycle
            BigDecimal totalCollected = (cycleSummary != null && cycleSummary.getCollectedPayments() != null)
                    ? cycleSummary.getCollectedPayments() : BigDecimal.ZERO;
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
        } catch (DataAccessException ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "DASHBOARD_UNAVAILABLE: Dashboard data is temporarily unavailable due to a database error",
                    ex);
        }
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
