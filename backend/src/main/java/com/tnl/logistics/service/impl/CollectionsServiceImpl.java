package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.WeeklyClientCollectionItem;
import com.tnl.logistics.dto.WeeklyCollectionsResponse;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.Payment;
import com.tnl.logistics.model.Shipment;
import com.tnl.logistics.model.Soa;
import com.tnl.logistics.repository.ClientRepository;
import com.tnl.logistics.repository.PaymentRepository;
import com.tnl.logistics.repository.ShipmentRepository;
import com.tnl.logistics.repository.SoaRepository;
import com.tnl.logistics.repository.WeeklyCollectionRepository;
import com.tnl.logistics.service.CollectionsService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Implementation of Thursday weekly collections consolidation engine.
 */
@Service
public class CollectionsServiceImpl implements CollectionsService {

    private final ClientRepository clientRepository;
    private final ShipmentRepository shipmentRepository;
    private final PaymentRepository paymentRepository;
    private final SoaRepository soaRepository;
    private final com.tnl.logistics.service.SystemSettingService systemSettingService;

    public CollectionsServiceImpl(ClientRepository clientRepository,
                                  ShipmentRepository shipmentRepository,
                                  PaymentRepository paymentRepository,
                                  SoaRepository soaRepository,
                                  com.tnl.logistics.service.SystemSettingService systemSettingService) {
        this.clientRepository = clientRepository;
        this.shipmentRepository = shipmentRepository;
        this.paymentRepository = paymentRepository;
        this.soaRepository = soaRepository;
        this.systemSettingService = systemSettingService;
    }

    @Override
    @Transactional(readOnly = true)
    public WeeklyCollectionsResponse getWeeklyCollections(LocalDate targetDate) {
        LocalDate targetThursday = (targetDate != null) ? targetDate : calculateActiveCycleDate(LocalDate.now());

        LocalDate cycleStartLocalDate = calculateCycleStartDate(targetThursday);
        LocalDateTime cycleStart = cycleStartLocalDate.atStartOfDay();
        LocalDateTime cycleEnd = targetThursday.atTime(23, 59, 59, 999999999);

        List<Shipment> rawShipments = shipmentRepository.findByDateRegisteredBetweenOrderByDateRegisteredDesc(cycleStart, cycleEnd);

        // Pre-fetch all cycle SOAs for this target Thursday
        List<Soa> cycleSoas = soaRepository.findByStatementDate(targetThursday);
        Map<String, Soa> soaByClientId = cycleSoas.stream()
                .filter(s -> s.getClient() != null)
                .collect(Collectors.toMap(s -> s.getClient().getClientId(), s -> s, (s1, s2) -> s1));

        Set<String> cycleSoaNos = cycleSoas.stream()
                .map(Soa::getSoaNo)
                .collect(Collectors.toSet());

        List<Shipment> cycleShipments = rawShipments.stream()
                .filter(s -> {
                    if (s.getClient() == null) {
                        return false;
                    }
                    if (s.getStatementId() != null && !s.getStatementId().trim().isEmpty()) {
                        return cycleSoaNos.contains(s.getStatementId());
                    }
                    return true;
                })
                .collect(Collectors.toList());

        // Derive candidate clients strictly from cycle shipments and cycle SOAs
        Map<String, Client> candidateClients = new LinkedHashMap<>();
        for (Shipment s : cycleShipments) {
            if (s.getClient() != null) {
                candidateClients.putIfAbsent(s.getClient().getClientId(), s.getClient());
            }
        }
        for (Soa soa : cycleSoas) {
            if (soa.getClient() != null) {
                candidateClients.putIfAbsent(soa.getClient().getClientId(), soa.getClient());
            }
        }

        Map<String, List<Shipment>> shipmentsByClient = cycleShipments.stream()
                .collect(Collectors.groupingBy(s -> s.getClient().getClientId()));

        // Batch pre-fetch all payments for shipments in this cycle
        List<String> allCycleShipmentIds = cycleShipments.stream()
                .map(Shipment::getShipmentId)
                .collect(Collectors.toList());

        Map<String, BigDecimal> paymentsByShipment = Collections.emptyMap();
        if (!allCycleShipmentIds.isEmpty()) {
            List<Payment> cyclePayments = paymentRepository.findByShipment_ShipmentIdIn(allCycleShipmentIds);
            paymentsByShipment = cyclePayments.stream()
                    .filter(p -> p.getShipment() != null && p.getAmountPaid() != null)
                    .collect(Collectors.groupingBy(
                            p -> p.getShipment().getShipmentId(),
                            Collectors.reducing(BigDecimal.ZERO, Payment::getAmountPaid, BigDecimal::add)
                    ));
        }

        List<WeeklyClientCollectionItem> items = new ArrayList<>();
        BigDecimal totalDue = BigDecimal.ZERO;
        BigDecimal totalCollected = BigDecimal.ZERO;
        BigDecimal outstandingBalance = BigDecimal.ZERO;

        for (Client client : candidateClients.values()) {
            String clientId = client.getClientId();
            List<Shipment> clientShipments = shipmentsByClient.getOrDefault(clientId, Collections.emptyList());

            int shipmentsCount = clientShipments.size();
            int unbilledCount = (int) clientShipments.stream()
                    .filter(s -> s.getStatementId() == null || s.getStatementId().trim().isEmpty())
                    .count();

            BigDecimal currentCharges = clientShipments.stream()
                    .map(Shipment::getTotalAmount)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal paid = BigDecimal.ZERO;
            for (Shipment s : clientShipments) {
                paid = paid.add(paymentsByShipment.getOrDefault(s.getShipmentId(), BigDecimal.ZERO));
            }

            Optional<Soa> soaOpt = Optional.ofNullable(soaByClientId.get(clientId));
            String statementId = soaOpt.map(Soa::getSoaNo).orElse(null);
            BigDecimal previousBalance = BigDecimal.ZERO;
            BigDecimal deductions = soaOpt.map(Soa::getDeductions).filter(Objects::nonNull).orElse(BigDecimal.ZERO);
            BigDecimal netAmountDue = currentCharges.add(previousBalance).subtract(paid).subtract(deductions);
            if (netAmountDue.compareTo(BigDecimal.ZERO) < 0) {
                netAmountDue = BigDecimal.ZERO;
            }

            String status;
            if (soaOpt.isPresent()) {
                status = (netAmountDue.compareTo(BigDecimal.ZERO) == 0 && shipmentsCount > 0) ? "SETTLED" : "SOA_GENERATED";
            } else {
                status = (shipmentsCount > 0) ? "READY_FOR_SOA" : "NO_SHIPMENTS";
            }

            // Only include clients with shipments or outstanding balances in this cycle
            if (shipmentsCount > 0 || netAmountDue.compareTo(BigDecimal.ZERO) > 0 || soaOpt.isPresent()) {
                totalDue = totalDue.add(currentCharges).add(previousBalance);
                totalCollected = totalCollected.add(paid);
                outstandingBalance = outstandingBalance.add(netAmountDue);

                items.add(new WeeklyClientCollectionItem(
                        clientId,
                        client.getName(),
                        clientId,
                        client.getContactNumber(),
                        shipmentsCount,
                        unbilledCount,
                        currentCharges,
                        previousBalance,
                        paid,
                        deductions,
                        netAmountDue,
                        netAmountDue,
                        status,
                        statementId
                ));
            }
        }

        int activeClientsCount = (int) items.stream()
                .filter(i -> i.getUnbilledShipmentsCount() > 0 || i.getNetAmountDue().compareTo(BigDecimal.ZERO) > 0)
                .count();

        return new WeeklyCollectionsResponse(
                targetThursday,
                totalDue,
                totalCollected,
                outstandingBalance,
                activeClientsCount,
                items
        );
    }

