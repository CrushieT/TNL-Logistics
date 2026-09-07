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

    public ReportServiceImpl(ShipmentRepository shipmentRepository,
                             ParcelUnitRepository parcelUnitRepository,
                             PaymentRepository paymentRepository,
                             SoaRepository soaRepository,
                             ClientRepository clientRepository,
                             CollectionsService collectionsService) {
        this.shipmentRepository = shipmentRepository;
        this.parcelUnitRepository = parcelUnitRepository;
        this.paymentRepository = paymentRepository;
        this.soaRepository = soaRepository;
        this.clientRepository = clientRepository;
        this.collectionsService = collectionsService;
    }

    @Override
    @Transactional(readOnly = true)
    public ReportSummaryResponse getReportSummary(LocalDate startDate, LocalDate endDate) {
        LocalDate resolvedEnd = (endDate != null) ? endDate : LocalDate.now();
        LocalDate resolvedStart = (startDate != null) ? startDate : resolvedEnd.withDayOfMonth(1);

        if (resolvedStart.isAfter(resolvedEnd)) {
            LocalDate temp = resolvedStart;
            resolvedStart = resolvedEnd;
            resolvedEnd = temp;
        }

        LocalDateTime startDateTime = resolvedStart.atStartOfDay();
        LocalDateTime endDateTime = resolvedEnd.atTime(23, 59, 59, 999999999);

        // 1. Fetch Shipments within period
        List<Shipment> periodShipments = shipmentRepository.findByDateRegisteredBetweenOrderByDateRegisteredDesc(startDateTime, endDateTime);
        List<String> shipmentIds = periodShipments.stream().map(Shipment::getShipmentId).collect(Collectors.toList());

        // 2. Fetch Payments recorded within period
        List<Payment> periodPayments = paymentRepository.findByPaymentDateBetween(resolvedStart, resolvedEnd);

        // Also fetch payments specifically linked to period shipments to calculate exact per-shipment balances
        List<Payment> shipmentPayments = shipmentIds.isEmpty()
                ? Collections.emptyList()
                : paymentRepository.findByShipment_ShipmentIdIn(shipmentIds);

        Map<String, BigDecimal> paymentsByShipmentId = shipmentPayments.stream()
                .collect(Collectors.groupingBy(
                        p -> p.getShipment().getShipmentId(),
                        Collectors.reducing(BigDecimal.ZERO, Payment::getAmountPaid, BigDecimal::add)
                ));

        // 3. Fetch Parcels for period shipments
        List<ParcelUnit> periodParcels = shipmentIds.isEmpty()
                ? Collections.emptyList()
                : parcelUnitRepository.findByShipment_ShipmentIdInOrderBySeqAsc(shipmentIds);

        // 4. Calculate Top 5 KPIs
        BigDecimal totalBilled = periodShipments.stream()
                .map(s -> s.getTotalAmount() != null ? s.getTotalAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCollected = periodPayments.stream()
                .map(p -> p.getAmountPaid() != null ? p.getAmountPaid() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal outstandingReceivables = totalBilled.subtract(totalCollected);
        if (outstandingReceivables.compareTo(BigDecimal.ZERO) < 0) {
            outstandingReceivables = BigDecimal.ZERO;
        }

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
                outstandingReceivables,
                totalShipmentsCount,
                totalParcelsCount,
                deliveryCompletionRate
        );

        // 5. Client Revenue Breakdown (Charges vs Collected)
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
        Map<String, Client> clientMap = allClients.stream()
                .collect(Collectors.toMap(Client::getClientId, c -> c, (a, b) -> a));

        List<ClientRevenueReportRow> clientRevenueRows = new ArrayList<>();
        for (Client client : allClients) {
            String clientId = client.getClientId();
            List<Shipment> cShipments = shipmentsByClient.getOrDefault(clientId, Collections.emptyList());
            BigDecimal clientBilled = cShipments.stream()
                    .map(s -> s.getTotalAmount() != null ? s.getTotalAmount() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal clientPaid = paymentsByClient.getOrDefault(clientId, BigDecimal.ZERO);

            if (cShipments.isEmpty() && clientPaid.compareTo(BigDecimal.ZERO) == 0) {
                continue;
            }

            BigDecimal balance = clientBilled.subtract(clientPaid);
            String paymentStatus;
            if (clientPaid.compareTo(BigDecimal.ZERO) == 0) {
                paymentStatus = "UNPAID";
            } else if (clientPaid.compareTo(clientBilled) >= 0) {
                paymentStatus = "PAID";
            } else {
                paymentStatus = "PARTIAL";
            }

            clientRevenueRows.add(new ClientRevenueReportRow(
                    clientId,
                    client.getName(),
                    cShipments.size(),
                    clientBilled,
                    clientPaid,
                    balance.compareTo(BigDecimal.ZERO) > 0 ? balance : BigDecimal.ZERO,
                    paymentStatus
            ));
        }

        clientRevenueRows.sort(Comparator.comparing(ClientRevenueReportRow::getTotalBilled).reversed());

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

        // 11. Accounts Receivable Aging (0-7d Current, 8-14d Past Due, 15+d Overdue)
        LocalDate today = LocalDate.now();
        List<Shipment> allUnpaidCandidates = shipmentRepository.findAll();
        Map<String, List<Shipment>> unpaidShipmentsByClient = new HashMap<>();

        for (Shipment s : allUnpaidCandidates) {
            if (s.getClient() == null) continue;
            BigDecimal billed = s.getTotalAmount() != null ? s.getTotalAmount() : BigDecimal.ZERO;
            BigDecimal paid = paymentsByShipmentId.getOrDefault(s.getShipmentId(), BigDecimal.ZERO);
            if (billed.compareTo(paid) > 0) {
                unpaidShipmentsByClient.computeIfAbsent(s.getClient().getClientId(), k -> new ArrayList<>()).add(s);
            }
        }

        List<ReceivablesAgingReportRow> agingRows = new ArrayList<>();
        for (Map.Entry<String, List<Shipment>> entry : unpaidShipmentsByClient.entrySet()) {
            String cId = entry.getKey();
            List<Shipment> cShipments = entry.getValue();
            Client client = clientMap.get(cId);
            String clientName = client != null ? client.getName() : cId;
            String contact = client != null ? client.getContactNumber() : "";

            BigDecimal currentDue = BigDecimal.ZERO;
            BigDecimal pastDue = BigDecimal.ZERO;
            BigDecimal overdue = BigDecimal.ZERO;

            for (Shipment s : cShipments) {
                BigDecimal sBilled = s.getTotalAmount() != null ? s.getTotalAmount() : BigDecimal.ZERO;
                BigDecimal sPaid = paymentsByShipmentId.getOrDefault(s.getShipmentId(), BigDecimal.ZERO);
                BigDecimal sBalance = sBilled.subtract(sPaid);

                LocalDate regDate = s.getDateRegistered() != null ? s.getDateRegistered().toLocalDate() : today;
                long ageDays = ChronoUnit.DAYS.between(regDate, today);

                if (ageDays <= 7) {
                    currentDue = currentDue.add(sBalance);
                } else if (ageDays <= 14) {
                    pastDue = pastDue.add(sBalance);
                } else {
                    overdue = overdue.add(sBalance);
                }
            }

            BigDecimal totalOut = currentDue.add(pastDue).add(overdue);
            if (totalOut.compareTo(BigDecimal.ZERO) > 0) {
                agingRows.add(new ReceivablesAgingReportRow(
                        cId,
                        clientName,
                        contact,
                        cShipments.size(),
                        currentDue,
                        pastDue,
                        overdue,
                        totalOut
                ));
            }
        }

        agingRows.sort(Comparator.comparing(ReceivablesAgingReportRow::getTotalOutstanding).reversed());

        return new ReportSummaryResponse(
                resolvedStart,
                resolvedEnd,
                LocalDateTime.now(),
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
}
