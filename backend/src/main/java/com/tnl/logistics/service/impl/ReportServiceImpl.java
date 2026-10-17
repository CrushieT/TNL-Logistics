package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.CollectionsService;
import com.tnl.logistics.service.ReportService;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Production implementation of the Operational and Financial Reports engine.
 * Computes bounded aggregates and projections in SQL to preserve application memory.
 */
@Service
public class ReportServiceImpl implements ReportService {

    private static final DateTimeFormatter DATE_LABEL_FORMATTER = DateTimeFormatter.ofPattern("EEE, MMM d");

    private final ShipmentRepository shipmentRepository;
    private final ParcelUnitRepository parcelUnitRepository;
    private final PaymentRepository paymentRepository;
    private final SoaRepository soaRepository;
    private final ClientRepository clientRepository;
    private final CollectionsService collectionsService;
    private final java.time.Clock clock;

    public ReportServiceImpl(ShipmentRepository shipmentRepository,
                             ParcelUnitRepository parcelUnitRepository,
                             PaymentRepository paymentRepository,
                             SoaRepository soaRepository,
                             ClientRepository clientRepository,
                             CollectionsService collectionsService,
                             java.time.Clock clock) {
        this.shipmentRepository = shipmentRepository;
        this.parcelUnitRepository = parcelUnitRepository;
        this.paymentRepository = paymentRepository;
        this.soaRepository = soaRepository;
        this.clientRepository = clientRepository;
        this.collectionsService = collectionsService;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public ReportSummaryResponse getReportSummary(LocalDate startDate, LocalDate endDate) {
        try {
            return computeReportSummary(startDate, endDate);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (DataAccessException ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "REPORT_UNAVAILABLE: Financial report calculation is temporarily unavailable",
                    ex);
        }
    }

    private ReportSummaryResponse computeReportSummary(LocalDate startDate, LocalDate endDate) {
        LocalDate today = LocalDate.now(clock);
        LocalDate resolvedEnd = (endDate != null) ? endDate : today;
        LocalDate resolvedStart = (startDate != null) ? startDate : resolvedEnd.withDayOfMonth(1);

        if (resolvedStart.isAfter(resolvedEnd)) {
            LocalDate temp = resolvedStart;
            resolvedStart = resolvedEnd;
            resolvedEnd = temp;
        }

        LocalDateTime startDateTime = resolvedStart.atStartOfDay();
        LocalDateTime endDateTime = resolvedEnd.atTime(23, 59, 59, 999999999);

        // 1. Period Shipment Aggregates (Billed Revenue & Shipments Count)
        PeriodShipmentTotals periodShipmentTotals = shipmentRepository.getPeriodShipmentTotals(startDateTime, endDateTime);
        BigDecimal totalBilled = periodShipmentTotals != null && periodShipmentTotals.getTotalBilled() != null
                ? periodShipmentTotals.getTotalBilled()
                : BigDecimal.ZERO;
        long totalShipmentsCount = periodShipmentTotals != null ? periodShipmentTotals.getTotalShipments() : 0L;

        // 2. Period Collected Revenue (cash-based: payment_date between resolvedStart and resolvedEnd)
        BigDecimal totalCollected = paymentRepository.sumAmountPaidBetween(resolvedStart, resolvedEnd);
        if (totalCollected == null) {
            totalCollected = BigDecimal.ZERO;
        }

        // 3. Operational Parcel Distribution and Delivery Metrics
        List<DailyParcelTotals> parcelRows = parcelUnitRepository.aggregateDailyParcels(startDateTime, endDateTime);
        Map<String, Long> statusCounts = new HashMap<>();
        Map<LocalDate, List<DailyParcelTotals>> parcelsByDate = new HashMap<>();
        long lostParcelsCount = 0L;
        long completedParcelsCount = 0L;
        long totalParcelsCount = 0L;

        for (DailyParcelTotals parcelRow : parcelRows) {
            long count = parcelRow.getParcelsCount();
            totalParcelsCount += count;
            if (parcelRow.getLostFlag().intValue() != 0) {
                lostParcelsCount += count;
            } else {
                statusCounts.merge(parcelRow.getCurrentStatus(), count, Long::sum);
            }
            if (ParcelStatus.COMPLETED.name().equals(parcelRow.getCurrentStatus())) {
                completedParcelsCount += count;
            }
            LocalDate regDate = extractLocalDate(parcelRow.getRegDate());
            if (regDate != null) {
                parcelsByDate.computeIfAbsent(regDate, ignored -> new ArrayList<>()).add(parcelRow);
            }
        }

        double deliveryCompletionRate = totalParcelsCount > 0
                ? BigDecimal.valueOf((double) completedParcelsCount * 100.0 / totalParcelsCount)
                .setScale(1, RoundingMode.HALF_UP).doubleValue()
                : 0.0;

        // 4. Lifetime Accounts Receivable Aging and Live Balances via Bounded SQL Aggregation
        List<ClientAgingProjection> agingProjections = shipmentRepository.aggregateClientReceivablesAging(today);

        List<ReceivablesAgingReportRow> agingRows = new ArrayList<>(agingProjections.size());
        Map<String, BigDecimal> clientLiveBalances = new HashMap<>();
        Map<String, BigDecimal> clientLiveOpenPaid = new HashMap<>();
        BigDecimal liveOutstandingReceivables = BigDecimal.ZERO;

        for (ClientAgingProjection projection : agingProjections) {
            String clientId = projection.getClientId();
            BigDecimal clientTotalOutstanding = projection.getTotalOutstanding() != null
                    ? projection.getTotalOutstanding()
                    : BigDecimal.ZERO;
            BigDecimal openPaid = projection.getOpenPaid() != null
                    ? projection.getOpenPaid()
                    : BigDecimal.ZERO;

            liveOutstandingReceivables = liveOutstandingReceivables.add(clientTotalOutstanding);
            clientLiveBalances.put(clientId, clientTotalOutstanding);
            clientLiveOpenPaid.put(clientId, openPaid);

            agingRows.add(new ReceivablesAgingReportRow(
                    clientId,
                    projection.getClientName(),
                    projection.getClientContact() != null ? projection.getClientContact() : "",
                    projection.getUnpaidShipmentsCount(),
                    projection.getCurrentDue() != null ? projection.getCurrentDue() : BigDecimal.ZERO,
                    projection.getPastDue() != null ? projection.getPastDue() : BigDecimal.ZERO,
                    projection.getOverdue() != null ? projection.getOverdue() : BigDecimal.ZERO,
                    clientTotalOutstanding
            ));
        }

        // 5. Construct Top 5 KPIs
        ReportKpiResponse kpis = new ReportKpiResponse(
                totalBilled,
                totalCollected,
                liveOutstandingReceivables,
                totalShipmentsCount,
                totalParcelsCount,
                deliveryCompletionRate
        );

        // 6. Client Revenue Breakdown (Period Charges & Collections with Live Balances)
        List<ClientPeriodShipmentTotals> clientShipments =
                shipmentRepository.aggregateClientPeriodShipments(startDateTime, endDateTime);
        Map<String, ClientPeriodShipmentTotals> shipmentsByClient = clientShipments.stream()
                .collect(Collectors.toMap(ClientPeriodShipmentTotals::getClientId, s -> s, (a, b) -> a));

        List<ClientPeriodPaymentTotals> clientPayments =
                paymentRepository.aggregateClientPeriodPayments(resolvedStart, resolvedEnd);
        Map<String, BigDecimal> paymentsByClient = clientPayments.stream()
                .collect(Collectors.toMap(
                        ClientPeriodPaymentTotals::getClientId,
                        p -> p.getTotalPaid() != null ? p.getTotalPaid() : BigDecimal.ZERO,
                        BigDecimal::add
                ));

        List<Client> allClients = clientRepository.findAll();
        List<ClientRevenueReportRow> clientRevenueRows = new ArrayList<>();
        for (Client client : allClients) {
            String clientId = client.getClientId();
            ClientPeriodShipmentTotals cTotals = shipmentsByClient.get(clientId);
            long clientShipmentCount = (cTotals != null) ? cTotals.getTotalShipments() : 0L;
            BigDecimal clientBilled = (cTotals != null && cTotals.getTotalBilled() != null)
                    ? cTotals.getTotalBilled()
                    : BigDecimal.ZERO;

            BigDecimal clientPaid = paymentsByClient.getOrDefault(clientId, BigDecimal.ZERO);
            BigDecimal liveBalance = clientLiveBalances.getOrDefault(clientId, BigDecimal.ZERO);

            boolean hasPeriodActivity = clientShipmentCount > 0 || clientPaid.compareTo(BigDecimal.ZERO) > 0;
            boolean hasLiveBalance = liveBalance.compareTo(BigDecimal.ZERO) > 0;

            if (!hasPeriodActivity && !hasLiveBalance) {
                continue;
            }

            String paymentStatus;
            if (liveBalance.compareTo(BigDecimal.ZERO) == 0) {
                paymentStatus = "PAID";
            } else {
                BigDecimal openPaid = clientLiveOpenPaid.getOrDefault(clientId, BigDecimal.ZERO);
                if (openPaid.compareTo(BigDecimal.ZERO) > 0 || clientPaid.compareTo(BigDecimal.ZERO) > 0) {
                    paymentStatus = "PARTIAL";
                } else {
                    paymentStatus = "UNPAID";
                }
            }

            clientRevenueRows.add(new ClientRevenueReportRow(
                    clientId,
                    client.getName(),
                    clientShipmentCount,
                    clientBilled,
                    clientPaid,
                    liveBalance,
                    paymentStatus
            ));
        }

        clientRevenueRows.sort(
                Comparator.comparing(ClientRevenueReportRow::getTotalBilled).reversed()
                        .thenComparing(ClientRevenueReportRow::getBalance, Comparator.reverseOrder())
        );

        // 7. Active Thursday Collection Summary (from CollectionsService)
        WeeklyCollectionsResponse collectionSummary = collectionsService.getWeeklyCollections(null);

        // 8. Payment Methods Breakdown
        List<PaymentMethodTotals> methodTotals =
                paymentRepository.aggregatePaymentMethodsBetween(resolvedStart, resolvedEnd);
        Map<String, PaymentMethodTotals> totalsByMethod = methodTotals.stream()
                .collect(Collectors.toMap(PaymentMethodTotals::getMethod, m -> m, (a, b) -> a));

        List<PaymentMethodReportRow> paymentMethodRows = new ArrayList<>();
        for (PaymentMethod method : PaymentMethod.values()) {
            PaymentMethodTotals mTotals = totalsByMethod.get(method.name());
            long count = mTotals != null ? mTotals.getCount() : 0L;
            BigDecimal methodTotal = (mTotals != null && mTotals.getTotalAmount() != null)
                    ? mTotals.getTotalAmount()
                    : BigDecimal.ZERO;

            double percentage = totalCollected.compareTo(BigDecimal.ZERO) > 0
                    ? methodTotal.multiply(BigDecimal.valueOf(100)).divide(totalCollected, 1, RoundingMode.HALF_UP).doubleValue()
                    : 0.0;

            paymentMethodRows.add(new PaymentMethodReportRow(method.name(), count, methodTotal, percentage));
        }

        // 9. Deductions Breakdown (from SOAs in period)
        List<DeductionCategoryTotals> deductionTotals =
                soaRepository.aggregateDeductionsBetween(resolvedStart, resolvedEnd);
        Map<String, DeductionCategoryTotals> totalsByCategory = deductionTotals.stream()
                .collect(Collectors.toMap(DeductionCategoryTotals::getCategory, d -> d, (a, b) -> a));

        List<DeductionReportRow> deductionRows = new ArrayList<>();
        for (String cat : Arrays.asList("BAD_ORDER", "DISCREPANCY", "CLAIM")) {
            DeductionCategoryTotals dTotals = totalsByCategory.get(cat);
            long count = dTotals != null ? dTotals.getCount() : 0L;
            BigDecimal amount = (dTotals != null && dTotals.getTotalAmount() != null)
                    ? dTotals.getTotalAmount()
                    : BigDecimal.ZERO;
            deductionRows.add(new DeductionReportRow(cat, count, amount));
        }

        // 10. Daily Volume Breakdown
        List<DailyShipmentTotals> dailyShipments =
                shipmentRepository.aggregateDailyShipments(startDateTime, endDateTime);
        Map<LocalDate, Long> shipmentsByDate = new HashMap<>();
        for (DailyShipmentTotals dst : dailyShipments) {
            LocalDate regDate = extractLocalDate(dst.getRegDate());
            if (regDate != null) {
                shipmentsByDate.put(regDate, dst.getShipmentsCount());
            }
        }

        List<DailyVolumeReportRow> dailyVolumeRows = new ArrayList<>();
        LocalDate walker = resolvedStart;
        while (!walker.isAfter(resolvedEnd)) {
            long dayShipmentsCount = shipmentsByDate.getOrDefault(walker, 0L);
            List<DailyParcelTotals> dayRows = parcelsByDate.getOrDefault(walker, List.of());
            long dayParcelsCount = 0L;
            BigDecimal dayWeight = BigDecimal.ZERO;
            BigDecimal dayVolume = BigDecimal.ZERO;
            long dayCompleted = 0L;
            for (DailyParcelTotals parcelRow : dayRows) {
                long count = parcelRow.getParcelsCount();
                dayParcelsCount += count;
                if (parcelRow.getTotalWeightKg() != null) {
                    dayWeight = dayWeight.add(parcelRow.getTotalWeightKg());
                }
                if (parcelRow.getTotalVolumeCbm() != null) {
                    dayVolume = dayVolume.add(parcelRow.getTotalVolumeCbm());
                }
                if (ParcelStatus.COMPLETED.name().equals(parcelRow.getCurrentStatus())) {
                    dayCompleted += count;
                }
            }

            dailyVolumeRows.add(new DailyVolumeReportRow(
                    walker,
                    walker.format(DATE_LABEL_FORMATTER),
                    dayShipmentsCount,
                    dayParcelsCount,
                    dayWeight,
                    dayVolume,
                    dayCompleted
            ));

            walker = walker.plusDays(1);
        }

        // 11. Status Distribution
        List<StatusDistributionReportRow> statusDistributionRows = new ArrayList<>();
        for (ParcelStatus status : ParcelStatus.values()) {
            long count = statusCounts.getOrDefault(status.name(), 0L);
            double pct = totalParcelsCount > 0
                    ? BigDecimal.valueOf((double) count * 100.0 / totalParcelsCount).setScale(1, RoundingMode.HALF_UP).doubleValue()
                    : 0.0;
            statusDistributionRows.add(new StatusDistributionReportRow(
                    status.name(),
                    formatStatusDisplay(status),
                    count,
                    pct
            ));
        }

        double lostPercentage = totalParcelsCount > 0
                ? BigDecimal.valueOf((double) lostParcelsCount * 100.0 / totalParcelsCount)
                .setScale(1, RoundingMode.HALF_UP).doubleValue()
                : 0.0;
        statusDistributionRows.add(new StatusDistributionReportRow("LOST", "Lost", lostParcelsCount, lostPercentage));

        return new ReportSummaryResponse(
                resolvedStart,
                resolvedEnd,
                LocalDateTime.now(clock),
                kpis,
                clientRevenueRows,
                collectionSummary,
                paymentMethodRows,
                deductionRows,
                dailyVolumeRows,
                statusDistributionRows,
                agingRows
        );
    }

    private String formatStatusDisplay(ParcelStatus status) {
        switch (status) {
            case REGISTERED: return "Registered";
            case QR_GENERATED: return "QR Generated";
            case LOADED_ON_TRUCK: return "Loaded on Truck";
            case ARRIVED_AT_TNL: return "Arrived at TNL Hub";
            case LOADED_TO_HAULER: return "Loaded to Hauler";
            case COMPLETED: return "Completed Delivery";
            default: return status.name();
        }
    }

    private static LocalDate extractLocalDate(Object dateObj) {
        if (dateObj == null) {
            return null;
        }
        if (dateObj instanceof LocalDate) {
            return (LocalDate) dateObj;
        }
        if (dateObj instanceof java.sql.Date) {
            return ((java.sql.Date) dateObj).toLocalDate();
        }
        if (dateObj instanceof java.sql.Timestamp) {
            return ((java.sql.Timestamp) dateObj).toLocalDateTime().toLocalDate();
        }
        if (dateObj instanceof LocalDateTime) {
            return ((LocalDateTime) dateObj).toLocalDate();
        }
        return LocalDate.parse(dateObj.toString());
    }
}