    @Override
    public LocalDate calculateCycleStartDate(LocalDate cycleEndDate) {
        if (cycleEndDate == null) {
            return null;
        }
        return cycleEndDate.minusDays(6);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LocalDate> getActiveCycleDates() {
        Set<LocalDate> activeCycles = new TreeSet<>(Comparator.reverseOrder());

        // 1. Add all immutable historical statement dates from generated SOAs
        List<LocalDate> soaDates = soaRepository.findDistinctStatementDates();
        if (soaDates != null) {
            for (LocalDate d : soaDates) {
                if (d != null) {
                    activeCycles.add(d);
                }
            }
        }

        // 2. Add distinct unbilled registration dates mapped to configured collection day
        List<LocalDate> unbilledDates = shipmentRepository.findDistinctUnbilledRegistrationDates();
        if (unbilledDates != null) {
            for (LocalDate regDate : unbilledDates) {
                if (regDate != null) {
                    activeCycles.add(calculateActiveCycleDate(regDate));
                }
            }
        }

        return new ArrayList<>(activeCycles);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LocalDate> getActiveCycleThursdays() {
        return getActiveCycleDates();
    }

    @Override
    public DayOfWeek getCollectionDayOfWeek() {
        return systemSettingService != null ? systemSettingService.getCollectionDay() : DayOfWeek.THURSDAY;
    }

    @Override
    public LocalDate calculateActiveCycleDate(LocalDate baseDate) {
        DayOfWeek collectionDay = getCollectionDayOfWeek();
        int currentDayValue = baseDate.getDayOfWeek().getValue();
        int targetDayValue = collectionDay.getValue();
        int daysUntilTarget = (targetDayValue - currentDayValue + 7) % 7;
        return baseDate.plusDays(daysUntilTarget);
    }
}
