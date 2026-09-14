package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.CollectionsService;
import com.tnl.logistics.service.ReportService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Production implementation of the Operational and Financial Reports engine.
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

        // 1. Fetch Shipments within period (for period billed revenue and operational breakdown)
        List<Shipment> periodShipments = shipmentRepository.findByDateRegisteredBetweenOrderByDateRegisteredDesc(startDateTime, endDateTime);
        List<String> shipmentIds = periodShipments.stream().map(Shipment::getShipmentId).collect(Collectors.toList());

        // 2. Fetch Payments recorded within period (cash-based: paymentDate between resolvedStart and resolvedEnd)
        List<Payment> periodPayments = paymentRepository.findByPaymentDateBetween(resolvedStart, resolvedEnd);

        // 3. Fetch Parcels for period shipments
        List<ParcelUnit> periodParcels = shipmentIds.isEmpty()
                ? Collections.emptyList()
                : parcelUnitRepository.findByShipment_ShipmentIdInOrderBySeqAsc(shipmentIds);

        // 4. Lifetime Accounts Receivable Aging and Live Balances via Repository Aggregate Projection
        List<Object[]> unpaidShipmentsData = shipmentRepository.findUnpaidShipmentsWithPayments();

        Map<String, ClientAgingAccumulator> clientAgingMap = new LinkedHashMap<>();
        Map<String, BigDecimal> clientLiveBalances = new HashMap<>();
        Map<String, BigDecimal> clientLiveOpenPaid = new HashMap<>();
        BigDecimal liveOutstandingReceivables = BigDecimal.ZERO;

        for (Object[] row : unpaidShipmentsData) {
            String shipmentId = (String) row[0];
            String clientId = (String) row[1];
            String clientName = (String) row[2];
            String clientContact = (String) row[3];

            LocalDate regDate = today;
            if (row[4] instanceof LocalDateTime) {
                regDate = ((LocalDateTime) row[4]).toLocalDate();
            } else if (row[4] instanceof java.sql.Timestamp) {
                regDate = ((java.sql.Timestamp) row[4]).toLocalDateTime().toLocalDate();
            } else if (row[4] instanceof LocalDate) {
                regDate = (LocalDate) row[4];
            }

            BigDecimal sBilled = BigDecimal.ZERO;
            if (row[5] instanceof BigDecimal) {
                sBilled = (BigDecimal) row[5];
            } else if (row[5] != null) {
                sBilled = new BigDecimal(row[5].toString());
            }

            BigDecimal sPaid = BigDecimal.ZERO;
            if (row[6] instanceof BigDecimal) {
                sPaid = (BigDecimal) row[6];
            } else if (row[6] != null) {
                sPaid = new BigDecimal(row[6].toString());
            }

            BigDecimal sBalance = sBilled.subtract(sPaid);
            if (sBalance.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            liveOutstandingReceivables = liveOutstandingReceivables.add(sBalance);
            clientLiveBalances.put(clientId, clientLiveBalances.getOrDefault(clientId, BigDecimal.ZERO).add(sBalance));
            clientLiveOpenPaid.put(clientId, clientLiveOpenPaid.getOrDefault(clientId, BigDecimal.ZERO).add(sPaid));

            ClientAgingAccumulator acc = clientAgingMap.computeIfAbsent(clientId,
                    k -> new ClientAgingAccumulator(clientId, clientName, clientContact));
            acc.unpaidShipmentsCount++;

            long ageDays = ChronoUnit.DAYS.between(regDate, today);
            if (ageDays <= 7) {
                acc.currentDue = acc.currentDue.add(sBalance);
            } else if (ageDays <= 14) {
                acc.pastDue = acc.pastDue.add(sBalance);
            } else {
                acc.overdue = acc.overdue.add(sBalance);
            }
        }

        List<ReceivablesAgingReportRow> agingRows = new ArrayList<>();
        for (ClientAgingAccumulator acc : clientAgingMap.values()) {
            BigDecimal totalOut = acc.currentDue.add(acc.pastDue).add(acc.overdue);
            if (totalOut.compareTo(BigDecimal.ZERO) > 0) {
                agingRows.add(new ReceivablesAgingReportRow(
                        acc.clientId,
                        acc.clientName,
                        acc.clientContact,
                        acc.unpaidShipmentsCount,
                        acc.currentDue,
                        acc.pastDue,
                        acc.overdue,
                        totalOut
                ));
            }
        }
        agingRows.sort(Comparator.comparing(ReceivablesAgingReportRow::getTotalOutstanding).reversed());

        // 5. Calculate Top 5 KPIs
        BigDecimal totalBilled = periodShipments.stream()
                .map(s -> s.getTotalAmount() != null ? s.getTotalAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCollected = periodPayments.stream()
                .map(p -> p.getAmountPaid() != null ? p.getAmountPaid() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long totalShipmentsCount = periodShipments.size();
        long totalParcelsCount = periodParcels.size();

        long completedParcelsCount = periodParcels.stream()
                .filter(p -> p.getCurrentStatus() == ParcelStatus.COMPLETED)
                .count();

        double deliveryCompletionRate = totalParcelsCount > 0
                ? BigDecimal.valueOf((double) completedParcelsCount * 100.0 / totalParcelsCount)
                .setScale(1, RoundingMode.HALF_UP).doubleValue()
                : 0.0;

        ReportKpiResponse kpis = new ReportKpiResponse(
                totalBilled,
                totalCollected,
                liveOutstandingReceivables,
                totalShipmentsCount,
                totalParcelsCount,
                deliveryCompletionRate
        );

        // 6. Client Revenue Breakdown (Period Charges & Collections with Live Balances)
        Map<String, List<Shipment>> shipmentsByClient = periodShipments.stream()
                .filter(s -> s.getClient() != null)
                .collect(Collectors.groupingBy(s -> s.getClient().getClientId()));

        Map<String, BigDecimal> paymentsByClient = periodPayments.stream()
                .filter(p -> p.getShipment() != null && p.getShipment().getClient() != null)
                .collect(Collectors.groupingBy(
                        p -> p.getShipment().getClient().getClientId(),
                        Collectors.reducing(BigDecimal.ZERO, Payment::getAmountPaid, BigDecimal::add)
                ));

        List<Client> allClients = clientRepository.findAll();
        List<ClientRevenueReportRow> clientRevenueRows = new ArrayList<>();
        for (Client client : allClients) {
            String clientId = client.getClientId();
            List<Shipment> cShipments = shipmentsByClient.getOrDefault(clientId, Collections.emptyList());
            BigDecimal clientBilled = cShipments.stream()
                    .map(s -> s.getTotalAmount() != null ? s.getTotalAmount() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal clientPaid = paymentsByClient.getOrDefault(clientId, BigDecimal.ZERO);
            BigDecimal liveBalance = clientLiveBalances.getOrDefault(clientId, BigDecimal.ZERO);

            boolean hasPeriodActivity = !cShipments.isEmpty() || clientPaid.compareTo(BigDecimal.ZERO) > 0;
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
                    cShipments.size(),
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

        // 6. Active Thursday Collection Summary (from CollectionsService)
        WeeklyCollectionsResponse collectionSummary = null;
        try {
            collectionSummary = collectionsService.getWeeklyCollections(null);
        } catch (Exception ignored) {
            // Gracefully handle if weekly collection data is empty
        }

        // 7. Payment Methods Breakdown
        Map<PaymentMethod, List<Payment>> paymentsByMethod = periodPayments.stream()
                .filter(p -> p.getMethod() != null)
                .collect(Collectors.groupingBy(Payment::getMethod));

        List<PaymentMethodReportRow> paymentMethodRows = new ArrayList<>();
        for (PaymentMethod method : PaymentMethod.values()) {
            List<Payment> mPayments = paymentsByMethod.getOrDefault(method, Collections.emptyList());
            long count = mPayments.size();
            BigDecimal methodTotal = mPayments.stream()
                    .map(p -> p.getAmountPaid() != null ? p.getAmountPaid() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            double percentage = totalCollected.compareTo(BigDecimal.ZERO) > 0
                    ? methodTotal.multiply(BigDecimal.valueOf(100)).divide(totalCollected, 1, RoundingMode.HALF_UP).doubleValue()
                    : 0.0;

            paymentMethodRows.add(new PaymentMethodReportRow(method.name(), count, methodTotal, percentage));
        }

        // 8. Deductions Breakdown (from SOAs in period)
        List<Soa> periodSoas = soaRepository.findByStatementDateBetween(resolvedStart, resolvedEnd);
        Map<String, BigDecimal> deductionsByCategory = new HashMap<>();
        deductionsByCategory.put("BAD_ORDER", BigDecimal.ZERO);
        deductionsByCategory.put("DISCREPANCY", BigDecimal.ZERO);
        deductionsByCategory.put("CLAIM", BigDecimal.ZERO);

        Map<String, Long> countByCategory = new HashMap<>();
        countByCategory.put("BAD_ORDER", 0L);
        countByCategory.put("DISCREPANCY", 0L);
        countByCategory.put("CLAIM", 0L);

        for (Soa soa : periodSoas) {
            if (soa.getDeductions() != null && soa.getDeductions().compareTo(BigDecimal.ZERO) > 0) {
                String reason = soa.getDeductionReason() != null ? soa.getDeductionReason().toUpperCase() : "";
                String category = "CLAIM";
                if (reason.contains("BAD") || reason.contains("DAMAGE")) {
                    category = "BAD_ORDER";
                } else if (reason.contains("DISCREPANCY") || reason.contains("SHORT") || reason.contains("WEIGHT")) {
                    category = "DISCREPANCY";
                }

                deductionsByCategory.put(category, deductionsByCategory.get(category).add(soa.getDeductions()));
                countByCategory.put(category, countByCategory.get(category) + 1);
            }
        }

        List<DeductionReportRow> deductionRows = new ArrayList<>();
        for (String cat : Arrays.asList("BAD_ORDER", "DISCREPANCY", "CLAIM")) {
            deductionRows.add(new DeductionReportRow(cat, countByCategory.get(cat), deductionsByCategory.get(cat)));
        }

        // 9. Daily Volume Breakdown
        Map<LocalDate, List<Shipment>> shipmentsByDate = periodShipments.stream()
                .filter(s -> s.getDateRegistered() != null)
                .collect(Collectors.groupingBy(s -> s.getDateRegistered().toLocalDate()));

        Map<String, List<ParcelUnit>> parcelsByShipmentId = periodParcels.stream()
                .filter(p -> p.getShipment() != null)
                .collect(Collectors.groupingBy(p -> p.getShipment().getShipmentId()));

        List<DailyVolumeReportRow> dailyVolumeRows = new ArrayList<>();
        LocalDate walker = resolvedStart;
        while (!walker.isAfter(resolvedEnd)) {
            List<Shipment> dayShipments = shipmentsByDate.getOrDefault(walker, Collections.emptyList());
            long dayShipmentsCount = dayShipments.size();

            List<ParcelUnit> dayParcels = dayShipments.stream()
                    .flatMap(s -> parcelsByShipmentId.getOrDefault(s.getShipmentId(), Collections.emptyList()).stream())
                    .collect(Collectors.toList());

            long dayParcelsCount = dayParcels.size();
            BigDecimal dayWeight = dayParcels.stream()
                    .map(p -> p.getWeightKg() != null ? p.getWeightKg() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal dayVolume = dayParcels.stream()
                    .map(p -> p.getVolumeCbm() != null ? p.getVolumeCbm() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            long dayCompleted = dayParcels.stream()
                    .filter(p -> p.getCurrentStatus() == ParcelStatus.COMPLETED)
                    .count();

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

        // 10. Status Distribution
        Map<ParcelStatus, Long> statusCounts = periodParcels.stream()
                .collect(Collectors.groupingBy(ParcelUnit::getCurrentStatus, Collectors.counting()));

        List<StatusDistributionReportRow> statusDistributionRows = new ArrayList<>();
        for (ParcelStatus status : ParcelStatus.values()) {
            long count = statusCounts.getOrDefault(status, 0L);
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

    private static class ClientAgingAccumulator {
        final String clientId;
        final String clientName;
        final String clientContact;
        long unpaidShipmentsCount = 0;
        BigDecimal currentDue = BigDecimal.ZERO;
        BigDecimal pastDue = BigDecimal.ZERO;
        BigDecimal overdue = BigDecimal.ZERO;

        ClientAgingAccumulator(String clientId, String clientName, String clientContact) {
            this.clientId = clientId;
            this.clientName = clientName;
            this.clientContact = clientContact != null ? clientContact : "";
        }
    }
}
